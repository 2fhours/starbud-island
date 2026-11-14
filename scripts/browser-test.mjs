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
  const afterGesture = await page.evaluate(() => window.__xingya.audioState);
  if (!afterGesture.unlocked || afterGesture.contexts !== 1 || afterGesture.track !== 'explore' || !afterGesture.scheduling) {
    throw new Error(`点击开始后音乐没有解锁 ${JSON.stringify(afterGesture)}`);
  }
  await page.click('[data-arg="星旅"]');
  await page.click('[data-act="to-starter"]');
  await page.click('[data-arg="lujiao"]');
  await page.screenshot({ path: `${shotDir}/02-starter.png` });
  await page.click('[data-act="confirm-starter"]');
  for (let i = 0; i < 8; i += 1) {
    const next = await page.$('[data-act="dialogue-next"]');
    if (!next) break;
    await next.click();
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
  await sleep(800);
  const encounterFit = await page.evaluate(() => {
    const canvas = document.querySelector('.encounter-sheet canvas.portrait');
    const rect = canvas.getBoundingClientRect();
    const buttons = ['encounter-catch', 'encounter-fight', 'encounter-leave'].map((act) => {
      const button = document.querySelector(`[data-act="${act}"]`);
      const box = button.getBoundingClientRect();
      return { act, top: box.top, bottom: box.bottom, height: box.height };
    });
    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height * 0.62), 1, 1).data;
    return {
      tag: canvas.tagName,
      bw: canvas.width,
      bh: canvas.height,
      rw: rect.width,
      rh: rect.height,
      alpha: pixel[3],
      buttons,
      innerHeight: window.innerHeight,
    };
  });
  if (encounterFit.tag !== 'CANVAS' || encounterFit.bw > 512 || encounterFit.bh > 512 || encounterFit.rw > 180 || encounterFit.rh > 160) {
    throw new Error(`焰尾狐肖像尺寸异常 ${JSON.stringify(encounterFit)}`);
  }
  if (encounterFit.alpha < 20) throw new Error('焰尾狐肖像没有画出来');
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
    await assertInside(page, [['.stage canvas', '.stage']], `遭遇图片 ${width}x${height}`);
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
  }
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
    await page.screenshot({ path: `${shotDir}/capture-${width}x${height}.png` });
  }
  await page.setViewport({ width: 1280, height: 800 });
  await page.click('[data-act="throw"]');
  await page.waitForSelector('[data-act="dialogue-next"]', { timeout: 4000 });
  for (let i = 0; i < 8; i += 1) {
    const next = await page.$('[data-act="dialogue-next"]');
    if (!next) break;
    await next.click();
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
  await page.screenshot({ path: `${shotDir}/06-battle.png` });
  const battleControls = ['[data-act="battle-move"]', '[data-act="battle-catch"]', '[data-act="battle-run"]', '[data-act="toggle-switch"]', '#music-dock', '#build-tag'];
  await page.setViewport({ width: 390, height: 844 });
  await sleep(150);
  await page.evaluate(() => {
    const log = document.querySelector('.log');
    if (log) log.textContent = '野生的焰尾狐甩出很长的尾焰，火星一路溅到叶角鹿身上，这一回合的结果需要完整看完，不能把按钮顶出屏幕。';
  });
  await page.evaluate(() => {
    const el = document.getElementById('toast');
    el.textContent = '进度已保存在这台设备';
    el.classList.add('show');
  });
  await assertSeparated(page, [...battleControls, '#toast'], '竖屏战斗');
  await assertBattleGap(page, '竖屏战斗');
  await assertInside(page, [['.stage canvas', '.stage'], ['.battle-bottom canvas', '.battle-bottom'], ['.log', '.battle-sheet']], '竖屏战斗图片');
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    await page.setViewport({ width, height });
    await sleep(150);
    await assertSeparated(page, [...battleControls, '#toast'], `战斗 ${width}x${height}`);
    await assertBattleGap(page, `战斗 ${width}x${height}`);
    await assertInside(page, [['.stage canvas', '.stage'], ['.battle-bottom canvas', '.battle-bottom'], ['.log', '.battle-sheet']], `战斗图片 ${width}x${height}`);
    const logFit = await page.evaluate(() => {
      const log = document.querySelector('.log');
      const pet = document.querySelector('.battle-bottom');
      if (!log || !pet) return { gap: -1, line: 0 };
      const style = getComputedStyle(log);
      const padTop = parseFloat(style.paddingTop) || 0;
      const padBottom = parseFloat(style.paddingBottom) || 0;
      const box = log.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(log);
      const contentTop = box.top + padTop;
      const contentBottom = box.bottom - padBottom;
      const line = Math.max(0, ...[...range.getClientRects()].map((rect) => Math.min(rect.bottom, contentBottom) - Math.max(rect.top, contentTop)));
      return { gap: pet.getBoundingClientRect().top - box.bottom, line };
    });
    if (logFit.gap < 6 || logFit.line < 12) throw new Error(`战斗日志挤到伙伴信息上 ${width}x${height} ${JSON.stringify(logFit)}`);
    await page.screenshot({ path: `${shotDir}/battle-${width}x${height}.png` });
  }
  await page.screenshot({ path: `${shotDir}/06b-battle-landscape.png` });
  await page.addStyleTag({ content: 'body.font-boost, body.font-boost button, body.font-boost .hud-copy strong { font-size: 20px; }' });
  await page.evaluate(() => document.body.classList.add('font-boost'));
  for (const [width, height] of [[320, 568], [844, 390]]) {
    await page.setViewport({ width, height });
    await sleep(120);
    await assertBattleGap(page, `大字战斗 ${width}x${height}`);
    await assertInside(page, [['.stage canvas', '.stage'], ['.battle-bottom canvas', '.battle-bottom']], `大字战斗图片 ${width}x${height}`);
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
  await page.click('[data-act="battle-move"]');
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
  await sleep(200);
  await page.keyboard.press('KeyE');
  await page.waitForSelector('[data-act="heal-yes"]', { timeout: 3000 });
  await page.click('[data-act="heal-yes"]');
  for (let i = 0; i < 4; i += 1) {
    const next = await page.$('[data-act="dialogue-next"]');
    if (!next) break;
    await next.click();
    await sleep(30);
  }
  const healed = await page.evaluate(() => window.__xingya.play.team[0].hp > 1);
  if (!healed) throw new Error('治疗没有恢复体力');

  await page.click('[data-act="menu"]');
  await page.click('[data-arg="team"]');
  await page.screenshot({ path: `${shotDir}/07-team.png` });
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    await page.setViewport({ width, height });
    await sleep(80);
    await assertInside(page, [['.mon-card canvas', '.mon-card']], `队伍图片 ${width}x${height}`);
    await page.screenshot({ path: `${shotDir}/team-${width}x${height}.png` });
  }
  await page.setViewport({ width: 1280, height: 800 });
  await page.click('[data-arg="menu"]');
  await page.click('[data-arg="dex"]');
  await page.screenshot({ path: `${shotDir}/08-dex.png` });
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    await page.setViewport({ width, height });
    await sleep(80);
    await assertInside(page, [['.dex-card canvas', '.dex-card']], `图鉴图片 ${width}x${height}`);
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
