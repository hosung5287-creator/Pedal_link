import L from 'leaflet';
import { drawMarkers } from './leaflet';

test('출발/도착 라벨의 HTML 은 팝업에 텍스트로만 들어간다 (XSS 방지)', () => {
  const layer = L.layerGroup();
  const evil = '<img src=x onerror="window.__xss=1">';
  drawMarkers({ lat: 37.5, lng: 127, label: evil }, { lat: 37.6, lng: 127.1, label: '<b>도착</b>' }, layer);

  const contents = layer.getLayers().map((m) => m.getPopup().getContent());
  expect(contents).toHaveLength(2);
  contents.forEach((el) => {
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.querySelector('img, b')).toBeNull();
  });
  expect(contents[0].textContent).toContain(evil);
  expect(window.__xss).toBeUndefined();
});
