import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const out = process.argv[2] || '/tmp/xingya-back-contact.png';
const source = readFileSync(new URL('../src/game/facing.ts', import.meta.url), 'utf8');
const rows = [...source.matchAll(/^\s{2}(\w+): \{ gaze: '(left|right|rear)', why: '([^']+)' \},$/gm)].map((match) => ({
  id: match[1],
  gaze: match[2],
  why: match[3],
}));
if (rows.length !== 32) throw new Error(`朝向表不是 32 条，而是 ${rows.length}`);

const card = (row) => {
  const mirror = row.gaze === 'left' ? '1' : '0';
  return `<figure data-gaze="${row.gaze}">
    <div class="battle-field">
      <span class="portrait-frame portrait-stage battle-actor" data-side="player" data-gaze="${row.gaze}">
        <span class="battle-motion"><span class="portrait-facing" data-mirror="${mirror}"><img class="standing" alt="" src="http://127.0.0.1:43123/starbud-island/portraits/${row.id}-back.jpg"></span></span>
      </span>
    </div>
    <figcaption><b>${row.id}</b> ${row.gaze === 'left' ? '翻转朝右' : row.gaze === 'right' ? '原稿朝右' : '正后方，不翻'}</figcaption>
  </figure>`;
};

const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="http://127.0.0.1:43123/starbud-island/src/style.css">
<style>
  body { margin: 0; background: #efe6da; }
  .grid { display: grid; grid-template-columns: repeat(8, 160px); gap: 10px; padding: 12px; }
  figure { margin: 0; }
  .battle-field { height: 150px; min-height: 150px; background: linear-gradient(#e7f6cf, #cfe8b0); border-radius: 12px; padding: 8px; }
  .battle-field .portrait-frame.portrait-stage.battle-actor { width: 88px; height: 132px; max-width: none; }
  figcaption { font: 12px sans-serif; text-align: center; margin-top: 4px; }
  figure[data-gaze="rear"] figcaption { color: #8a5a32; }
</style><div class="grid">${rows.map(card).join('')}</div>`;

await mkdir(new URL('.', `file://${out}`).pathname, { recursive: true }).catch(() => {});
const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 8 * 160 + 7 * 10 + 24, height: 4 * 196 + 24, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle0' });
const broken = await page.evaluate(() => [...document.querySelectorAll('img')].filter((img) => !img.complete || img.naturalWidth === 0).map((img) => img.src));
if (broken.length) throw new Error(`背面没有加载 ${broken.join(',')}`);
const mirrors = await page.evaluate(() => [...document.querySelectorAll('figure')].map((fig) => ({
  id: fig.querySelector('b').textContent,
  gaze: fig.dataset.gaze,
  mirror: fig.querySelector('.portrait-facing').dataset.mirror,
  transform: getComputedStyle(fig.querySelector('.portrait-facing')).transform,
})));
for (const row of mirrors) {
  const flipped = row.transform === 'matrix(-1, 0, 0, 1, 0, 0)';
  if (row.gaze === 'left' && (!flipped || row.mirror !== '1')) throw new Error(`${row.id} 应该翻转`);
  if (row.gaze !== 'left' && (flipped || row.mirror !== '0')) throw new Error(`${row.id} 不应该翻转`);
}
await page.screenshot({ path: out });
await browser.close();
console.log(`contact ${rows.length} -> ${out}`);
