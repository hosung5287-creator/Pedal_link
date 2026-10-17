import { useEffect, useState } from 'react';
import { getRideTip, refreshRideTip } from '../api/rides';

// 라이딩 통계 카드의 "한마디 조언" — 통계(횟수·거리·시간·상승고도·산악 완주)가 지난번과 달라졌으면
// 프로필을 열 때 Claude 가 그 변화에 맞는 조언을 새로 한 문장 쓴다. 그대로면 저장된 조언을 보여준다.
// 조언이 없거나 API 키가 없거나 실패하면 아무것도 보여주지 않는다(부가 기능이라 조용히 숨긴다).
export default function RideTip({ userId }) {
  const [tip, setTip] = useState(null);
  const [making, setMaking] = useState(false);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    (async () => {
      try {
        const saved = await getRideTip(userId);
        if (!alive) return;
        if (!(saved.stale && saved.available)) {
          setTip(saved.tip);
          return;
        }
        setMaking(true);
        const fresh = await refreshRideTip(userId);
        if (alive) setTip(fresh.tip);
      } catch {
        if (alive) setTip(null);
      } finally {
        if (alive) setMaking(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (making) return <p className="accountAchieve isMaking" role="status">새 조언을 만드는 중…</p>;
  if (!tip) return null;
  return <p className="accountAchieve">{tip}</p>;
}
