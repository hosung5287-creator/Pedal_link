// 사진을 브라우저에서 줄여 data URL 로 만든다.
//
// 폰 카메라 사진은 4000px · 4~8MB 라 그대로 보내면 업로드도 느리고 DB 도 감당 못 한다.
// canvas 로 긴 변을 MAX_SIDE 까지 줄이고 JPEG 로 다시 인코딩해 200KB 안팎으로 낮춘다.
// (서버에 파일 저장소가 없어 data URL 문자열로 보관하는 구조다.)

const MAX_SIDE = 1280;      // 긴 변 최대 픽셀
const TARGET_BYTES = 300 * 1024;  // 목표 용량 — 넘으면 품질을 낮춰 다시 굽는다
const MIN_QUALITY = 0.5;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 원본 파일 상한 (8MB)

// data URL 의 실제 바이트 수 (base64 는 4글자당 3바이트)
export function dataUrlBytes(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽지 못했습니다.')); };
    img.src = url;
  });
}

export async function compressImage(file) {
  const img = await loadImage(file);

  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // 축소할 때 계단현상을 줄인다
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  // 목표 용량에 들어올 때까지 품질을 단계적으로 낮춘다
  let quality = 0.75;
  let out = canvas.toDataURL('image/jpeg', quality);
  while (dataUrlBytes(out) > TARGET_BYTES && quality > MIN_QUALITY) {
    quality -= 0.1;
    out = canvas.toDataURL('image/jpeg', quality);
  }

  return { dataUrl: out, width: w, height: h, bytes: dataUrlBytes(out) };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
