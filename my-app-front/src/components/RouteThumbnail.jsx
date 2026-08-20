// 저장된 경로 좌표를 SVG 선으로 그리는 썸네일.
// 지도 타일을 부르지 않으므로 피드에 카드가 수십 장 있어도 네트워크 요청이 늘지 않는다.

const VIEW_W = 320;
const VIEW_H = 200;
const PADDING = 26;

// 위도/경도 배열 → SVG 좌표 배열
function project(path) {
  const lats = path.map(p => p.lat);
  const lngs = path.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  // 경도 1도는 위도 1도보다 짧다(위도에 따라 cos 배). 보정해야 경로가 찌그러지지 않는다.
  const midLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180);

  const spanX = Math.max((maxLng - minLng) * lngScale, 1e-9);
  const spanY = Math.max(maxLat - minLat, 1e-9);

  // 가로세로 비율을 유지한 채 박스 안에 맞춘다
  const boxW = VIEW_W - PADDING * 2;
  const boxH = VIEW_H - PADDING * 2;
  const scale = Math.min(boxW / spanX, boxH / spanY);

  const offsetX = PADDING + (boxW - spanX * scale) / 2;
  const offsetY = PADDING + (boxH - spanY * scale) / 2;

  return path.map(p => ({
    x: offsetX + (p.lng - minLng) * lngScale * scale,
    y: offsetY + (maxLat - p.lat) * scale,   // SVG는 y가 아래로 증가 → 위도를 뒤집는다
  }));
}

export default function RouteThumbnail({ path }) {
  if (!path || path.length < 2) {
    return <div className="feedThumb feedThumbEmpty">경로 미리보기가 없습니다</div>;
  }

  const points = project(path);
  const line = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const start = points[0];
  const end = points[points.length - 1];

  // 중간 지점 표시 (전체의 25% / 50% / 75% 위치)
  const waypoints = [0.25, 0.5, 0.75]
    .map(ratio => points[Math.floor(points.length * ratio)])
    .filter(Boolean);

  return (
    <div className="feedThumb">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="feedThumbSvg" role="img" aria-label="경로 미리보기">
        {/* 색은 App.css 가 갖는다 — 테마를 바꿀 때 CSS만 고치면 되도록 */}
        <polyline
          className="thumbLine"
          points={line}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {waypoints.map((p, i) => (
          <circle key={i} className="thumbWaypoint" cx={p.x} cy={p.y} r="3.5" />
        ))}
        <circle className="thumbStart" cx={start.x} cy={start.y} r="7" />
        <circle className="thumbEnd" cx={end.x} cy={end.y} r="7" />
      </svg>
    </div>
  );
}
