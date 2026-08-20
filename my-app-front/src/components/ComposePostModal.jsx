import { useEffect, useState } from 'react';
import { text } from '../constants';
import { getRoutes } from '../api/routes';
import { publishPost } from '../api/feed';

// 저장된 내 경로 하나를 골라 문구·해시태그를 붙여 피드에 올리는 모달.
// "게시물"은 별도 테이블이 아니라 경로(routes)에 딸린 내용이다.
export default function ComposePostModal({ user, onClose, onPublished }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routeId, setRouteId] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    getRoutes(user.id)
      .then((data) => {
        if (!alive) return;
        const list = data || [];
        setRoutes(list);
        if (list.length > 0) setRouteId(String(list[0].id));
        setLoading(false);
      })
      .catch(() => { if (alive) { setError(text.browseComposeFailed); setLoading(false); } });
    return () => { alive = false; };
  }, [user.id]);

  // ESC 로 닫기
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!routeId || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const card = await publishPost(routeId, { userId: user.id, description, tags });
      onPublished(card);
      onClose();
    } catch (err) {
      setError(err.status === 403 ? '본인이 저장한 경로만 올릴 수 있습니다.' : text.browseComposeFailed);
      setSubmitting(false);
    }
  };

  return (
    // 배경을 누르면 닫히고, 카드 안쪽 클릭은 전파를 막아 닫히지 않게 한다
    <div className="composeBackdrop" onClick={onClose} role="presentation">
      <div className="composeModal" role="dialog" aria-modal="true" aria-labelledby="compose-title"
           onClick={(e) => e.stopPropagation()}>
        <h2 id="compose-title">{text.browseComposeTitle}</h2>
        <p className="composeSub">{text.browseComposeSub}</p>

        {loading ? (
          <p className="composeNotice">{text.browseLoading}</p>
        ) : routes.length === 0 ? (
          <>
            <p className="composeNotice">{text.browseComposeNoRoutes}</p>
            <div className="composeActions">
              <button type="button" className="composeGhostBtn" onClick={onClose}>
                {text.browseComposeCancel}
              </button>
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
              <span>{text.browseComposeDesc}</span>
              <textarea
                rows={3}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={text.browseComposeDescPlaceholder}
              />
            </label>

            <label className="composeField">
              <span>{text.browseComposeTags}</span>
              <input
                type="text"
                maxLength={300}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={text.browseComposeTagsPlaceholder}
              />
            </label>

            {error && <p className="composeError">{error}</p>}

            <div className="composeActions">
              <button type="button" className="composeGhostBtn" onClick={onClose}>
                {text.browseComposeCancel}
              </button>
              <button type="submit" className="composePrimaryBtn" disabled={submitting}>
                {submitting ? '올리는 중…' : text.browseComposeSubmit}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
