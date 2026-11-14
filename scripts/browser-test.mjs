import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

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
  await page.click('[data-act="new-game"]');
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
  await page.screenshot({ path: `${shotDir}/04-encounter.png` });
  await page.click('[data-act="encounter-catch"]');
  await page.waitForSelector('#catch-ring');
  await sleep(80);
  await page.screenshot({ path: `${shotDir}/05-capture.png` });
  await page.click('[data-act="throw"]');
  await page.waitForSelector('[data-act="shake-skip"], [data-act="dialogue-next"]');
  const skip = await page.$('[data-act="shake-skip"]');
  if (skip) await skip.click();
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
  await page.screenshot({ path: `${shotDir}/06-battle.png` });
  await page.click('[data-act="battle-move"]');
  await page.waitForFunction(() => window.__xingya.mode === 'dialogue', { timeout: 5000 });
  for (let i = 0; i < 6; i += 1) {
    const next = await page.$('[data-act="dialogue-next"]');
    if (!next) break;
    await next.click();
    await sleep(30);
  }
  const afterBattle = await page.evaluate(() => ({
    mode: window.__xingya.mode,
    level: window.__xingya.play.team[0].level,
    hp: window.__xingya.play.team[0].hp,
  }));
  if (afterBattle.mode !== 'explore' || afterBattle.level < 5) throw new Error(`战斗结果不对 ${JSON.stringify(afterBattle)}`);

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
  await page.click('[data-arg="menu"]');
  await page.click('[data-arg="dex"]');
  await page.screenshot({ path: `${shotDir}/08-dex.png` });
  await page.click('[data-arg="menu"]');
  await page.click('[data-act="save"]');
  await page.click('[data-act="title"]');
  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('[data-act="continue"]');
  await page.waitForFunction(() => window.__xingya.mode === 'explore');
  const restored = await page.evaluate(() => window.__xingya.play.team.length);
  if (restored !== 2) throw new Error('读档没有恢复队伍');

  await page.setViewport({ width: 390, height: 844 });
  await sleep(200);
  await page.screenshot({ path: `${shotDir}/09-mobile.png` });
  const touchVisible = await page.evaluate(() => getComputedStyle(document.querySelector('#touch')).display !== 'none');
  if (!touchVisible) throw new Error('窄屏没有显示触控操作');

  await page.setViewport({ width: 1280, height: 800 });
  await page.click('[data-act="menu"]');
  await page.click('[data-act="ask-reset"]');
  await page.screenshot({ path: `${shotDir}/10-reset.png` });
  await page.click('[data-act="confirm-reset"]');
  const cleared = await page.evaluate(() => localStorage.getItem('xingya-island-save-v1'));
  if (cleared) throw new Error('存档没有被清除');
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
