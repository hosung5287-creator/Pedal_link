import { useEffect, useRef, useState } from 'react';
import { text, GU_LIST } from '../constants';
import { getRoutes } from '../api/routes';
import { publishPost } from '../api/feed';
import { compressImage, formatBytes, MAX_UPLOAD_BYTES } from '../utils/image';

// 저장된 내 경로 하나를 골라 문구·해시태그를 붙여 피드에 올리는 모달.
// "게시물"은 별도 테이블이 아니라 경로(routes)에 딸린 내용이다.
export default function ComposePostModal({ user, onClose, onPublished }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routeId, setRouteId] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [regions, setRegions] = useState([]); // 여러 개 선택 가능 — 제출할 때 콤마로 합친다
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [photo, setPhoto] = useState(null);      // { dataUrl, bytes, width, height }
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);

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

  // 코스를 고르면(또는 처음 목록이 뜨면) 그 코스에 이미 저장돼 있던 지역을 기본값으로 채운다.
  // 코스 저장 시 자동 감지가 안 됐거나(옛날 코스) 틀렸으면 여기서 고쳐서 올릴 수 있다.
  useEffect(() => {
    const selected = routes.find((r) => String(r.id) === String(routeId));
    const saved = (selected?.region || '').split(',').map((s) => s.trim()).filter(Boolean);
    setRegions(saved);
  }, [routeId, routes]);

  const toggleRegion = (gu) => {
    setRegions((prev) => (prev.includes(gu) ? prev.filter((g) => g !== gu) : [...prev, gu]));
  };

  // ESC 로 닫기
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    // 같은 파일을 다시 골라도 onChange 가 걸리도록 입력값을 비운다
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) { setError(text.browsePhotoTypeError); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setError(text.browsePhotoTooBig); return; }

    setPhotoBusy(true);
    setError(null);
    try {
      setPhoto(await compressImage(file));
    } catch {
      setError(text.browsePhotoReadError);
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!routeId || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const card = await publishPost(routeId, {
        userId: user.id, description, tags, photo: photo?.dataUrl ?? null, region: regions.join(','),
      });
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

            <div className="composeField">
              <span>{text.browseComposeRegion}</span>
              <div className="composeChipRow">
                {GU_LIST.map((gu) => (
                  <button
                    type="button"
                    key={gu}
                    className={`composeChip${regions.includes(gu) ? ' isActive' : ''}`}
                    onClick={() => toggleRegion(gu)}
                  >
                    <span className="composeChipDot" aria-hidden="true" />
                    {gu}
                  </button>
                ))}
              </div>
            </div>

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

            <div className="composeField">
              <span>{text.browseComposePhoto}</span>

              {/* 실제 input 은 숨기고 버튼/미리보기로 조작한다 (기본 파일 입력은 스타일이 안 먹는다) */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="composeFileInput"
                onChange={pickPhoto}
              />

              {photo ? (
                <div className="composePhoto">
                  <img src={photo.dataUrl} alt={text.browseComposePhotoAlt} />
                  <div className="composePhotoBar">
                    <span>{photo.width}×{photo.height} · {formatBytes(photo.bytes)}</span>
                    <button type="button" className="composePhotoRemove" onClick={() => setPhoto(null)}>
                      {text.browseComposePhotoRemove}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="composePhotoBtn"
                  disabled={photoBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7h3l2-2h8l2 2h3v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                  </svg>
                  {photoBusy ? text.browseComposePhotoBusy : text.browseComposePhotoAdd}
                </button>
              )}
            </div>

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
