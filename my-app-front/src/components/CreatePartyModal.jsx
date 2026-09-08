import { useEffect, useState } from 'react';
import { text } from '../constants';
import { getMyRoutesForParty } from '../api/parties';

// 저장된 내 경로 하나를 골라 모집 링크(파티)를 여는 모달.
// 게시물 올리기(ComposePostModal)와 같은 흐름 — 페이지에 경로를 늘어놓지 않고
// 버튼 하나로 열어 선택하게 한다.
export default function CreatePartyModal({ user, onClose, onCreate }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routeId, setRouteId] = useState('');
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState('');
  const [maxMembers, setMaxMembers] = useState(6);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    getMyRoutesForParty(user?.id)
      .then((list) => {
        if (!alive) return;
        setRoutes(list);
        if (list.length > 0) setRouteId(String(list[0].id));
        setLoading(false);
      })
      .catch(() => { if (alive) { setError(text.partyCreateFailed); setLoading(false); } });
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const route = routes.find((r) => String(r.id) === String(routeId)) || null;

  const submit = async (e) => {
    e.preventDefault();
    if (!route || !startAt || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ route, title, startAt, maxMembers });
      onClose();
    } catch {
      setError(text.partyCreateFailed);
      setSubmitting(false);
    }
  };

  return (
    <div className="composeBackdrop" onClick={onClose} role="presentation">
      <div className="composeModal" role="dialog" aria-modal="true" aria-labelledby="create-party-title"
           onClick={(e) => e.stopPropagation()}>
        <h2 id="create-party-title">{text.partyMakeButton}</h2>
        <p className="composeSub">{text.partyCreateSub}</p>

        {loading ? (
          <p className="composeNotice">{text.browseLoading}</p>
        ) : routes.length === 0 ? (
          <>
            <p className="composeNotice">{text.partyNoRoutes}</p>
            <div className="composeActions">
              <button type="button" className="composeGhostBtn" onClick={onClose}>{text.partyCancel}</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <label className="composeField">
              <span>{text.browseComposeRoute}</span>
              <select value={routeId} onChange={(e) => setRouteId(e.target.value)}>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.routeName || '이름없음'} · {r.fromLabel} → {r.toLabel}
                    {r.distanceKm != null ? ` · ${r.distanceKm}km` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="composeField">
              <span>{text.partyFormTitle}</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={text.partyFormTitlePlaceholder}
              />
            </label>

            <div className="composeFieldRow">
              <label className="composeField">
                <span>{text.partyFormTime}</span>
                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
              </label>
              <label className="composeField">
                <span>{text.partyFormMax}</span>
                <input type="number" min="2" max="30" value={maxMembers}
                       onChange={(e) => setMaxMembers(e.target.value)} />
              </label>
            </div>

            {error && <p className="composeError">{error}</p>}

            <div className="composeActions">
              <button type="button" className="composeGhostBtn" onClick={onClose}>{text.partyCancel}</button>
              <button type="submit" className="composePrimaryBtn" disabled={submitting || !startAt}>
                {submitting ? '만드는 중…' : text.partyCreate}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
