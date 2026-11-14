import { APP_VERSION } from './version';

const canvasEl = document.querySelector('#iso');
const note = document.querySelector('#iso-version');
if (note) note.textContent = `v${APP_VERSION} · 2.5D`;
if (!(canvasEl instanceof HTMLCanvasElement)) throw new Error('缺少预览画布');
const canvas: HTMLCanvasElement = canvasEl;
const context = canvas.getContext('2d');
if (!context) throw new Error('无法绘制 2.5D 预览');
const ctx: CanvasRenderingContext2D = context;

const tileW = 64;
const tileH = 32;
const cols = 10;
const rows = 8;
let player = { x: 3, y: 4, z: 0 };
let pet = { x: 2.4, y: 4.2, z: 0 };
let camX = 0;
let camY = 0;
let keys = new Set<string>();
let drag: { x: number; y: number; id: number } | null = null;
let raf = 0;

const trees = [{ x: 1, y: 1 }, { x: 6, y: 2 }, { x: 8, y: 5 }, { x: 2, y: 6 }];
const blocked = new Set(trees.map((tree) => `${tree.x},${tree.y}`).concat(['4,3']));

function project(x: number, y: number, z: number): { x: number; y: number } {
  return { x: (x - y) * tileW * 0.5, y: (x + y) * tileH * 0.5 - z };
}

function resize(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawGround(): void {
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const p = project(x, y, 0);
      const water = x > 7;
      const road = y === 4 && x < 8;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + tileW / 2, p.y + tileH / 2);
      ctx.lineTo(p.x, p.y + tileH);
      ctx.lineTo(p.x - tileW / 2, p.y + tileH / 2);
      ctx.closePath();
      ctx.fillStyle = water ? '#67c3d4' : road ? '#e7d3a4' : (x + y) % 2 ? '#8dce78' : '#79c468';
      ctx.fill();
    }
  }
}

function drawTree(x: number, y: number): void {
  const p = project(x, y, 0);
  ctx.fillStyle = 'rgba(60,42,34,0.18)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 20, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a5a32';
  ctx.fillRect(p.x - 4, p.y - 8, 8, 24);
  ctx.fillStyle = '#2f9a5a';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 16, 18, 0, Math.PI * 2);
  ctx.fill();
}

function drawHouse(): void {
  const p = project(4, 3, 0);
  ctx.fillStyle = 'rgba(60,42,34,0.18)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 28, 28, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f3d2b0';
  ctx.beginPath();
  ctx.moveTo(p.x - 26, p.y + 10);
  ctx.lineTo(p.x + 26, p.y + 10);
  ctx.lineTo(p.x + 18, p.y - 24);
  ctx.lineTo(p.x - 18, p.y - 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ef6844';
  ctx.beginPath();
  ctx.moveTo(p.x - 22, p.y - 20);
  ctx.lineTo(p.x, p.y - 40);
  ctx.lineTo(p.x + 22, p.y - 20);
  ctx.closePath();
  ctx.fill();
}

function drawActor(x: number, y: number, color: string, ears = false): void {
  const p = project(x, y, 18);
  ctx.fillStyle = 'rgba(60,42,34,0.2)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 16, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
  ctx.fill();
  if (ears) {
    ctx.fillStyle = '#67b85a';
    ctx.beginPath();
    ctx.ellipse(p.x - 7, p.y - 12, 3, 7, -0.4, 0, Math.PI * 2);
    ctx.ellipse(p.x + 7, p.y - 12, 3, 7, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function blockedAt(x: number, y: number): boolean {
  if (x < 0.2 || y < 0.2 || x > cols - 1.2 || y > rows - 1.2) return true;
  return blocked.has(`${Math.round(x)},${Math.round(y)}`);
}

function frame(now: number): void {
  const dt = 0.016;
  let dx = 0;
  let dy = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  const nextX = player.x + dx * dt * 2.2;
  const nextY = player.y + dy * dt * 2.2;
  if (!blockedAt(nextX, player.y)) player.x = nextX;
  if (!blockedAt(player.x, nextY)) player.y = nextY;
  pet.x += (player.x - 0.7 - pet.x) * 0.08;
  pet.y += (player.y + 0.2 - pet.y) * 0.08;
  const focus = project(player.x, player.y, 0);
  camX += (canvas.clientWidth / 2 - focus.x - camX) * 0.12;
  camY += (canvas.clientHeight / 2 - focus.y - camY) * 0.12;
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.save();
  ctx.translate(camX, camY);
  drawGround();
  const sprites: { y: number; draw: () => void }[] = [
    ...trees.map((tree) => ({ y: tree.x + tree.y, draw: () => drawTree(tree.x, tree.y) })),
    { y: 4 + 3, draw: drawHouse },
    { y: player.x + player.y, draw: () => drawActor(player.x, player.y, '#3c2a22') },
    { y: pet.x + pet.y + 0.01, draw: () => drawActor(pet.x, pet.y, '#f3d7b0', true) },
  ];
  sprites.sort((a, b) => a.y - b.y);
  for (const sprite of sprites) sprite.draw();
  ctx.restore();
  raf = requestAnimationFrame(frame);
  void now;
}

window.addEventListener('keydown', (event) => keys.add(event.code));
window.addEventListener('keyup', (event) => keys.delete(event.code));
canvas.addEventListener('pointerdown', (event) => {
  drag = { x: event.clientX, y: event.clientY, id: event.pointerId };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag || drag.id !== event.pointerId) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (Math.hypot(dx, dy) < 12) return;
  keys.delete('KeyW');
  keys.delete('KeyA');
  keys.delete('KeyS');
  keys.delete('KeyD');
  if (Math.abs(dx) > Math.abs(dy)) keys.add(dx > 0 ? 'KeyD' : 'KeyA');
  else keys.add(dy > 0 ? 'KeyS' : 'KeyW');
});
const endDrag = (event: PointerEvent) => {
  if (!drag || drag.id !== event.pointerId) return;
  drag = null;
  keys.clear();
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
window.addEventListener('resize', resize);
window.addEventListener('pagehide', () => cancelAnimationFrame(raf));
resize();
raf = requestAnimationFrame(frame);
