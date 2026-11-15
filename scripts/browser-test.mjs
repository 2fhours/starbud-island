import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const appVersion = `v${JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version}`;

const port = 43124;
const base = `http://127.0.0.1:${port}/starbud-island/?test=1`;
const shotDir = '/tmp/xingya-shots';
await mkdir(shotDir, { recursive: true });

const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let previewLog = '';
preview.stdout.on('data', (chunk) => {
  previewLog += chunk.toString();
});
preview.stderr.on('data', (chunk) => {
  previewLog += chunk.toString();
});

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertSeparated(page, selectors, label) {
  const result = await page.evaluate((items) => {
    const boxes = items.flatMap((sel) => [...document.querySelectorAll(sel)].map((el, index) => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return null;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      return { sel: `${sel}#${index}`, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    })).filter(Boolean);
    const hit = (a, b) => a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
    const overlaps = [];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        if (hit(boxes[i], boxes[j])) overlaps.push([boxes[i].sel, boxes[j].sel]);
      }
    }
    const off = boxes.filter((b) => b.left < -1 || b.top < -1 || b.right > window.innerWidth + 1 || b.bottom > window.innerHeight + 1).map((b) => b.sel);
    return { overlaps, off, count: boxes.length };
  }, selectors);
  if (result.overlaps.length || result.off.length) {
    throw new Error(`${label} 控件重叠或出屏 ${JSON.stringify(result)}`);
  }
}

async function assertInside(page, pairs, label) {
  const result = await page.evaluate((pairs) => {
    const box = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const bad = [];
    for (const [child, parent] of pairs) {
      const a = box(child);
      const b = box(parent);
      if (!a || !b || a.width < 2 || b.width < 2) {
        bad.push({ child, parent, missing: true });
        continue;
      }
      if (a.left < b.left - 1 || a.right > b.right + 1 || a.top < b.top - 1 || a.bottom > b.bottom + 1) {
        const round = (r) => ({ left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) });
        bad.push({ child, parent, childBox: round(a), parentBox: round(b) });
      }
    }
    return bad;
  }, pairs);
  if (result.length) throw new Error(`${label} 子元素超出容器 ${JSON.stringify(result)}`);
}

async function assertContentInset(page, parentSel, childSels, minPad, label) {
  const bad = await page.evaluate((parentSel, childSels, minPad) => {
    const parent = document.querySelector(parentSel);
    if (!parent) return [{ missing: parentSel }];
    const box = parent.getBoundingClientRect();
    const style = getComputedStyle(parent);
    const pad = {
      l: parseFloat(style.paddingLeft) || 0,
      t: parseFloat(style.paddingTop) || 0,
      r: parseFloat(style.paddingRight) || 0,
      b: parseFloat(style.paddingBottom) || 0,
    };
    const problems = [];
    if (pad.l < minPad || pad.t < minPad || pad.r < minPad || pad.b < minPad) problems.push({ pad });
    const inner = { l: box.left + pad.l, t: box.top + pad.t, r: box.right - pad.r, b: box.bottom - pad.b };
    for (const sel of childSels) {
      for (const el of document.querySelectorAll(sel)) {
        const shown = getComputedStyle(el);
        if (shown.display === 'none' || shown.visibility === 'hidden') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        if (rect.left < inner.l - 1 || rect.top < inner.t - 1 || rect.right > inner.r + 1 || rect.bottom > inner.b + 1) {
          problems.push({
            sel,
            child: { l: Math.round(rect.left), t: Math.round(rect.top), r: Math.round(rect.right), b: Math.round(rect.bottom) },
            inner: { l: Math.round(inner.l), t: Math.round(inner.t), r: Math.round(inner.r), b: Math.round(inner.b) },
          });
        }
      }
    }
    return problems;
  }, parentSel, childSels, minPad);
  if (bad.length) throw new Error(`${label} 内容贴边或越出内边距 ${JSON.stringify(bad)}`);
}

async function assertDialogActions(page, acts, label) {
  const problems = await page.evaluate((acts) => {
    const sheet = document.querySelector('.sheet');
    const body = document.querySelector('.sheet-body');
    const foot = document.querySelector('.sheet-foot');
    const found = [];
    if (!sheet || !body || !foot) return ['缺少弹框外框或底栏'];
    const sheetBox = sheet.getBoundingClientRect();
    const bodyBox = body.getBoundingClientRect();
    const footBox = foot.getBoundingClientRect();
    const hit = (a, b) => {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return w > 2 && h > 2;
    };
    const shadowY = (el) => {
      const match = getComputedStyle(el).boxShadow.match(/(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px/);
      return match ? Math.max(0, Number(match[2])) : 0;
    };
    if (footBox.top < bodyBox.bottom - 1) found.push('底栏压住正文');
    const bodyOverflow = getComputedStyle(body).overflowY;
    if (bodyOverflow !== 'auto' && bodyOverflow !== 'scroll') found.push('正文不能滚动');
    const buttons = acts.map((act) => document.querySelector(`[data-act="${act}"]`));
    if (buttons.some((el) => !el)) return ['缺少按钮'];
    const boxes = buttons.map((el) => ({ el, r: el.getBoundingClientRect(), shadow: shadowY(el) }));
    for (const item of boxes) {
      const { r, shadow, el } = item;
      if (r.width < 36 || r.height < 36) found.push(`按钮太小 ${el.getAttribute('data-act')}`);
      if (r.left < sheetBox.left - 1 || r.right > sheetBox.right + 1 || r.top < sheetBox.top - 1 || r.bottom + shadow > sheetBox.bottom + 1) {
        found.push(`按钮或阴影超出弹框 ${el.getAttribute('data-act')}`);
      }
      if (r.top < footBox.top - 1 || r.bottom > footBox.bottom + 1 || r.left < footBox.left - 1 || r.right > footBox.right + 1) {
        found.push(`按钮不在底栏 ${el.getAttribute('data-act')}`);
      }
      const hitEl = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hitEl || (hitEl !== el && !el.contains(hitEl))) found.push(`点击落点不是按钮 ${el.getAttribute('data-act')}`);
      const range = document.createRange();
      range.selectNodeContents(el);
      for (const rect of range.getClientRects()) {
        if (rect.width < 1 || rect.height < 1) continue;
        if (rect.left < r.left - 1 || rect.right > r.right + 1 || rect.top < r.top - 1 || rect.bottom > r.bottom + 1) {
          found.push(`按钮文字被裁 ${el.getAttribute('data-act')}`);
        }
      }
    }
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        if (hit(boxes[i].r, boxes[j].r)) found.push('按钮互相重叠');
      }
    }
    const clip = (rect, pane) => ({
      left: Math.max(rect.left, pane.left),
      top: Math.max(rect.top, pane.top),
      right: Math.min(rect.right, pane.right),
      bottom: Math.min(rect.bottom, pane.bottom),
    });
    for (const el of body.querySelectorAll('p, h2, .hp, canvas, .stage, .portrait-frame')) {
      for (const rect of el.getClientRects()) {
        const vis = clip(rect, bodyBox);
        if (vis.right - vis.left < 2 || vis.bottom - vis.top < 2) continue;
        if (hit(vis, footBox)) found.push('正文盖住底栏');
        for (const item of boxes) if (hit(vis, item.r)) found.push('正文盖住按钮');
      }
    }
    if (body.scrollHeight > body.clientHeight + 2) {
      const prev = body.scrollTop;
      body.scrollTop = body.scrollHeight;
      const last = [...body.querySelectorAll('p, .hp')].at(-1);
      if (last) {
        const r = last.getBoundingClientRect();
        const freshBody = body.getBoundingClientRect();
        if (r.bottom > freshBody.bottom + 2) found.push('滚到底后正文仍被裁');
        if (hit(r, foot.getBoundingClientRect())) found.push('滚到底后正文碰到按钮');
      }
      body.scrollTop = prev;
    }
    return found;
  }, acts);
  if (problems.length) throw new Error(`${label} ${JSON.stringify(problems)}`);
}

