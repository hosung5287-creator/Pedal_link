import { useEffect, useRef, useState } from 'react';
import { text } from '../constants';
import { getMyRoutesForParty } from '../api/parties';
import { getRouteById } from '../api/routes';
import RouteMapThumbnail from './RouteMapThumbnail';
import '../styles/create-party-modal.css';

// 저장된 내 경로 하나를 골라 모집 링크(파티)를 여는 모달.
// 왼쪽: 고른 경로의 지도 미리보기 / 오른쪽: 경로 카드 목록 + 링크 정보 입력.
// 경로 목록 응답에는 좌표가 없어서, 고를 때 그 경로만 한 번 더 불러온다(불러온 건 기억해 둠).
export default function CreatePartyModal({ user, onClose, onCreate }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routeId, setRouteId] = useState('');
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState('');
  const [maxMembers, setMaxMembers] = useState(6);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // 경로 지도 — { [routeId]: path | null }. undefined 면 아직 불러오는 중
  const [paths, setPaths] = useState({});
  const requested = useRef(new Set());

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

  // 고른 경로의 좌표를 불러온다 (한 경로당 한 번)
  useEffect(() => {
    if (!routeId || requested.current.has(routeId)) return;
    requested.current.add(routeId);
    getRouteById(routeId)
      .then((r) => setPaths((prev) => ({ ...prev, [routeId]: r?.bikeRoute?.length > 1 ? r.bikeRoute : null })))
      .catch(() => setPaths((prev) => ({ ...prev, [routeId]: null })));
  }, [routeId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const route = routes.find((r) => String(r.id) === String(routeId)) || null;
  const path = paths[routeId];

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

  const hasRoutes = !loading && routes.length > 0;

  return (
    <div className="composeBackdrop" onClick={onClose} role="presentation">
      <div className={`composeModal cpmModal${hasRoutes ? ' isWide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="create-party-title"
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
          <form className="cpmBody" onSubmit={submit}>
            {/* 왼쪽 — 고른 경로 지도 */}
            <section className="cpmPreview" aria-label={text.partyRoutePreview}>
              <div className="cpmMap">
                {path === undefined ? (
                  <p className="cpmMapNote">{text.partyRouteMapLoading}</p>
                ) : path ? (
                  // key — 경로를 바꾸면 지도를 새로 만든다
                  <RouteMapThumbnail key={routeId} path={path} />
                ) : (
                  <p className="cpmMapNote">{text.partyRouteNoMap}</p>
                )}
              </div>
              {route && (
                <div className="cpmPreviewInfo">
                  <strong>{route.routeName || text.routeUnnamed}</strong>
                  <span>{route.fromLabel} → {route.toLabel}{route.distanceKm != null ? ` · ${route.distanceKm}km` : ''}</span>
                </div>
              )}
            </section>

            {/* 오른쪽 — 경로 고르기 + 링크 정보 */}
            <div className="cpmSide">
              <fieldset className="cpmRoutes">
                <legend>{text.browseComposeRoute} <small>{routes.length}{text.partyRouteCount}</small></legend>
                <div className="cpmRouteList">
                  {routes.map((r) => {
                    const checked = String(r.id) === String(routeId);
                    return (
                      <label key={r.id} className={`cpmRoute${checked ? ' isSelected' : ''}`}>
                        <input type="radio" name="party-route" value={r.id} checked={checked}
                               onChange={(e) => setRouteId(e.target.value)} />
                        <span className="cpmRouteName">{r.routeName || text.routeUnnamed}</span>
                        <span className="cpmRouteMeta">
                          {r.fromLabel} → {r.toLabel}{r.distanceKm != null ? ` · ${r.distanceKm}km` : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

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
                  {submitting ? text.partyCreating : text.partyCreate}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
