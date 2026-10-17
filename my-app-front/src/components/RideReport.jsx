import '../styles/ridereport.css';

import { useEffect, useRef, useState } from 'react';
import { getRideInsight, analyzeRides } from '../api/rides';
import { errorMessage } from '../api/client';
import { RideHeatmap, SpeedChart, CumulativeChart } from './RideCharts';

// 프로필 "AI 라이딩 리포트" — Claude 가 쓴 수준 한줄 요약·조언 + 그래프 3개(탭).
// 질문은 모든 사용자에게 같다(서버 RideInsightService.QUESTION). 그래프는 실제 기록으로 그린다.
const QUESTION = '나의 프로필에서 라이딩통계을 확인후 나의 라이딩 수준을 한줄 요약과 앞으로 어떻게 하면 더욱 라이딩을 발전시킬 수 있나 데이터을 확인하고 그의 맞는 전세계의 국가대표의 자전거 라이딩의 조언해 줍니다.';

const TABS = [
  { id: 'grass', label: '라이딩 잔디' },
  { id: 'speed', label: '평균 속도' },
  { id: 'total', label: '누적 거리' },
];

const MODEL_LABEL = { 'claude-opus-5-5': 'Claude Opus 5.5' };

function fmtAnalyzed(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 분석`;
}

export default function RideReport({ userId, rides }) {
  const [state, setState] = useState(null); // GET /insight 응답
  const [loadFailed, setLoadFailed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('grass');
  const tabRefs = useRef({});

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    getRideInsight(userId)
      .then((s) => { if (alive) setState(s); })
      .catch(() => { if (alive) setLoadFailed(true); });
    return () => { alive = false; };
  }, [userId]);

  const analyze = async () => {
    setAnalyzing(true);
    setError('');
    try {
      setState(await analyzeRides(userId));
    } catch (err) {
      setError(errorMessage(err, 'AI 분석에 실패했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setAnalyzing(false);
    }
  };

  // ←/→ 로 탭 이동 (WAI-ARIA 탭 패턴)
  const onTabKey = (e) => {
    const i = TABS.findIndex((x) => x.id === tab);
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  };

  const insight = state?.insight;
  const rideCount = state?.rideCount ?? rides.length;

  return (
    <section className="accountCard rrCard" aria-labelledby="rr-title">
      <div className="rrHead">
        <h2 id="rr-title">AI 라이딩 리포트</h2>
        <span className="rrBy">Claude 분석</span>
      </div>

      <div className="rrInsight" aria-live="polite">
        {!state ? (
          <p className="rrHint">{loadFailed ? 'AI 리포트를 불러오지 못했어요.' : '불러오는 중…'}</p>
        ) : rideCount === 0 ? (
          <p className="rrHint">라이딩 기록이 생기면 AI 가 수준과 조언을 정리해 드려요.</p>
        ) : insight ? (
          <>
            <p className="rrSummary">
              <span className="rrLevel">{insight.level}</span>{' '}
              {insight.summary}
            </p>
            <ul className="rrAdvice">
              {insight.advice.map((a) => <li key={a}>{a}</li>)}
            </ul>
            <p className="rrMeta">
              {fmtAnalyzed(insight.createdAt)} · {MODEL_LABEL[insight.model] || insight.model}
              {state.stale && <span className="rrStale"> · 분석 뒤로 기록이 바뀌었어요</span>}
            </p>
          </>
        ) : (
          <p className="rrQuestion">“{QUESTION}”</p>
        )}

        {error && <p className="rrError" role="alert">{error}</p>}

        {state && rideCount > 0 && (!insight || state.stale) && (
          !state.available ? (
            <p className="rrHint">AI 분석이 아직 설정되지 않았어요.</p>
          ) : (
            <button type="button" className="rrAnalyzeBtn" onClick={analyze} disabled={analyzing}>
              {analyzing ? '분석하는 중… (10초 정도 걸려요)' : insight ? '새 기록으로 다시 분석' : 'AI 분석 보기'}
            </button>
          )
        )}
      </div>

      <div className="rrTabs" role="tablist" aria-label="라이딩 그래프">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            id={`rr-tab-${x.id}`}
            aria-selected={tab === x.id}
            aria-controls={`rr-panel-${x.id}`}
            tabIndex={tab === x.id ? 0 : -1}
            className={tab === x.id ? 'isActive' : ''}
            ref={(el) => { tabRefs.current[x.id] = el; }}
            onClick={() => setTab(x.id)}
            onKeyDown={onTabKey}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="rrPanel" role="tabpanel" id={`rr-panel-${tab}`} aria-labelledby={`rr-tab-${tab}`}>
        {tab === 'grass' && <RideHeatmap rides={rides} />}
        {tab === 'speed' && <SpeedChart rides={rides} />}
        {tab === 'total' && <CumulativeChart rides={rides} />}
      </div>
    </section>
  );
}
