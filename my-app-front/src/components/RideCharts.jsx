import { useLayoutEffect, useMemo, useRef, useState } from 'react';

// 프로필 "AI 라이딩 리포트"의 그래프 3종 — 모두 실제 라이딩 기록(GET /api/ride-records)으로 그린다.
// 차트 라이브러리 없이 SVG 로 직접 그린다. 값은 마우스를 올리면 말풍선으로 보여준다.
// rides: [{ id, ridedAt, distanceKm, durationMin, ascendM, partyId }] (순서 무관)

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const parseDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtDay = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
const fmtLong = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_LABELS[d.getDay()]})`;
const fmtKm = (v) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1));

// 0 부터 시작하는 눈금 — 눈금 간격을 1·2·2.5·5 단위로 골라 4~5칸이 되게 한다
function niceTicks(v) {
  const max = v > 0 ? v : 1;
  const rough = max / 5;
  const p = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= rough);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}
const tickLabel = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

// 말풍선(가운데 정렬)이 그래프 밖으로 잘리지 않게 좌우 끝을 막는다
const TIP_HALF = 80;
const clampTip = (left, width) => Math.min(Math.max(left, TIP_HALF), Math.max(TIP_HALF, width - TIP_HALF));

// ── A. 라이딩 잔디 (GitHub 기여 그래프처럼 최근 1년을 하루 한 칸) ─────────────────
// 칸 색은 그날 탄 거리 — 한 번이라도 탔으면 가장 연한 초록부터 칠한다(0km 기록도 "탄 날").
const CELL = 10;
const GAP = 2;
const STEP = CELL + GAP;
const WEEKS = 53;
const HM_LEFT = 2; // 요일 라벨은 스크롤 밖에 따로 고정한다 (가로로 밀어도 보이게)
const HM_RIGHT = 18; // 맨 오른쪽 달 이름이 잘리지 않을 여유
const HM_TOP = 18;
const DAY_COL = 22;
const GRASS = ['#6cc477', '#3aa652', '#1f8540', '#0f5a29']; // 단계색 (dataviz 검증 통과: 흰 배경 대비 2.14:1~)
const GRASS_STEPS = [10, 30, 60]; // km 경계: ~10 / 10~30 / 30~60 / 60~
const grassLevel = (km) => GRASS_STEPS.filter((s) => km >= s).length;

export function RideHeatmap({ rides }) {
  const scrollRef = useRef(null);
  const [tip, setTip] = useState(null);

  const { cells, months, totals } = useMemo(() => {
    const byDay = new Map();
    for (const r of rides) {
      const d = parseDate(r.ridedAt);
      if (!d) continue;
      const k = dayKey(d);
      const cur = byDay.get(k) || { km: 0, count: 0 };
      cur.km += r.distanceKm || 0;
      cur.count += 1;
      byDay.set(k, cur);
    }

    const today = startOfDay(new Date());
    // 맨 오른쪽 열이 이번 주(일~토), 그 앞으로 52주
    const start = addDays(today, -today.getDay() - (WEEKS - 1) * 7);
    const out = [];
    const monthLabels = [];
    let rideDays = 0, rideCount = 0, km = 0, streak = 0, bestStreak = 0;
    for (let i = 0, d = start; d <= today; i++, d = addDays(d, 1)) {
      const col = Math.floor(i / 7);
      const v = byDay.get(dayKey(d));
      out.push({ date: d, col, row: d.getDay(), km: v?.km || 0, count: v?.count || 0 });
      if (v) {
        rideDays += 1; rideCount += v.count; km += v.km;
        streak += 1; bestStreak = Math.max(bestStreak, streak);
      } else {
        streak = 0;
      }
      // 달의 첫 일요일이 있는 열 위에 "n월" (GitHub 처럼 맨 앞의 덜 찬 달은 이름을 생략)
      if (d.getDay() === 0 && d.getDate() <= 7) monthLabels.push({ col, text: `${d.getMonth() + 1}월` });
    }
    return { cells: out, months: monthLabels, totals: { rideDays, rideCount, km, bestStreak } };
  }, [rides]);

  // 처음엔 최근(오른쪽 끝)이 보이게 — 좁은 화면에선 왼쪽으로 밀어서 지난 기록을 본다
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const width = HM_LEFT + WEEKS * STEP + HM_RIGHT;
  const height = HM_TOP + 7 * STEP;

  const showTip = (c) => {
    const el = scrollRef.current;
    const wrapW = DAY_COL + (el ? el.clientWidth : width);
    setTip({
      left: clampTip(DAY_COL + HM_LEFT + c.col * STEP + CELL / 2 - (el ? el.scrollLeft : 0), wrapW),
      top: 4 + HM_TOP + c.row * STEP, // 4 = .rcHeatScroll 위 여백
      title: fmtLong(c.date),
      body: c.count ? `${c.count}회 · ${fmtKm(c.km)}km` : '기록 없음',
    });
  };

  return (
    <div className="rcChart">
      <dl className="rcTotals">
        <div><dt>라이딩한 날</dt><dd>{totals.rideDays}<small>일</small></dd></div>
        <div><dt>총 라이딩</dt><dd>{totals.rideCount}<small>회</small></dd></div>
        <div><dt>총 거리</dt><dd>{fmtKm(totals.km)}<small>km</small></dd></div>
        <div><dt>최장 연속</dt><dd>{totals.bestStreak}<small>일</small></dd></div>
      </dl>
      <p className="rcCaption">최근 1년 · 하루 한 칸, 많이 탄 날일수록 진한 초록</p>

      <div className="rcHeatWrap">
        <svg className="rcSvg rcHeatDays" width={DAY_COL} height={height} aria-hidden="true">
          {[1, 3, 5].map((row) => (
            <text key={row} x={0} y={HM_TOP + row * STEP + CELL - 1} className="rcAxisText">{DAY_LABELS[row]}</text>
          ))}
        </svg>
        <div className="rcHeatScroll" ref={scrollRef} onScroll={() => setTip(null)}>
          <svg
            className="rcSvg"
            width={width}
            height={height}
            role="img"
            aria-label={`최근 1년 라이딩 잔디: ${totals.rideDays}일 동안 ${totals.rideCount}회, 총 ${fmtKm(totals.km)}km, 최장 ${totals.bestStreak}일 연속`}
          >
            {months.map((m) => (
              <text key={`${m.col}-${m.text}`} x={HM_LEFT + m.col * STEP} y={11} className="rcAxisText">{m.text}</text>
            ))}
            {cells.map((c) => (
              <rect
                key={c.col * 7 + c.row}
                x={HM_LEFT + c.col * STEP}
                y={HM_TOP + c.row * STEP}
                width={CELL}
                height={CELL}
                rx={2}
                className={c.count ? 'rcGrass' : 'rcGrass isEmpty'}
                fill={c.count ? GRASS[grassLevel(c.km)] : undefined}
                onMouseEnter={() => showTip(c)}
                onMouseLeave={() => setTip(null)}
              />
            ))}
          </svg>
        </div>
        {tip && (
          <div className="rcTip isAbove" style={{ left: tip.left, top: tip.top }} role="status">
            <strong>{tip.body}</strong>
            <span>{tip.title}</span>
          </div>
        )}
      </div>

      <div className="rcLegend" aria-label="거리 범례">
        <span>적게</span>
        <i className="rcLegendCell isEmpty" title="기록 없음" />
        {GRASS.map((c, i) => (
          <i
            key={c}
            className="rcLegendCell"
            style={{ background: c }}
            title={i === 0 ? '10km 미만' : i === GRASS.length - 1 ? `${GRASS_STEPS[i - 1]}km 이상` : `${GRASS_STEPS[i - 1]}~${GRASS_STEPS[i]}km`}
          />
        ))}
        <span>많이</span>
      </div>
    </div>
  );
}

// ── 선·영역 그래프 공통 틀 ─────────────────────────────────────────────
const W = 640;
const H = 230;
const PAD = { l: 44, r: 16, t: 26, b: 28 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

// 마우스 위치(px) → viewBox x, 가장 가까운 점을 찾아 말풍선을 띄운다
function useNearestPoint(points) {
  const [active, setActive] = useState(null);
  const onMove = (e) => {
    const svg = e.currentTarget.ownerSVGElement || e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].x - vx) < Math.abs(points[best].x - vx)) best = i;
    }
    setActive({ i: best, scale: rect.width / W });
  };
  return { active, onMove, onLeave: () => setActive(null) };
}

function YGrid({ ticks }) {
  const max = ticks[ticks.length - 1];
  return ticks.map((t) => {
    const y = PAD.t + PLOT_H - (t / max) * PLOT_H;
    return (
      <g key={t}>
        <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className={t === 0 ? 'rcBaseline' : 'rcGridline'} />
        <text x={PAD.l - 8} y={y + 4} textAnchor="end" className="rcAxisText">{tickLabel(t)}</text>
      </g>
    );
  });
}

function PointTip({ point, scale, title, body }) {
  return (
    <div className="rcTip isAbove" style={{ left: clampTip(point.x * scale, W * scale), top: point.y * scale }} role="status">
      <strong>{body}</strong>
      <span>{title}</span>
    </div>
  );
}

// ── B. 라이딩별 평균 속도 (최근 20회) ─────────────────────────────────────
const SPEED_RIDES = 20;

export function SpeedChart({ rides }) {
  const data = useMemo(() => rides
    .map((r) => ({ r, d: parseDate(r.ridedAt) }))
    .filter(({ r, d }) => d && r.durationMin > 0 && r.distanceKm > 0)
    .sort((a, b) => a.d - b.d)
    .slice(-SPEED_RIDES)
    .map(({ r, d }) => ({ date: d, km: r.distanceKm, min: r.durationMin, speed: r.distanceKm / (r.durationMin / 60) })),
  [rides]);

  const ticks = niceTicks(Math.max(...data.map((p) => p.speed), 0) * 1.05);
  const max = ticks[ticks.length - 1];
  const avg = data.length ? data.reduce((s, p) => s + p.speed, 0) / data.length : 0;
  const points = data.map((p, i) => ({
    ...p,
    x: PAD.l + (data.length === 1 ? PLOT_W / 2 : (i / (data.length - 1)) * PLOT_W),
    y: PAD.t + PLOT_H - (p.speed / max) * PLOT_H,
  }));
  const { active, onMove, onLeave } = useNearestPoint(points);

  if (data.length < 2) {
    return <p className="rcEmpty">시간이 기록된 라이딩이 2번 이상 있어야 속도 변화를 그릴 수 있어요.</p>;
  }

  const avgY = PAD.t + PLOT_H - (avg / max) * PLOT_H;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
  const labelIdx = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const cur = active && points[active.i];

  return (
    <div className="rcChart">
      <p className="rcHeadline"><strong>{avg.toFixed(1)}</strong> km/h <span>최근 {data.length}회 평균 속도</span></p>
      <div className="rcPlot">
        <svg className="rcSvg" viewBox={`0 0 ${W} ${H}`} role="img"
             aria-label={`라이딩별 평균 속도, 최근 ${data.length}회. 평균 ${avg.toFixed(1)}km/h, 가장 빠른 기록 ${Math.max(...data.map((p) => p.speed)).toFixed(1)}km/h`}>
          <YGrid ticks={ticks} />
          <text x={PAD.l - 8} y={10} textAnchor="end" className="rcAxisText">km/h</text>
          <line x1={PAD.l} x2={W - PAD.r} y1={avgY} y2={avgY} className="rcAvgLine" />
          <text x={W - PAD.r} y={avgY - 6} textAnchor="end" className="rcAxisText">평균 {avg.toFixed(1)}</text>
          {labelIdx.map((i) => (
            <text key={i} x={points[i].x} y={H - 8} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="rcAxisText">
              {fmtDay(points[i].date)}
            </text>
          ))}
          <path d={path} className="rcLine" />
          {cur && <line x1={cur.x} x2={cur.x} y1={PAD.t} y2={PAD.t + PLOT_H} className="rcCrosshair" />}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={active?.i === i ? 5.5 : 4} className="rcDot" />
          ))}
          <rect x={PAD.l} y={0} width={PLOT_W} height={H} className="rcHit" onMouseMove={onMove} onMouseLeave={onLeave} />
        </svg>
        {cur && (
          <PointTip point={cur} scale={active.scale} title={fmtLong(cur.date)}
                    body={`${cur.speed.toFixed(1)}km/h · ${fmtKm(cur.km)}km · ${cur.min}분`} />
        )}
      </div>
    </div>
  );
}

// ── C. 누적 거리 (첫 라이딩부터 오늘까지) ────────────────────────────────
export function CumulativeChart({ rides }) {
  const data = useMemo(() => {
    let sum = 0;
    return rides
      .map((r) => ({ r, d: parseDate(r.ridedAt) }))
      .filter(({ d }) => d)
      .sort((a, b) => a.d - b.d)
      .map(({ r, d }) => { sum += r.distanceKm || 0; return { date: d, km: r.distanceKm || 0, total: sum }; });
  }, [rides]);

  const first = data[0]?.date;
  const t0 = first ? startOfDay(first).getTime() : 0;
  const t1 = Math.max(Date.now(), t0 + 86400000);
  const total = data.length ? data[data.length - 1].total : 0;
  const ticks = niceTicks(total * 1.05);
  const max = ticks[ticks.length - 1];
  const xOf = (d) => PAD.l + ((d.getTime() - t0) / (t1 - t0)) * PLOT_W;
  const yOf = (v) => PAD.t + PLOT_H - (v / max) * PLOT_H;
  const points = data.map((p) => ({ ...p, x: xOf(p.date), y: yOf(p.total) }));
  const { active, onMove, onLeave } = useNearestPoint(points);

  if (data.length === 0) {
    return <p className="rcEmpty">라이딩 기록이 생기면 누적 거리를 그려 드릴게요.</p>;
  }

  // 계단 모양 — 다음 라이딩 전까지는 누적 거리가 그대로다
  const base = yOf(0);
  let line = `M${PAD.l},${base}`;
  points.forEach((p, i) => {
    const prevY = i ? points[i - 1].y : base;
    line += `L${p.x.toFixed(1)},${prevY.toFixed(1)}L${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  });
  const endX = W - PAD.r;
  line += `L${endX},${points[points.length - 1].y.toFixed(1)}`;
  const area = `${line}L${endX},${base}Z`;
  const cur = active && points[active.i];
  const midDate = new Date((t0 + t1) / 2);

  return (
    <div className="rcChart">
      <p className="rcHeadline"><strong>{fmtKm(total)}</strong> km <span>{fmtDay(first)}부터 {data.length}회 누적</span></p>
      <div className="rcPlot">
        <svg className="rcSvg" viewBox={`0 0 ${W} ${H}`} role="img"
             aria-label={`누적 거리, ${fmtLong(first)}부터 ${data.length}회 동안 총 ${fmtKm(total)}km`}>
          <YGrid ticks={ticks} />
          <text x={PAD.l - 8} y={10} textAnchor="end" className="rcAxisText">km</text>
          {[[PAD.l, first, 'start'], [PAD.l + PLOT_W / 2, midDate, 'middle'], [endX, new Date(t1), 'end']].map(([x, d, anchor]) => (
            <text key={anchor} x={x} y={H - 8} textAnchor={anchor} className="rcAxisText">{fmtDay(d)}</text>
          ))}
          <path d={area} className="rcArea" />
          <path d={line} className="rcLine" />
          {cur && <line x1={cur.x} x2={cur.x} y1={PAD.t} y2={PAD.t + PLOT_H} className="rcCrosshair" />}
          {cur && <circle cx={cur.x} cy={cur.y} r={5.5} className="rcDot" />}
          <rect x={PAD.l} y={0} width={PLOT_W} height={H} className="rcHit" onMouseMove={onMove} onMouseLeave={onLeave} />
        </svg>
        {cur && (
          <PointTip point={cur} scale={active.scale} title={fmtLong(cur.date)}
                    body={`누적 ${fmtKm(cur.total)}km (+${fmtKm(cur.km)}km)`} />
        )}
      </div>
    </div>
  );
}
