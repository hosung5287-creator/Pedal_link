// 설계 도식 SVG → PNG (4배, 배경 투명, A4 인쇄 약 380dpi). 필요: npm i playwright-core, 시스템 Edge
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const DIR = __dirname; // 이 폴더의 SVG 를 읽어 같은 폴더에 PNG 로 저장
const MM = 96 / 25.4;
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ deviceScaleFactor: 4 });
  const page = await ctx.newPage();
  for (const name of ['architecture', 'flow', 'data']) {
    const svg = fs.readFileSync(path.join(DIR, `${name}.svg`), 'utf8');
    const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const W = Math.ceil(w * MM), H = Math.ceil(h * MM);
    await page.setViewportSize({ width: W, height: H });
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`);
    await page.waitForTimeout(150);
    await page.locator('svg').screenshot({ path: path.join(DIR, `${name}.png`), omitBackground: true });
    console.log(name, W * 4, 'x', H * 4);
  }
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