const foeInset = ['.battle-top .eyebrow', '.battle-top h2', '.battle-top .type', '.battle-top .hp', '.battle-top small', '.battle-stage .portrait-frame'];

async function assertBattleGap(page, label) {
  const gap = await page.evaluate(() => {
    const shadow = (el) => {
      const match = getComputedStyle(el).boxShadow.match(/(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px/);
      return match ? Math.max(0, Number(match[2])) : 0;
    };
    const skills = [...document.querySelectorAll('[data-act="battle-move"]')];
    const actions = [...document.querySelectorAll('[data-act="toggle-switch"], [data-act="battle-catch"], [data-act="battle-run"]')];
    if (!skills.length || !actions.length) return -1;
    const skillBottom = Math.max(...skills.map((el) => el.getBoundingClientRect().bottom + shadow(el)));
    const actionTop = Math.min(...actions.map((el) => el.getBoundingClientRect().top));
    return actionTop - skillBottom;
  });
  if (gap < 10) throw new Error(`${label} 技能和行动按钮间距只有 ${gap}`);
}

const exploreControls = ['#joy', '#btn-touch-talk', '#music-dock', '#build-tag', '.hud-left', '.hud-right'];

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`预览服务没有起来\n${previewLog}`);
}

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});

const errors = [];
try {
  await waitForServer();
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-act="new-game"]');
  await page.screenshot({ path: `${shotDir}/01-title.png` });

  const html = await fetch(`http://127.0.0.1:${port}/starbud-island/`).then((response) => response.text());
  if (!html.includes('/starbud-island/assets/')) throw new Error('预览页面没有使用 /starbud-island/ 资源路径');

  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await page.bringToFront();
  const beforeGesture = await page.evaluate(() => window.__xingya.audioState);
  if (beforeGesture.unlocked || beforeGesture.contexts !== 0 || beforeGesture.scheduling) {
    throw new Error(`未点击就开始了音乐 ${JSON.stringify(beforeGesture)}`);
  }
  await page.click('[data-act="new-game"]');
  await sleep(350);
  const nameArt = await page.$eval('.talk-row img.standing', (img) => img.getAttribute('src'));
  if (!nameArt?.includes('/portraits/player.jpg')) throw new Error(`取名界面没有旅人立绘 ${nameArt}`);
  const afterGesture = await page.evaluate(() => window.__xingya.audioState);
  if (!afterGesture.unlocked || afterGesture.contexts !== 1 || afterGesture.track !== 'explore' || !afterGesture.scheduling) {
    throw new Error(`点击开始后音乐没有解锁 ${JSON.stringify(afterGesture)}`);
  }
  await page.click('[data-arg="星旅"]');
  await page.click('[data-act="to-starter"]');
  const starterArt = await page.$$eval('.choice img.standing', (imgs) => imgs.map((img) => img.getAttribute('src')));
  if (starterArt.length !== 3 || !starterArt.some((src) => src?.includes('/portraits/lujiao.jpg'))) {
    throw new Error(`初始选择没有物种立绘 ${JSON.stringify(starterArt)}`);
  }
  await page.click('[data-arg="lujiao"]');
  await page.screenshot({ path: `${shotDir}/02-starter.png` });
  await page.click('[data-act="confirm-starter"]');
  await page.waitForSelector('.talk-row img.standing');
  const introArt = await page.$eval('.talk-row img.standing', (img) => img.getAttribute('src'));
  const introSpeaker = await page.$eval('.eyebrow', (el) => el.textContent);
  if (introSpeaker !== '芽婆婆' || !introArt?.includes('/portraits/grandma.jpg')) {
    throw new Error(`开场对话立绘不对 ${introSpeaker} ${introArt}`);
  }
  for (let i = 0; i < 8; i += 1) {
    const next = await page.$('[data-act="dialogue-next"]');
    if (!next) break;
    await next.evaluate((el) => el.click());
    await sleep(30);
  }
  await page.waitForFunction(() => window.__xingya.mode === 'explore');
  await sleep(400);
  const versionText = await page.$eval('#build-tag', (el) => el.textContent);
  if (versionText !== appVersion) throw new Error(`版本号不是 ${appVersion}：${versionText}`);
  const pixels = await page.evaluate(() => {
    const canvas = document.querySelector('#view');
    const ctx = canvas.getContext('2d');
    const sample = ctx.getImageData(200, 200, 1, 1).data;
    return Array.from(sample);
  });
  if (pixels[3] === 0) throw new Error('画面是空的');
  await page.screenshot({ path: `${shotDir}/03-overworld.png` });

  const moved = await page.evaluate(async () => {
    const before = window.__xingya.play.x;
    const down = new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true });
    window.dispatchEvent(down);
    await new Promise((resolve) => setTimeout(resolve, 180));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', bubbles: true }));
    return window.__xingya.play.x - before;
  });
  if (moved < 4) throw new Error(`角色没有移动：${moved}`);

  const drag = await page.evaluate(async () => {
    const canvas = document.querySelector('#view');
    const game = window.__xingya;
    const fire = (type, x, y, id = 7) => {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y, button: 0 }));
    };
    const sample = async (dx, dy) => {
      const x0 = game.play.x;
      const y0 = game.play.y;
      fire('pointerdown', 180, 240);
      fire('pointermove', 180 + dx, 240 + dy);
      await new Promise((resolve) => setTimeout(resolve, 180));
      const movedX = game.play.x - x0;
      const movedY = game.play.y - y0;
      fire('pointerup', 180 + dx, 240 + dy);
      await new Promise((resolve) => setTimeout(resolve, 160));
      const afterX = game.play.x - x0;
      const afterY = game.play.y - y0;
      return { movedX, movedY, driftX: afterX - movedX, driftY: afterY - movedY };
    };
    const right = await sample(48, 0);
    const down = await sample(0, 48);
    const diagonal = await sample(36, 36);
    const x1 = game.play.x;
    const y1 = game.play.y;
    fire('pointerdown', 180, 240);
    fire('pointermove', 230, 240);
    await new Promise((resolve) => setTimeout(resolve, 80));
    fire('pointercancel', 230, 240);
    const stoppedX = game.play.x;
    const stoppedY = game.play.y;
    await new Promise((resolve) => setTimeout(resolve, 180));
    const cancelDrift = Math.hypot(game.play.x - stoppedX, game.play.y - stoppedY);
    game.onPageHidden();
    const hidden = game.input.dragActive;
    game.onPageVisible();
    game.mode = 'menu';
    const menuBefore = game.play.x;
    fire('pointerdown', 200, 260);
    fire('pointermove', 260, 260);
    await new Promise((resolve) => setTimeout(resolve, 120));
    fire('pointerup', 260, 260);
    const menuMoved = game.play.x - menuBefore;
    game.mode = 'explore';
    const volBefore = game.play.x;
    const slider = document.querySelector('#music-volume');
    slider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 3, pointerType: 'touch', clientX: 40, clientY: 40 }));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    return { right, down, diagonal, cancelDrift, hidden, menuMoved, volMoved: game.play.x - volBefore };
  });
  if (drag.right.movedX < 4 || Math.abs(drag.right.movedY) > drag.right.movedX) throw new Error(`向右拖动不对 ${JSON.stringify(drag.right)}`);
  if (drag.down.movedY < 4 || Math.abs(drag.down.movedX) > drag.down.movedY) throw new Error(`向下拖动不对 ${JSON.stringify(drag.down)}`);
  if (drag.diagonal.movedX < 3 || drag.diagonal.movedY < 3) throw new Error(`斜向拖动不对 ${JSON.stringify(drag.diagonal)}`);
  if (Math.abs(drag.right.driftX) > 2 || Math.abs(drag.down.driftY) > 2 || drag.cancelDrift > 8) throw new Error(`松手或取消后还在走 ${JSON.stringify(drag)}`);
  if (drag.hidden || Math.abs(drag.menuMoved) > 1 || Math.abs(drag.volMoved) > 1) throw new Error(`弹层或音量操作带动了角色 ${JSON.stringify(drag)}`);

  await page.evaluate(() => {
    const game = window.__xingya;
    const wild = game.wilds.find((item) => item.speciesId === 'yanwei' && !item.hidden);
    game.play.x = wild.x;
    game.play.y = wild.y;
  });
  await page.waitForSelector('[data-act="encounter-catch"]', { timeout: 4000 });
  await page.waitForFunction(() => {
    const img = document.querySelector('.encounter-sheet img.standing');
    return !!img && img.complete && img.naturalWidth >= 800;
  });
  const encounterFit = await page.evaluate(() => {
    const img = document.querySelector('.encounter-sheet img.standing');
    const frame = img.closest('.portrait-frame');
    const stage = document.querySelector('.encounter-sheet .stage');
    const rect = frame.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    const buttons = ['encounter-catch', 'encounter-fight', 'encounter-leave'].map((act) => {
      const button = document.querySelector(`[data-act="${act}"]`);
      const box = button.getBoundingClientRect();
      return { act, top: box.top, bottom: box.bottom, height: box.height };
    });
    return {
      tag: img.tagName,
      src: img.getAttribute('src'),
      nw: img.naturalWidth,
      nh: img.naturalHeight,
      rw: rect.width,
      rh: rect.height,
      inside: rect.left >= stageBox.left - 1 && rect.right <= stageBox.right + 1 && rect.top >= stageBox.top - 1 && rect.bottom <= stageBox.bottom + 1,
      buttons,
      innerHeight: window.innerHeight,
    };
  });
  if (encounterFit.tag !== 'IMG' || !String(encounterFit.src).includes('/portraits/yanwei.jpg') || encounterFit.nw < 800 || encounterFit.nh < 1000) {
    throw new Error(`焰尾狐立绘没有加载 ${JSON.stringify(encounterFit)}`);
  }
  if (encounterFit.rw > 180 || encounterFit.rh > 160 || encounterFit.rw < 24 || !encounterFit.inside) {
    throw new Error(`焰尾狐立绘尺寸异常 ${JSON.stringify(encounterFit)}`);
  }
  for (const button of encounterFit.buttons) {
    if (button.top < 0 || button.bottom > encounterFit.innerHeight + 1 || button.height < 20) {
      throw new Error(`遭遇按钮不在画面内 ${JSON.stringify(encounterFit)}`);
    }
  }
  await page.screenshot({ path: `${shotDir}/04-encounter.png` });
  const stage = await page.$('.encounter-sheet .stage');
  if (stage) await stage.screenshot({ path: `${shotDir}/04b-fox-stage.png` });
  await page.evaluate(() => {
    const ids = ['lujiao', 'yanwei', 'luzhu', 'dianrong', 'yanke', 'fengling', 'taibei', 'xiwen'];
    const box = document.createElement('div');
    box.id = 'species-probe';
    box.style.cssText = 'position:fixed;left:0;top:0;display:flex;gap:4px;z-index:50;background:#fff';
    box.innerHTML = ids.map((id) => `<canvas class="portrait portrait-stage" data-fit="stage" data-species="${id}" width="156" height="138"></canvas>`).join('');
    document.body.appendChild(box);
  });
  await sleep(250);
  const species = await page.evaluate(() => {
    const hashes = [];
    for (const canvas of document.querySelectorAll('#species-probe canvas')) {
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 0;
      let ink = 0;
      for (let i = 0; i < data.length; i += 16) {
        hash = (Math.imul(hash, 33) + data[i] + data[i + 1] * 3 + data[i + 2] * 7) >>> 0;
        if (data[i + 3] > 24) ink += 1;
      }
      const rect = canvas.getBoundingClientRect();
      hashes.push({ id: canvas.dataset.species, hash, ink, bw: canvas.width, rw: rect.width, rh: rect.height });
    }
    document.querySelector('#species-probe')?.remove();
    return hashes;
  });
  if (species.length !== 8) throw new Error(`物种肖像数量不对 ${species.length}`);
  const seen = new Set(species.map((item) => item.hash));
  if (seen.size !== 8) throw new Error(`物种肖像没有互相区分 ${JSON.stringify(species)}`);
  for (const item of species) {
    if (item.ink < 40 || item.bw > 512 || item.rw > 180 || item.rh > 160) {
      throw new Error(`物种肖像没有正常绘制 ${JSON.stringify(item)}`);
    }
  }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await sleep(400);
  const mobileButtons = await page.evaluate(() => {
    return ['encounter-catch', 'encounter-fight', 'encounter-leave'].map((act) => {
      const box = document.querySelector(`[data-act="${act}"]`).getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight + 1;
    });
  });
  if (mobileButtons.some((ok) => !ok)) throw new Error(`竖屏遭遇按钮被挡住 ${JSON.stringify(mobileButtons)}`);
  const encounterDock = await page.evaluate(() => {
    const dock = document.querySelector('#music-dock').getBoundingClientRect();
    const hit = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    return ['encounter-catch', 'encounter-fight', 'encounter-leave'].every((act) => {
      const box = document.querySelector(`[data-act="${act}"]`).getBoundingClientRect();
      return !hit(dock, box);
    });
  });
  if (!encounterDock) throw new Error('竖屏音乐控件挡住了捕捉、对战或离开');
  await page.screenshot({ path: `${shotDir}/04c-encounter-mobile.png` });
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await sleep(120);
    await page.screenshot({ path: `${shotDir}/encounter-${width}x${height}.png` });
    await assertInside(page, [['.stage .portrait-frame', '.stage']], `遭遇图片 ${width}x${height}`);
    const encounterFit = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('[data-act="encounter-catch"], [data-act="encounter-fight"], [data-act="encounter-leave"]')];
      const sheet = document.querySelector('.encounter-sheet');
      const boxes = buttons.map((el) => el.getBoundingClientRect());
      const hit = (a, b) => a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
      const overlaps = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) if (hit(boxes[i], boxes[j])) overlaps.push([i, j]);
      }
      const off = boxes.filter((r) => r.bottom > window.innerHeight + 1 || r.top < -1 || r.right > window.innerWidth + 1 || r.left < -1).length;
      return { overlaps, off, scrollable: !!sheet && sheet.scrollHeight > sheet.clientHeight + 2 };
    });
    if (encounterFit.overlaps.length || encounterFit.off) {
      throw new Error(`遭遇按钮挤在一起或出屏 ${width}x${height} ${JSON.stringify(encounterFit)}`);
    }
    await assertDialogActions(page, ['encounter-catch', 'encounter-fight', 'encounter-leave'], `遭遇 ${width}x${height}`);
  }
  await page.addStyleTag({ content: 'body.font-boost, body.font-boost button, body.font-boost .hud-copy strong { font-size: 20px; }' });
  await page.evaluate(() => document.body.classList.add('font-boost'));
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await sleep(120);
    await assertDialogActions(page, ['encounter-catch', 'encounter-fight', 'encounter-leave'], `大字遭遇 ${width}x${height}`);
    await page.screenshot({ path: `${shotDir}/encounter-font-${width}x${height}.png` });
  }
  await page.evaluate(() => document.body.classList.remove('font-boost'));
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.click('[data-act="encounter-leave"]');
  await sleep(800);

  const ballsBefore = await page.evaluate(() => {
    const game = window.__xingya;
    const wild = game.wilds.find((item) => item.speciesId === 'dianrong' && !item.hidden);
    game.play.x = wild.x;
    game.play.y = wild.y;
    game.debugFreezeScale = 1;
    game.rngQueue = [0, 0, 0, 0];
    return game.play.balls;
  });
  await page.waitForSelector('[data-act="encounter-catch"]', { timeout: 4000 });
  await page.click('[data-act="encounter-catch"]');
  await page.waitForSelector('#catch-ring');
  await assertInside(page, [['#catch-ring', '.sheet']], '捕捉圈');
  await sleep(80);
  await page.screenshot({ path: `${shotDir}/05-capture.png` });
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    await page.setViewport({ width, height });
    await sleep(80);
    await assertInside(page, [['#catch-ring', '.sheet']], `捕捉圈 ${width}x${height}`);
    const captureFit = await page.evaluate(() => {
      return ['throw', 'capture-back'].map((act) => {
        const box = document.querySelector(`[data-act="${act}"]`).getBoundingClientRect();
        return box.top >= 0 && box.bottom <= window.innerHeight + 1 && box.height >= 36;
      });
    });
    if (captureFit.some((ok) => !ok)) throw new Error(`捕捉按钮不在画面内 ${width}x${height}`);
    await assertDialogActions(page, ['throw', 'capture-back'], `捕捉 ${width}x${height}`);
    await page.screenshot({ path: `${shotDir}/capture-${width}x${height}.png` });
  }
  await page.evaluate(() => document.body.classList.add('font-boost'));
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await sleep(120);
    await assertDialogActions(page, ['throw', 'capture-back'], `大字捕捉 ${width}x${height}`);
    const ringClear = await page.evaluate(() => {
      const ring = document.querySelector('#catch-ring').getBoundingClientRect();
      const body = document.querySelector('.sheet-body').getBoundingClientRect();
      const buttons = [...document.querySelectorAll('[data-act="throw"], [data-act="capture-back"]')].map((el) => el.getBoundingClientRect());
      const hit = (a, b) => a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
      return ring.bottom <= body.bottom + 1 && ring.top >= body.top - 1 && buttons.every((box) => !hit(ring, box));
    });
    if (!ringClear) throw new Error(`大字捕捉圈盖住按钮或跑出正文 ${width}x${height}`);
    await page.screenshot({ path: `${shotDir}/capture-font-${width}x${height}.png` });
  }
  await page.evaluate(() => document.body.classList.remove('font-boost'));
  await page.setViewport({ width: 1280, height: 800 });
  const ballsAtPrompt = await page.evaluate(() => window.__xingya.play.balls);
  await page.click('[data-act="capture-back"]');
  await page.waitForSelector('[data-act="encounter-catch"]', { timeout: 4000 });
  const afterCancel = await page.evaluate((before) => ({
    mode: window.__xingya.mode,
    balls: window.__xingya.play.balls,
    team: window.__xingya.play.team.length,
    before,
  }), ballsAtPrompt);
  if (afterCancel.mode !== 'encounter' || afterCancel.balls !== ballsAtPrompt || afterCancel.team !== 1) {
    throw new Error(`先不扔不应自动捕捉 ${JSON.stringify(afterCancel)}`);
  }
  await page.click('[data-act="encounter-catch"]');
  await page.waitForSelector('#catch-ring', { timeout: 4000 });
  const stillManual = await page.evaluate(() => window.__xingya.mode);
  if (stillManual !== 'capture') throw new Error(`打开捕捉后被自动投掷，当前是 ${stillManual}`);
  await page.click('[data-act="throw"]');
  await page.waitForSelector('[data-act="dialogue-next"]', { timeout: 4000 });
  for (let i = 0; i < 8; i += 1) {
    const next = await page.$('[data-act="dialogue-next"]');
    if (!next) break;
    await next.evaluate((el) => el.click());
    await sleep(40);
  }
  const afterCatch = await page.evaluate(() => ({
    team: window.__xingya.play.team.length,
    caught: window.__xingya.play.quest.caughtWild,
    balls: window.__xingya.play.balls,
    dex: window.__xingya.play.dex.dianrong.caught,
  }));
  if (afterCatch.team !== 2 || !afterCatch.caught || !afterCatch.dex || afterCatch.balls !== ballsBefore - 1) {
    throw new Error(`捕捉结果不对 ${JSON.stringify({ ...afterCatch, ballsBefore })}`);
  }

  await page.evaluate(() => {
    const game = window.__xingya;
    const wild = game.wilds.find((item) => item.speciesId === 'luzhu' && !item.hidden);
    wild.mon.hp = 1;
    game.play.x = wild.x;
    game.play.y = wild.y;
    game.play.team[0].hp = Math.max(1, game.play.team[0].hp);
  });
  await page.waitForSelector('[data-act="encounter-fight"]', { timeout: 4000 });
  await page.click('[data-act="encounter-fight"]');
  await page.waitForSelector('[data-act="battle-move"]', { timeout: 4000 });
  const battleVisible = await page.evaluate(() => {
    return ['battle-move', 'battle-catch', 'battle-run'].every((act) => {
      const box = document.querySelector(`[data-act="${act}"]`).getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight + 1 && box.height > 16;
    });
  });
  if (!battleVisible) throw new Error('战斗里的技能、捕捉或退开按钮不在画面内');
  const battleResources = await page.evaluate(() => {
    const text = document.querySelector('.battle-sheet')?.textContent ?? '';
    const basic = document.querySelector('[data-act="battle-basic"]');
    return { mana: text.includes('法力'), basic: !!basic && !basic.hasAttribute('disabled') };
  });
  if (!battleResources.mana || !battleResources.basic) throw new Error(`战斗没有法力或普通攻击 ${JSON.stringify(battleResources)}`);
  await page.screenshot({ path: `${shotDir}/06-battle.png` });
  const battleControls = ['[data-act="battle-move"]', '[data-act="battle-catch"]', '[data-act="battle-run"]', '[data-act="toggle-switch"]', '#music-dock', '#build-tag'];
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    await page.setViewport({ width, height });
    await sleep(180);
    await assertContentInset(page, '.battle-stage', foeInset, 12, `敌方卡 ${width}x${height}`);
    await assertBattleGap(page, `战斗 ${width}x${height}`);
    const foeOnScreen = await page.evaluate(() => {
      return ['.battle-top .eyebrow', '.battle-top h2', '.battle-top .hp'].every((sel) => {
        const box = document.querySelector(sel).getBoundingClientRect();
        return box.top >= 0 && box.bottom <= window.innerHeight + 1 && box.left >= 0 && box.right <= window.innerWidth + 1;
      });
    });
    if (!foeOnScreen) throw new Error(`敌方信息没有完整出现在画面里 ${width}x${height}`);
    await page.screenshot({ path: `${shotDir}/battle-${width}x${height}.png` });
    const shell = await page.evaluate(() => {
      const sheet = document.querySelector('.sheet').getBoundingClientRect();
      const head = document.querySelector('.sheet-head')?.getBoundingClientRect();
      const foot = document.querySelector('.sheet-foot').getBoundingClientRect();
      return { w: Math.round(sheet.width), h: Math.round(sheet.height), foot: Math.round(foot.top), head: head ? Math.round(head.top) : 0 };
    });
    await page.evaluate(() => {
      const log = document.querySelector('.log');
      if (log) log.textContent = '这是一句很短的战报';
    });
    const shellAfter = await page.evaluate(() => {
      const sheet = document.querySelector('.sheet').getBoundingClientRect();
      const foot = document.querySelector('.sheet-foot').getBoundingClientRect();
      const log = document.querySelector('.log');
      log.textContent = '野生的露珠蛙甩出很长的水花，战报变长以后外框不能跟着变大，多出来的字在固定高度里滚动。';
      return {
        w: Math.round(sheet.width),
        h: Math.round(sheet.height),
        foot: Math.round(foot.top),
        scroll: log.scrollHeight > log.clientHeight + 2,
      };
    });
    if (shell.w !== shellAfter.w || shell.h !== shellAfter.h || shell.foot !== shellAfter.foot || !shellAfter.scroll) {
      throw new Error(`弹框尺寸被内容撑动 ${width}x${height} ${JSON.stringify({ shell, shellAfter })}`);
    }
  }
  await page.evaluate(() => {
    const log = document.querySelector('.log');
    if (log) log.textContent = '野生的露珠蛙甩出很长的水花，这一回合的结果需要完整看完。多出来的字应该能在日志里滚动，不能把左边的名字裁掉。后面还有一句用来占满第二行和第三行，确保窄屏和横屏短高都能滚动看到。';
  });
  for (const [width, height] of [[320, 568], [844, 390]]) {
    await page.setViewport({ width, height });
    await sleep(120);
    await assertContentInset(page, '.battle-stage', foeInset, 12, `长日志敌方卡 ${width}x${height}`);
    const logFit = await page.evaluate(() => {
      const log = document.querySelector('.log');
      const style = getComputedStyle(log);
      const padTop = parseFloat(style.paddingTop) || 0;
      const padBottom = parseFloat(style.paddingBottom) || 0;
      const box = log.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(log);
      const contentTop = box.top + padTop;
      const contentBottom = box.bottom - padBottom;
      const line = Math.max(0, ...[...range.getClientRects()].map((rect) => Math.min(rect.bottom, contentBottom) - Math.max(rect.top, contentTop)));
      return { line, overflow: style.overflowY, scroll: log.scrollHeight, client: log.clientHeight };
    });
    if (logFit.line < 12 || logFit.overflow !== 'auto' || logFit.scroll <= logFit.client + 4) {
      throw new Error(`长战斗日志不能完整滚动 ${width}x${height} ${JSON.stringify(logFit)}`);
    }
    await assertBattleGap(page, `长日志 ${width}x${height}`);
  }
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => {
    const el = document.getElementById('toast');
    el.textContent = '进度已保存在这台设备';
    el.classList.add('show');
  });
  await assertSeparated(page, [...battleControls, '#toast'], '竖屏战斗');
  await page.screenshot({ path: `${shotDir}/06b-battle-landscape.png` });
  await page.addStyleTag({ content: 'body.font-boost, body.font-boost button, body.font-boost .hud-copy strong { font-size: 20px; }' });
  await page.evaluate(() => document.body.classList.add('font-boost'));
  for (const [width, height] of [[320, 568], [844, 390]]) {
    await page.setViewport({ width, height });
    await sleep(120);
    await assertBattleGap(page, `大字战斗 ${width}x${height}`);
    await assertContentInset(page, '.battle-stage', foeInset, 12, `大字敌方卡 ${width}x${height}`);
    const boost = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('[data-act="battle-move"], [data-act="battle-catch"], [data-act="battle-run"], [data-act="toggle-switch"]')];
      const sheet = document.querySelector('.battle-sheet');
      const hit = (a, b) => a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
      const boxes = buttons.map((el) => el.getBoundingClientRect());
      const overlaps = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) if (hit(boxes[i], boxes[j])) overlaps.push([i, j]);
      }
      const off = boxes.filter((r) => r.bottom > window.innerHeight + 1 || r.top < -1 || r.right > window.innerWidth + 1 || r.left < -1).length;
      return { overlaps, off, scrollable: !!sheet && sheet.scrollHeight > sheet.clientHeight + 2 };
    });
    if (boost.overlaps.length || (boost.off && !boost.scrollable)) {
      throw new Error(`大字战斗按钮挤在一起或出屏 ${width}x${height} ${JSON.stringify(boost)}`);
    }
  }
  await page.evaluate(() => document.body.classList.remove('font-boost'));
  await page.setViewport({ width: 1280, height: 800 });
  if (await page.$('[data-act="log-next"]')) throw new Error('战斗仍显示需要点击的继续按钮');
  await page.evaluate(() => {
    window.__xingya.rngQueue = Array(48).fill(0.5);
  });
  for (let i = 0; i < 8; i += 1) {
    const done = await page.evaluate(() => window.__xingya.mode === 'explore');
    if (done) break;
    const button = await page.$('[data-act="battle-move"]:not([disabled]), [data-act="battle-basic"]:not([disabled])');
    if (button) await button.evaluate((el) => el.click());
    await sleep(60);
  }
  await page.waitForFunction(() => window.__xingya.mode === 'explore' && window.__xingya.play.team[0].level >= 5, { timeout: 5000 });
  const afterBattle = await page.evaluate(() => ({
    mode: window.__xingya.mode,
    level: window.__xingya.play.team[0].level,
    hp: window.__xingya.play.team[0].hp,
  }));
  if (afterBattle.mode !== 'explore' || afterBattle.level < 5) throw new Error(`战斗结果不对 ${JSON.stringify(afterBattle)}`);
  await sleep(200);
  const backToField = await page.evaluate(() => window.__xingya.audioState);
  if (backToField.track !== 'explore' || backToField.contexts !== 1) {
    throw new Error(`战斗结束后没有回到探索音乐 ${JSON.stringify(backToField)}`);
  }

  await page.evaluate(() => {
    const game = window.__xingya;
    game.play.x = (16 + 0.5) * 48;
    game.play.y = (16 + 0.5) * 48;
    game.play.team[0].hp = 1;
  });
  await page.waitForFunction(() => (window.__xingya.nearbyLabel || '').includes('星芽驿'), { timeout: 3000 });
  await page.evaluate(() => window.__xingya.handle('interact'));
  await page.waitForSelector('[data-act="heal-yes"]', { timeout: 3000 });
  await page.click('[data-act="heal-yes"]');
  for (let i = 0; i < 4; i += 1) {
    const next = await page.$('[data-act="dialogue-next"]');
    if (!next) break;
    await next.evaluate((el) => el.click());
    await sleep(30);
  }
  const healed = await page.evaluate(() => window.__xingya.play.team[0].hp > 1);
  if (!healed) throw new Error('治疗没有恢复体力');

  await page.click('[data-act="menu"]');
  const menuArt = await page.$eval('.identity img.standing', (img) => img.getAttribute('src'));
  const menuName = await page.$eval('.identity strong', (el) => el.textContent);
  if (!menuArt?.includes('/portraits/player.jpg') || menuName !== '星旅') {
    throw new Error(`菜单没有旅人立绘 ${menuName} ${menuArt}`);
  }
  await page.click('[data-arg="team"]');
  await page.waitForFunction(() => {
    const img = document.querySelector('.mon-card img.standing');
    return !!img && img.complete && img.naturalWidth >= 800 && (img.getAttribute('src') || '').includes('/portraits/lujiao.jpg');
  });
  await page.screenshot({ path: `${shotDir}/07-team.png` });
  const teamStats = await page.evaluate(() => {
    const text = document.querySelector('.sheet')?.textContent ?? '';
    return {
      core: ['体质', '力量', '智力', '精神', '速度'].every((label) => text.includes(label)),
      derived: ['物攻', '物防', '魔攻', '魔防', '命中', '闪避', '出手'].every((label) => text.includes(label)),
      hidden: text.includes('种族值') || text.includes('个体值'),
    };
  });
  if (!teamStats.core || !teamStats.derived || teamStats.hidden) throw new Error(`队伍详情没有五维或露出了隐藏值 ${JSON.stringify(teamStats)}`);
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    await page.setViewport({ width, height });
    await sleep(80);
    await assertInside(page, [['.mon-card .portrait-frame', '.mon-card']], `队伍图片 ${width}x${height}`);
    await assertDialogActions(page, ['panel'], `队伍 ${width}x${height}`);
    await page.screenshot({ path: `${shotDir}/team-${width}x${height}.png` });
  }
  await page.setViewport({ width: 1280, height: 800 });
  await page.click('[data-arg="menu"]');
  await page.click('[data-arg="dex"]');
  await page.screenshot({ path: `${shotDir}/08-dex.png` });
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    await page.setViewport({ width, height });
    await sleep(80);
    await assertInside(page, [['.dex-card .portrait-frame', '.dex-card']], `图鉴图片 ${width}x${height}`);
    await page.screenshot({ path: `${shotDir}/dex-${width}x${height}.png` });
  }
  await page.setViewport({ width: 1280, height: 800 });
  await page.click('[data-arg="menu"]');
  await page.click('[data-act="save"]');
  await page.click('[data-act="title"]');
  await page.reload({ waitUntil: 'networkidle0' });
  const versionAfterReload = await page.$eval('#build-tag', (el) => el.textContent);
  if (versionAfterReload !== appVersion) throw new Error(`刷新后版本号变了：${versionAfterReload}`);
  await page.click('[data-act="continue"]');
  await page.waitForFunction(() => window.__xingya.mode === 'explore');
  const restored = await page.evaluate(() => window.__xingya.play.team.length);
  if (restored !== 2) throw new Error('读档没有恢复队伍');

  await page.setViewport({ width: 390, height: 844 });
  await sleep(200);
  await page.screenshot({ path: `${shotDir}/09-mobile.png` });
  const touchVisible = await page.evaluate(() => getComputedStyle(document.querySelector('#touch')).display !== 'none');
  if (!touchVisible) throw new Error('窄屏没有显示触控操作');
  const dockClear = await page.evaluate(() => {
    const dock = document.querySelector('#music-dock').getBoundingClientRect();
    const blocks = ['#btn-touch-talk', '#joy'].map((sel) => document.querySelector(sel).getBoundingClientRect());
    const hit = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    return dock.width > 40 && dock.height > 16 && blocks.every((box) => !hit(dock, box));
  });
  if (!dockClear) throw new Error('窄屏音乐控件挡住了摇杆或交谈');
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    await page.setViewport({ width, height });
    await sleep(120);
    await assertSeparated(page, exploreControls, `探索 ${width}x${height}`);
    await page.evaluate(() => {
      const el = document.getElementById('toast');
      el.textContent = '在地图上按住拖动就能走路，松开即停';
      el.classList.add('show');
    });
    await assertSeparated(page, ['#toast', '#joy', '#btn-touch-talk', '#music-dock', '#build-tag', '.hud-left', '.hud-right'], `提示 ${width}x${height}`);
    await assertInside(page, [['.hud-left .hp', '.hud-left'], ['.hud-left canvas', '.hud-left'], ['.hud-right button', '.hud-right']], `血条 ${width}x${height}`);
    await page.screenshot({ path: `${shotDir}/explore-${width}x${height}.png` });
  }
  await page.evaluate(() => document.body.classList.add('font-boost'));
  for (const [width, height] of [[320, 568], [844, 390]]) {
    await page.setViewport({ width, height });
    await sleep(120);
    await assertSeparated(page, exploreControls, `大字探索 ${width}x${height}`);
    await assertInside(page, [['.hud-left .hp', '.hud-left'], ['.hud-left canvas', '.hud-left'], ['.hud-right button', '.hud-right']], `大字血条 ${width}x${height}`);
  }
  await page.evaluate(() => document.body.classList.remove('font-boost'));
  await page.screenshot({ path: `${shotDir}/11-landscape.png` });

  await page.setViewport({ width: 1280, height: 800 });
  await page.click('[data-act="menu"]');
  await page.click('[data-act="ask-reset"]');
  await page.screenshot({ path: `${shotDir}/10-reset.png` });
  await page.click('[data-act="confirm-reset"]');
  const cleared = await page.evaluate(() => localStorage.getItem('xingya-island-save-v1'));
  if (cleared) throw new Error('存档没有被清除');
  await page.evaluate(() => {
    localStorage.setItem('xingya-island-save-v1', JSON.stringify({
      version: 1,
      play: {
        name: '旧档',
        x: 20.5 * 48,
        y: 16.5 * 48,
        dir: 'down',
        team: [{ uid: 'old', speciesId: 'yanwei', level: 7, exp: 3, hp: 12, stages: { atk: 0, def: 0 } }],
        box: [],
        dex: { yanwei: { seen: true, caught: true } },
        balls: 4,
        quest: { introduced: true, caughtWild: false, bossDefeated: false, completed: false },
        pickups: [],
        trainers: { qinghe: false, lanchuan: false },
        playMs: 12000,
      },
    }));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('[data-act="continue"]');
  await page.waitForFunction(() => window.__xingya.mode === 'explore');
  const legacy = await page.evaluate(() => ({
    name: window.__xingya.play.name,
    species: window.__xingya.play.team[0].speciesId,
    level: window.__xingya.play.team[0].level,
    balls: window.__xingya.play.balls,
  }));
  if (legacy.name !== '旧档' || legacy.species !== 'yanwei' || legacy.level !== 7 || legacy.balls !== 4) {
    throw new Error(`旧存档没有继续 ${JSON.stringify(legacy)}`);
  }

  await page.click('#music-toggle');
  await sleep(150);
  const silenced = await page.evaluate(() => ({
    state: window.__xingya.audioState,
    stored: localStorage.getItem('xingya-island-music'),
  }));
  if (silenced.state.musicOn || silenced.state.scheduling || silenced.state.track !== 'idle' || silenced.stored !== '0') {
    throw new Error(`静音后仍在出声 ${JSON.stringify(silenced)}`);
  }
  await page.evaluate(() => {
    const slider = document.querySelector('#music-volume');
    slider.value = '35';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.reload({ waitUntil: 'networkidle0' });
  const restoredAudio = await page.evaluate(() => ({
    state: window.__xingya.audioState,
    music: localStorage.getItem('xingya-island-music'),
    volume: localStorage.getItem('xingya-island-music-volume'),
    slider: document.querySelector('#music-volume').value,
    label: document.querySelector('#music-toggle').getAttribute('aria-label'),
  }));
  if (restoredAudio.state.unlocked || restoredAudio.state.scheduling || restoredAudio.music !== '0' || restoredAudio.volume !== '35' || restoredAudio.slider !== '35') {
    throw new Error(`音量或静音没有记住 ${JSON.stringify(restoredAudio)}`);
  }
  if (restoredAudio.label !== '打开背景音乐') throw new Error(`音乐开关没有可读标签 ${restoredAudio.label}`);
  await page.click('#music-toggle');
  await sleep(200);
  const resumed = await page.evaluate(() => window.__xingya.audioState);
  if (!resumed.musicOn || !resumed.scheduling || resumed.volume !== 35 || resumed.contexts !== 1) {
    throw new Error(`重新打开音乐失败 ${JSON.stringify(resumed)}`);
  }
  await page.evaluate(() => window.__xingya.setPageAudible(false));
  await sleep(80);
  const hidden = await page.evaluate(() => window.__xingya.audioState);
  if (hidden.audible || hidden.scheduling || hidden.track !== 'idle') {
    throw new Error(`后台没有暂停音乐 ${JSON.stringify(hidden)}`);
  }
  await page.evaluate(() => window.__xingya.setPageAudible(true));
  await sleep(150);
  const shown = await page.evaluate(() => window.__xingya.audioState);
  if (!shown.musicOn || !shown.scheduling || shown.contexts !== 1) {
    throw new Error(`回到前台没有按偏好恢复 ${JSON.stringify(shown)}`);
  }
  const stacked = await page.evaluate(() => {
    window.__xingya.exerciseMusic(8);
    return window.__xingya.audioState;
  });
  if (stacked.contexts !== 1 || stacked.live > 48) {
    throw new Error(`反复切换堆叠了音频 ${JSON.stringify(stacked)}`);
  }
  await page.click('[data-act="continue"]');
  await page.waitForFunction(() => window.__xingya.mode === 'explore');
  await page.click('[data-act="menu"]');
  await page.click('[data-arg="elements"]');
  const rules = await page.$eval('.sheet-body', (el) => el.textContent);
  if (!rules.includes('金克木') || !rules.includes('纯阴')) throw new Error('五行说明不完整');
  await page.click('[data-arg="menu"]');
  await page.click('[data-arg="skilldex"]');
  await page.type('#skill-q', '叶刃');
  await sleep(80);
  const found = await page.$eval('#skill-results', (el) => el.textContent);
  if (!found.includes('叶刃') || !found.includes('480')) throw new Error(`技能检索不对 ${found.slice(0, 120)}`);
  await page.evaluate(() => {
    const mon = window.__xingya.play.team[0];
    mon.level = 24;
    mon.moves = [`${mon.aspect || 'yanghuo'}-basic-attack-0`];
  });
  await page.click('[data-arg="menu"]');
  await page.click('[data-arg="team"]');
  await page.click('[data-act="open-loadout"]');
  const divine = await page.evaluate(() => {
    const button = [...document.querySelectorAll('[data-act="equip-move"]')].find((el) => el.textContent.includes('神级'));
    return button ? button.getAttribute('data-arg') : '';
  });
  if (!divine) throw new Error('24 级没有出现神级技能');
  await page.click(`[data-act="equip-move"][data-arg="${divine}"]`);
  const equipped = await page.evaluate((id) => window.__xingya.play.team[0].moves.includes(id), divine);
  if (!equipped) throw new Error('神级技能没有装备上');
  await page.evaluate(() => {
    const mon = window.__xingya.play.team[0];
    const picks = ['攻击', '防御', '治疗', '状态'].map((label) => {
      const button = [...document.querySelectorAll('[data-act="equip-move"]')].find((el) => el.textContent.includes(`初级`) && el.textContent.includes(label));
      return button?.getAttribute('data-arg');
    }).filter(Boolean);
    mon.moves = picks;
    mon.hp = 999;
  });
  await page.click('[data-arg="team"]');
  await page.keyboard.press('Escape');
  await page.click('[data-act="close"]');
  await page.evaluate(() => {
    const game = window.__xingya;
    const wild = game.wilds.find((item) => item.speciesId === 'yanke');
    wild.mon.hp = 500;
    game.play.x = wild.x;
    game.play.y = wild.y;
    game.play.team[0].hp = 200;
  });
  await page.waitForSelector('[data-act="encounter-fight"]', { timeout: 4000 });
  await page.click('[data-act="encounter-fight"]');
  await page.waitForSelector('[data-act="battle-move"]');
  const effectLogs = [];
  for (let i = 0; i < 4; i += 1) {
    await page.waitForFunction(() => window.__xingya.canAct, { timeout: 4000 });
    const button = await page.$(`[data-act="battle-move"][data-arg="${i}"]`);
    if (!button) break;
    await button.click();
    await sleep(60);
    effectLogs.push(await page.$eval('.log', (el) => el.textContent));
  }
  const joined = effectLogs.join('\n');
  if (!/伤害|护盾|恢复|持续|定住|上升/.test(joined)) throw new Error(`五类技能没有打出可见效果 ${joined}`);
  const saveBeforePreview = await page.evaluate(() => localStorage.getItem('xingya-island-save-v1'));
  for (const file of ['iso.html', 'view3d.html']) {
    const previewPage = await browser.newPage();
    const previewErrors = [];
    previewPage.on('pageerror', (error) => previewErrors.push(String(error)));
    await previewPage.setViewport({ width: 390, height: 844 });
    await previewPage.goto(`http://127.0.0.1:${port}/starbud-island/${file}`, { waitUntil: 'networkidle0' });
    await previewPage.waitForSelector('canvas', { timeout: 8000 });
    await previewPage.keyboard.down('KeyD');
    await sleep(250);
    await previewPage.keyboard.up('KeyD');
    await previewPage.screenshot({ path: `${shotDir}/${file.replace('.html', '')}-390x844.png` });
    await previewPage.setViewport({ width: 844, height: 390 });
    await sleep(200);
    await previewPage.screenshot({ path: `${shotDir}/${file.replace('.html', '')}-844x390.png` });
    await previewPage.setViewport({ width: 320, height: 568 });
    await sleep(150);
    await previewPage.screenshot({ path: `${shotDir}/${file.replace('.html', '')}-320x568.png` });
    if (previewErrors.length) throw new Error(`${file} 报错 ${previewErrors.join('\n')}`);
    await previewPage.close();
  }
  const saveAfterPreview = await page.evaluate(() => localStorage.getItem('xingya-island-save-v1'));
  if (saveBeforePreview !== saveAfterPreview) throw new Error('预览页改动了原版存档');
  if (errors.length) throw new Error(`页面报错：${errors.join('\n')}`);
  await writeFile(`${shotDir}/result.json`, JSON.stringify({ ok: true, afterCatch, afterBattle }, null, 2));
  console.log('浏览器流程通过');
} catch (error) {
  console.error(error);
  console.error('页面错误', errors);
  console.error(previewLog.slice(-2000));
  process.exitCode = 1;
} finally {
  await Promise.race([browser.close(), sleep(1500)]);
  preview.kill('SIGKILL');
  setTimeout(() => process.exit(process.exitCode ?? 0), 200);
}
