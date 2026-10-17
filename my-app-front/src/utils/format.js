// 화면에 보여줄 숫자 모양.

// 소수 한 자리까지 — 끝이 .0 이면 떼어 낸다 (2560.0 → "2560", 92.34 → "92.3", 255.99999 → "256")
export const fmt1 = (v) => String(Number((Number(v) || 0).toFixed(1)));

// 분 → 시간 (소수 한 자리, 끝 .0 은 뗀다) — 8138분 → "135.6", 120분 → "2"
export const minutesToHours = (min) => fmt1((Number(min) || 0) / 60);
