import { useEffect, useMemo, useRef, useState } from 'react';
import { RideHeatmap, SpeedChart, CumulativeChart } from '../RideCharts';
import { homeDraft } from '../../constants';
import { useFrameZoom } from '../../hooks/useFrameZoom';
import '../../styles/account.css';
import '../../styles/ridereport.css';

const t = homeDraft.report;
const CHARTS = { grass: RideHeatmap, speed: SpeedChart, total: CumulativeChart };

// 항상 같은 값이 나오는 0~1 난수 — 새로고침해도 잔디 모양이 바뀌지 않는다
const noise = (n) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// 시연용 라이딩 기록 — 오늘 기준 최근 1년. 주말에 조금 더 타고, 많이 타는 시기와 쉬는 시기가 섞여 있다.
// API 를 부르지 않는다. 그래프는 프로필 리포트와 같은 컴포넌트(RideCharts)라 마우스 말풍선도 그대로 동작한다.
function sampleRides() {
  const rides = [];
  const today = new Date();
  let yesterday = false;
  for (let ago = 360, id = 1; ago >= 0; ago -= 1) {
    const ridedAt = new Date(today);
    ridedAt.setDate(today.getDate() - ago);
    const weekend = ridedAt.getDay() === 0 || ridedAt.getDay() === 6;
    const mood = 0.25 + noise(Math.floor(ago / 25) + 500) * 1.5; // 25일 단위로 많이 타거나 쉰다
    const chance = (weekend ? 0.3 : 0.1) * mood + (yesterday ? 0.12 : 0); // 탄 다음 날은 이어서 타기 쉽다
    yesterday = noise(ago) < chance;
    if (yesterday) {
      const season = 1 + (360 - ago) / 360; // 시간이 갈수록 조금씩 더 멀리, 더 빠르게
      const distanceKm = Math.round((5 + noise(ago + 1000) ** 2 * 45) * season * 10) / 10;
      const speed = 15 + noise(ago + 2000) * 7 + season * 2;
      rides.push({
        id,
        ridedAt: ridedAt.toISOString(),
        distanceKm,
        durationMin: Math.round((distanceKm / speed) * 60),
        ascendM: Math.round(noise(ago + 3000) * 240),
        partyId: null,
      });
      id += 1;
    }
  }
  return rides;
}

// 예시 기록으로 프로필의 라이딩 통계·라이더 역량 값을 계산한다
function summarize(rides) {
  const km = rides.reduce((sum, r) => sum + r.distanceKm, 0);
  const min = rides.reduce((sum, r) => sum + r.durationMin, 0);
  const ascend = rides.reduce((sum, r) => sum + r.ascendM, 0);
  const speed = km / (min / 60);
  return {
    stats: [
      { key: 'rides', value: rides.length },
      { key: 'km', value: Math.round(km).toLocaleString() },
      { key: 'hours', value: Math.round(min / 60) },
      { key: 'ascend', value: ascend.toLocaleString() },
      { key: 'perKm', value: (ascend / km).toFixed(1) },
      { key: 'mountain', value: 4 },
    ],
    abilities: [
      { key: 'endurance', pct: 72, value: `${Math.round(km).toLocaleString()}km` },
      { key: 'climbing', pct: 58, value: `${ascend.toLocaleString()}m` },
      { key: 'speed', pct: (speed / 30) * 100, value: `${speed.toFixed(1)}km/h` },
      { key: 'consistency', pct: (rides.length / 80) * 100, value: `${rides.length}${t.countUnit}` },
    ],
  };
}

// 프로필의 라이딩 통계·AI 리포트·라이더 역량을 옮긴 시연 — 값은 예시 기록, 요약·조언은 예시 문구.
export default function RideReportDemo() {
  const rides = useMemo(sampleRides, []);
  const summary = useMemo(() => summarize(rides), [rides]);
  const [tab, setTab] = useState(t.tabs[0].id);
  const Chart = CHARTS[tab];
  // 잔디 칸 크기 — 프레임 폭을 꽉 채우도록 (요일 칸·좌우 여백·칸 간격을 뺀 53주)
  const frame = useFrameZoom();
  const panel = useRef(null);
  const [plotW, setPlotW] = useState(null);
  const [cell, setCell] = useState(10);
  useEffect(() => {
    const fit = () => {
      const inner = frame.ref.current?.clientWidth - 32 - 42;
      if (inner > 0) setCell(Math.min(24, Math.max(10, Math.floor(inner / 53) - 2)));
      // 선 그래프 폭 — 남은 높이에 맞춘다 (제목 줄 44px, 그래프 비율 640:230)
      const h = panel.current?.clientHeight;
      setPlotW(frame.zoom && h > 44 ? Math.round(((h - 44) * 640) / 230) : null);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.zoom]);
  return (
    <div className="rrd" ref={frame.ref} style={{ ...frame.style, ...(plotW ? { '--rrd-plot': `${plotW}px` } : null) }}>
      <section className="accountCard">
        <h2>{t.statsTitle}</h2>
        <div className="accountStats">
          {summary.stats.map((x) => (
            <div key={x.key} className="accountStat"><strong>{x.value}</strong><span>{t.stats[x.key]}</span></div>
          ))}
        </div>
      </section>
      <section className="accountCard">
        <h2>{t.abilityTitle}</h2>
        <ul className="accountAbilityList">
          {summary.abilities.map((a) => (
            <li key={a.key} className="accountAbilityRow">
              <span className="accountAbilityLabel">{t.abilities[a.key]}</span>
              <span className="accountAbilityBarTrack"><span className="accountAbilityBarFill" style={{ width: `${a.pct}%` }} /></span>
              <span className="accountAbilityValue">{a.value}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="accountCard rrdMain">
      <div className="rrHead">
        <strong className="rrdTitle">{t.heading}</strong>
        <span className="rrBy">{t.by}</span>
      </div>
      <div className="rrInsight">
        <p className="rrSummary"><span className="rrLevel">{t.level}</span> {t.summary}</p>
        <ul className="rrAdvice">
          {t.advice.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </div>
      <div className="rrTabs" role="group" aria-label={t.heading}>
        {t.tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            className={tab === x.id ? 'isActive' : ''}
            aria-pressed={tab === x.id}
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="rrPanel" ref={panel}><Chart rides={rides} cell={cell} /></div>
      </section>
    </div>
  );
}
