// 저장된 경로를 "실제 지도 위" 미니뷰로 보여주는 썸네일 (캡처 느낌).
// 타일을 부르므로, 화면에 들어올 때만(IntersectionObserver) 지도를 만든다.
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { makeTileLayer } from '../utils/leaflet';

export default function RouteMapThumbnail({ path }) {
  const nodeRef = useRef(null);
  const [inView, setInView] = useState(false);

  // 카드가 뷰포트 근처에 오면 지도 생성 (스크롤 밖 카드는 타일 요청 안 함)
  useEffect(() => {
    const el = nodeRef.current;
    if (!el || inView) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { setInView(true); io.disconnect(); }
    }, { rootMargin: '250px' });
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  useEffect(() => {
    if (!inView || !nodeRef.current || !path || path.length < 2) return;

    const map = L.map(nodeRef.current, {
      // 정지된 캡처처럼 — 모든 상호작용 끔
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      preferCanvas: true,
    });

    makeTileLayer('cyclemap').addTo(map);

    const latlngs = path.map((p) => [p.lat, p.lng]);
    const line = L.polyline(latlngs, {
      color: '#0ea5e9', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round',
    }).addTo(map);

    // 시작(초록) / 끝(빨강) 지점
    L.circleMarker(latlngs[0], { radius: 5, weight: 2, color: '#ffffff', fillColor: '#10b981', fillOpacity: 1 }).addTo(map);
    L.circleMarker(latlngs[latlngs.length - 1], { radius: 5, weight: 2, color: '#ffffff', fillColor: '#ef4444', fillOpacity: 1 }).addTo(map);

    map.fitBounds(line.getBounds(), { padding: [18, 18] });
    // 컨테이너 크기 확정 후 타일이 정확히 채워지도록
    const t = setTimeout(() => map.invalidateSize(), 60);

    return () => { clearTimeout(t); map.remove(); };
  }, [inView, path]);

  if (!path || path.length < 2) {
    return <div className="feedThumb feedThumbEmpty">경로 미리보기가 없습니다</div>;
  }

  return <div className="feedThumb feedThumbMap" ref={nodeRef} role="img" aria-label="경로 지도 미리보기" />;
}
