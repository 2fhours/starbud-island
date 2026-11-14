import { getSpecies, TYPE_META } from './data';
import type { Dir, SpeciesId } from './types';
import { TILE, hash } from './world';

export const FONT = '"WenQuanYi Micro Hei", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", "Droid Sans Fallback", sans-serif';

export const PORTRAIT_CSS = { w: 156, h: 138 };
export const MAX_CANVAS_EDGE = 512;

export function canvasBitmapSize(cssW: number, cssH: number, dpr: number): { w: number; h: number } {
  const scale = Math.min(2, Math.max(1, Number.isFinite(dpr) && dpr > 0 ? dpr : 1));
  const w = Math.max(1, Math.min(MAX_CANVAS_EDGE, Math.floor(cssW * scale)));
  const h = Math.max(1, Math.min(MAX_CANVAS_EDGE, Math.floor(cssH * scale)));
  return { w, h };
}

function orb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  light: string,
  shade: string,
): void {
  const g = ctx.createRadialGradient(x - rx * 0.32, y - ry * 0.38, Math.min(rx, ry) * 0.12, x + rx * 0.05, y + ry * 0.08, Math.max(rx, ry));
  g.addColorStop(0, light);
  g.addColorStop(0.72, shade);
  g.addColorStop(1, shade);
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.6, rx), Math.max(0.6, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  const g = ctx.createRadialGradient(x, y, 1, x, y, Math.max(rx, ry));
  g.addColorStop(0, 'rgba(62, 42, 24, 0.28)');
  g.addColorStop(1, 'rgba(62, 42, 24, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number, r = 3.2): void {
  const blink = Math.sin(time * 2.1 + seed) > 0.972;
  ctx.save();
  ctx.fillStyle = '#fffdf8';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.15, r * 1.22, 0, 0, Math.PI * 2);
  ctx.fill();
  if (blink) {
    ctx.strokeStyle = '#3a2a22';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.quadraticCurveTo(x, y + 1.2, x + r, y);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#2a211c';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.08, y + r * 0.06, r * 0.62, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - r * 0.18, y - r * 0.28, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function cheek(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  orb(ctx, x, y, 3.4, 2.2, 'rgba(255, 170, 170, 0.7)', 'rgba(255, 120, 130, 0.15)');
}

function lockBox(canvas: HTMLCanvasElement, cssW: number, cssH: number): { w: number; h: number; dpr: number } {
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.style.maxWidth = '100%';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const bitmap = canvasBitmapSize(cssW, cssH, dpr);
  if (canvas.width !== bitmap.w || canvas.height !== bitmap.h) {
    canvas.width = bitmap.w;
    canvas.height = bitmap.h;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }
  return { w: cssW, h: cssH, dpr: bitmap.w / cssW };
}

function fallbackCreature(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  orb(ctx, w / 2, h * 0.62, w * 0.22, h * 0.18, '#ffe7c8', '#e7b184');
  orb(ctx, w / 2, h * 0.46, w * 0.16, h * 0.14, '#fff6ea', '#f0c8a4');
  ctx.fillStyle = '#3c2a22';
  ctx.beginPath();
  ctx.arc(w / 2 - 8, h * 0.46, 2.4, 0, Math.PI * 2);
  ctx.arc(w / 2 + 8, h * 0.46, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

export function drawTile(ctx: CanvasRenderingContext2D, tile: number, x: number, y: number, gx: number, gy: number, time: number): void {
  const n = hash(gx, gy);
  if (tile === 0) ctx.fillStyle = n > 0.55 ? '#2f86b0' : '#277aa4';
  else if (tile === 1) ctx.fillStyle = n > 0.5 ? '#63c6e4' : '#4eb6d8';
  else if (tile === 2) ctx.fillStyle = n > 0.62 ? '#f6d7a6' : '#efcf98';
  else if (tile === 4) ctx.fillStyle = n > 0.5 ? '#4f9a46' : '#3f8a3c';
  else if (tile === 5) ctx.fillStyle = '#e4c48e';
  else if (tile === 6) ctx.fillStyle = '#6aaa52';
  else if (tile === 7 || tile === 8) ctx.fillStyle = '#f3dcb4';
  else ctx.fillStyle = n > 0.66 ? '#9ed67f' : n > 0.33 ? '#8dcc72' : '#7ec466';
  ctx.fillRect(x, y, TILE + 0.6, TILE + 0.6);
  if (tile === 0 || tile === 1) {
    const wobble = Math.sin(time * 1.6 + gx * 0.7 + gy) * 3;
    orb(ctx, x + 16 + wobble, y + 18, 10, 3.2, 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)');
    orb(ctx, x + 34 - wobble * 0.6, y + 32, 7, 2.2, 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)');
    if (tile === 1) orb(ctx, x + 22, y + 40, 8, 2.4, 'rgba(186, 236, 196, 0.45)', 'rgba(186, 236, 196, 0)');
  } else if (tile === 3 || tile === 4 || tile === 6) {
    for (let i = 0; i < 4; i += 1) {
      const bx = x + 8 + ((gx * 7 + i * 11) % 30);
      const by = y + 16 + ((gy * 5 + i * 9) % 22);
      const tall = 7 + (i % 3);
      orb(ctx, bx, by, 1.6, tall * 0.45, tile === 4 ? '#2f6a32' : '#f4ffe8', tile === 4 ? '#1d4a24' : '#b7e39a');
    }
    if (n > 0.78) orb(ctx, x + 20, y + 14, 3.2, 2.2, '#ffe38a', '#f2c14e');
  } else if (tile === 2 || tile === 5 || tile === 7) {
    if (n > 0.45) orb(ctx, x + 14, y + 22, 5, 3, 'rgba(255,255,255,0.28)', 'rgba(196, 150, 90, 0)');
    if (n > 0.72) orb(ctx, x + 32, y + 16, 3.5, 2.4, '#e7d3b0', '#c9a67a');
  }
  if (tile === 8) {
    ctx.fillStyle = '#d7b07a';
    ctx.beginPath();
    ctx.roundRect(x + 8, y + 34, TILE - 16, 8, 4);
    ctx.fill();
  }
}

export function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number, time: number): void {
  const sway = Math.sin(time * 1.3 + x * 0.02) * 2.2;
  shadow(ctx, x, y + 2, 18, 6);
  const trunk = ctx.createLinearGradient(x - 5, y - 28, x + 6, y);
  trunk.addColorStop(0, '#c48a5a');
  trunk.addColorStop(1, '#6d4128');
  ctx.fillStyle = trunk;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 8);
  ctx.quadraticCurveTo(x - 5, y - 24, x - 2, y - 30);
  ctx.lineTo(x + 3, y - 30);
  ctx.quadraticCurveTo(x + 6, y - 18, x + 5, y - 6);
  ctx.closePath();
  ctx.fill();
  const greens = variant
    ? ['#1f6a3a', '#2f8a4c', '#57b86a', '#b7e7a4']
    : ['#2c7a44', '#3f9a58', '#6cc87a', '#d5f2bf'];
  orb(ctx, x - 8 + sway, y - 28, 14, 12, greens[2], greens[0]);
  orb(ctx, x + 10 + sway, y - 26, 13, 11, greens[2], greens[1]);
  orb(ctx, x + sway * 0.4, y - 40, 16, 13, greens[3], greens[1]);
  orb(ctx, x - 4 + sway, y - 46, 6, 3.4, 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)');
}

export function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number): void {
  shadow(ctx, x, y, 14, 5);
  orb(ctx, x + 2, y - 7, variant ? 15 : 12, 9, '#efe6da', '#9a8d80');
  orb(ctx, x - 4, y - 12, 6, 4, '#fff', '#d9d0c4');
  orb(ctx, x + 6, y - 13, 3.2, 1.8, '#7dbe68', '#3f8a44');
}

export function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number, time: number): void {
  const bob = Math.sin(time * 2 + x) * 1.4;
  ctx.strokeStyle = '#3d8a48';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 1, y - 6, x, y - 11 + bob);
  ctx.stroke();
  const colors = [
    ['#ffd0e0', '#e85b8a'],
    ['#fff3bf', '#f0b429'],
    ['#ffffff', '#d7e4ff'],
  ];
  const pair = colors[variant % 3];
  for (let i = 0; i < 5; i += 1) {
    const a = (Math.PI * 2 * i) / 5;
    orb(ctx, x + Math.cos(a) * 3.2, y - 13 + bob + Math.sin(a) * 3.2, 2.5, 3.4, pair[0], pair[1]);
  }
  orb(ctx, x, y - 13 + bob, 1.8, 1.8, '#fff6df', '#f0b429');
}

export function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, roof: string): void {
  const width = w * TILE;
  const height = h * TILE;
  shadow(ctx, x + width / 2, y + height - 2, width * 0.42, 8);
  const wall = ctx.createLinearGradient(x, y, x, y + height);
  wall.addColorStop(0, '#fffaf3');
  wall.addColorStop(1, '#f0d8c0');
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.roundRect(x + 8, y + height * 0.4, width - 16, height * 0.56, 10);
  ctx.fill();
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 2, y + height * 0.48);
  ctx.quadraticCurveTo(x + width / 2, y - 16, x + width + 2, y + height * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y + 2);
  ctx.lineTo(x + width * 0.78, y + height * 0.42);
  ctx.lineTo(x + width / 2, y + height * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6d4128';
  ctx.beginPath();
  ctx.roundRect(x + width / 2 - 8, y + height * 0.62, 16, height * 0.34, 3);
  ctx.fill();
  ctx.fillStyle = '#cfeefb';
  ctx.beginPath();
  ctx.roundRect(x + 16, y + height * 0.54, 14, 12, 3);
  ctx.roundRect(x + width - 30, y + height * 0.54, 14, 12, 3);
  ctx.fill();
}

export function drawShrine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number): void {
  const width = w * TILE;
  const height = h * TILE;
  shadow(ctx, x + width / 2, y + height - 2, width * 0.46, 8);
  const wall = ctx.createLinearGradient(x, y, x, y + height);
  wall.addColorStop(0, '#fffdf8');
  wall.addColorStop(1, '#f3e2cf');
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 30, width - 20, height - 34, 12);
  ctx.fill();
  const roof = ctx.createLinearGradient(x, y, x + width, y + 40);
  roof.addColorStop(0, '#2f8a4c');
  roof.addColorStop(1, '#67c36a');
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 40);
  ctx.quadraticCurveTo(x + width / 2, y - 2, x + width + 4, y + 40);
  ctx.closePath();
  ctx.fill();
  const sway = Math.sin(time * 2.4) * 1.6;
  orb(ctx, x + width / 2 - 6, y + 54 + sway, 8, 12, '#b6e89a', '#3f9d5d');
  orb(ctx, x + width / 2 + 7, y + 52 - sway, 8, 12, '#7dcb6e', '#2f7d45');
  ctx.fillStyle = '#6d4128';
  ctx.beginPath();
  ctx.roundRect(x + width / 2 - 9, y + height - 30, 18, 26, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('驿', x + width / 2, y + 34);
}

export function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  shadow(ctx, x, y + 2, 10, 3.5);
  ctx.fillStyle = '#8a5a3a';
  ctx.fillRect(x - 2, y - 18, 4, 18);
  ctx.fillStyle = '#fff8ef';
  ctx.beginPath();
  ctx.roundRect(x - 16, y - 34, 32, 16, 5);
  ctx.fill();
  ctx.fillStyle = '#ef6844';
  ctx.fillRect(x - 10, y - 29, 20, 3);
}

export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const bob = Math.sin(time * 3) * 2;
  shadow(ctx, x, y + 2, 9, 3.2);
  orb(ctx, x, y - 12 + bob, 10, 10, '#ffe08a', '#e09a14');
  ctx.fillStyle = '#2f8a4c';
  ctx.beginPath();
  ctx.arc(x, y - 12 + bob, 10, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = '#fff8ef';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 12 + bob);
  ctx.lineTo(x + 10, y - 12 + bob);
  ctx.stroke();
  orb(ctx, x, y - 12 + bob, 3.2, 3.2, '#fff', '#d7efe0');
  ctx.strokeStyle = '#3f9d5d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 20 + bob);
  ctx.quadraticCurveTo(x + 7, y - 28 + bob, x + 3, y - 32 + bob);
  ctx.stroke();
}

export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, dir: Dir, moving: boolean, time: number): void {
  const step = moving ? Math.sin(time * 10) * 3 : 0;
  const bob = Math.sin(time * 2) * 1.1;
  shadow(ctx, x, y + 2, 13, 5);
  ctx.save();
  ctx.translate(x, y + bob);
  if (dir === 'left') ctx.scale(-1, 1);
  const side = dir === 'left' || dir === 'right';
  orb(ctx, -4 + step, -4, 4.2, 6, '#6a5144', '#3a2a24');
  orb(ctx, 4 - step, -4, 4.2, 6, '#6a5144', '#3a2a24');
  const tunic = ctx.createLinearGradient(0, -28, 0, -8);
  tunic.addColorStop(0, '#b7ebe4');
  tunic.addColorStop(1, '#3f9d8f');
  ctx.fillStyle = tunic;
  ctx.beginPath();
  ctx.roundRect(-10, -26, 20, 18, 8);
  ctx.fill();
  ctx.fillStyle = '#ef6844';
  ctx.beginPath();
  ctx.ellipse(0, -22, 8, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (dir === 'up') {
    orb(ctx, 0, -34, 9, 8.5, '#f6d2b4', '#e0b08a');
    orb(ctx, 0, -39, 9, 6, '#7a4e36', '#3d2a24');
  } else {
    orb(ctx, side ? 2 : 0, -34, 8.6, 8.4, '#ffe0c4', '#e7b48e');
    orb(ctx, side ? 1 : 0, -39, 9, 5.5, '#6b4332', '#3a271e');
    orb(ctx, -3, -44, 3.2, 5, '#3f9d5d', '#217846');
    eye(ctx, side ? 5 : -3.2, -34, time, 1, 2.1);
    if (!side) eye(ctx, 3.2, -34, time, 1.4, 2.1);
    cheek(ctx, side ? 7 : -7, -31);
  }
  ctx.restore();
}

export function drawNpc(ctx: CanvasRenderingContext2D, x: number, y: number, id: string, time: number): void {
  const bob = Math.sin(time * 2 + y) * 1.1;
  shadow(ctx, x, y + 2, 13, 5);
  ctx.save();
  ctx.translate(x, y + bob);
  if (id === 'grandma') {
    const robe = ctx.createLinearGradient(0, -30, 0, -6);
    robe.addColorStop(0, '#d7ebc4');
    robe.addColorStop(1, '#5f8a55');
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.roundRect(-11, -28, 22, 22, 9);
    ctx.fill();
    orb(ctx, 0, -34, 8.2, 8, '#ffe0c8', '#e2b898');
    orb(ctx, 0, -40, 8, 4.6, '#fff', '#efe6dc');
    ctx.strokeStyle = '#8a5a3a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, -8);
    ctx.quadraticCurveTo(14, -16, 11, -24);
    ctx.stroke();
    eye(ctx, -3, -34, time, 2, 1.7);
    eye(ctx, 3, -34, time, 2.2, 1.7);
  } else if (id === 'qinghe') {
    const coat = ctx.createLinearGradient(0, -32, 0, -8);
    coat.addColorStop(0, '#8fd4ea');
    coat.addColorStop(1, '#2f8eb8');
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.roundRect(-10, -30, 20, 22, 8);
    ctx.fill();
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(-9, -26, 18, 4);
    orb(ctx, 0, -38, 8, 8, '#ffe0c4', '#e7b48e');
    orb(ctx, 0, -43, 8.4, 4.8, '#4a342c', '#2a1c18');
    eye(ctx, -3, -38, time, 3, 2);
    eye(ctx, 3, -38, time, 3.2, 2);
  } else {
    const coat = ctx.createLinearGradient(0, -40, 0, -8);
    coat.addColorStop(0, '#c45a52');
    coat.addColorStop(1, '#6d2e2c');
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.roundRect(-12, -36, 24, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#efc14a';
    ctx.fillRect(-9, -38, 18, 4);
    orb(ctx, 0, -44, 8.2, 8, '#f6d2b4', '#e0b08a');
    orb(ctx, 0, -49, 8.4, 4.4, '#3a2a24', '#1c1412');
    eye(ctx, -3, -44, time, 4, 2);
    eye(ctx, 3, -44, time, 4.2, 2);
  }
  ctx.restore();
}

function drawSpecies(ctx: CanvasRenderingContext2D, id: SpeciesId, time: number): void {
  const wag = Math.sin(time * 5.5) * 3.5;
  if (id === 'lujiao') {
    orb(ctx, -2, -12, 7, 8, '#f7e7cf', '#e2c49a');
    orb(ctx, 4, -12, 7, 8, '#f7e7cf', '#e2c49a');
    orb(ctx, 0, -18, 16, 11, '#fff6ea', '#e7cba6');
    orb(ctx, -6, -16, 2.2, 1.4, '#e7c98a', '#c9a15a');
    orb(ctx, 2, -14, 2.2, 1.4, '#e7c98a', '#c9a15a');
    orb(ctx, 12, -30, 8.5, 7.4, '#fff8ef', '#f0d2b0');
    orb(ctx, 18, -26, 3.6, 2.6, '#f3b7b0', '#e08a86');
    ctx.fillStyle = '#3aaa55';
    ctx.beginPath();
    ctx.moveTo(8, -36);
    ctx.quadraticCurveTo(2, -52, 13, -48);
    ctx.quadraticCurveTo(10, -40, 15, -34);
    ctx.fill();
    ctx.fillStyle = '#7dcb6e';
    ctx.beginPath();
    ctx.moveTo(14, -34);
    ctx.quadraticCurveTo(24, -50, 16, -54);
    ctx.quadraticCurveTo(18, -42, 12, -34);
    ctx.fill();
    eye(ctx, 14, -31, time, 4, 2.3);
    cheek(ctx, 18, -27);
  } else if (id === 'yanwei') {
    const flame = ctx.createRadialGradient(-20, -22 + wag, 2, -16, -18, 14);
    flame.addColorStop(0, '#fff3a0');
    flame.addColorStop(0.42, '#ff7a22');
    flame.addColorStop(1, '#d63a1e');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.quadraticCurveTo(-30, -14 + wag, -18, -30 + wag);
    ctx.quadraticCurveTo(-10, -20, -6, -12);
    ctx.closePath();
    ctx.fill();
    orb(ctx, -6, -6, 3.2, 4.2, '#ffb067', '#c45122');
    orb(ctx, 6, -6, 3.2, 4.2, '#ffb067', '#c45122');
    orb(ctx, -1, -16, 13, 8.5, '#ffb15a', '#e85a28');
    orb(ctx, 3, -15, 5.5, 4.2, '#ffd0aa', '#ffb07a');
    orb(ctx, 13, -28, 8, 7, '#ffc48a', '#f06a32');
    ctx.fillStyle = '#ff8a4a';
    ctx.beginPath();
    ctx.moveTo(8, -33);
    ctx.lineTo(11, -42);
    ctx.lineTo(15, -33);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -32);
    ctx.lineTo(18, -41);
    ctx.lineTo(20, -31);
    ctx.closePath();
    ctx.fill();
    orb(ctx, 18, -26, 3.2, 2.4, '#ffe0c8', '#ffb48a');
    ctx.fillStyle = '#5b3a2a';
    ctx.beginPath();
    ctx.arc(19.2, -25.2, 1.1, 0, Math.PI * 2);
    ctx.fill();
    eye(ctx, 14, -29, time, 5, 2.2);
    cheek(ctx, 17, -25);
  } else if (id === 'luzhu') {
    orb(ctx, -8, -8, 5, 4, '#7ee0c8', '#2f9a86');
    orb(ctx, 8, -8, 5, 4, '#7ee0c8', '#2f9a86');
    orb(ctx, 0, -16, 16, 13, '#b8fff0', '#2fbfa8');
    orb(ctx, 0, -12, 9, 7, '#fbfffb', '#d7f5ea');
    eye(ctx, -5, -18, time, 6, 3.5);
    eye(ctx, 5, -18, time, 6.4, 3.5);
    cheek(ctx, -10, -13);
    cheek(ctx, 10, -13);
    orb(ctx, 0, -30, 5.2, 6.2, 'rgba(255,255,255,0.95)', 'rgba(120, 210, 240, 0.35)');
    ctx.strokeStyle = 'rgba(90, 180, 210, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, -30, 5.2, 6.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (id === 'dianrong') {
    orb(ctx, 0, -16, 14, 12, '#fff1a8', '#f0b429');
    orb(ctx, 11, -26, 7.5, 6.4, '#fff7c8', '#ffd24a');
    orb(ctx, 6, -34, 4.2, 4.2, '#ffe98a', '#f0b429');
    orb(ctx, 15, -34, 4.2, 4.2, '#ffe98a', '#f0b429');
    ctx.strokeStyle = '#e08a12';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(-15, -20 + wag);
    ctx.lineTo(-7, -22 + wag * 0.4);
    ctx.lineTo(-16, -32 + wag);
    ctx.stroke();
    orb(ctx, -5, -15, 3.1, 2.1, '#ffd0d0', '#ff6b6b');
    orb(ctx, 4, -15, 3.1, 2.1, '#ffd0d0', '#ff6b6b');
    eye(ctx, 12, -27, time, 7, 2.15);
    if (Math.sin(time * 16) > 0.15) {
      ctx.strokeStyle = '#fff4b0';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(18, -32);
      ctx.lineTo(23, -37);
      ctx.moveTo(-10, -30);
      ctx.lineTo(-15, -35);
      ctx.stroke();
    }
  } else if (id === 'yanke') {
    orb(ctx, 0, -8, 16, 8, '#9dce86', '#5f9a4e');
    orb(ctx, -6, -16, 10, 8, '#e7c09a', '#a86b3c');
    orb(ctx, 4, -18, 12, 9, '#f0d2b0', '#c4894f');
    ctx.strokeStyle = '#8a5a32';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-8, -22);
    ctx.quadraticCurveTo(0, -12, 8, -23);
    ctx.moveTo(0, -24);
    ctx.lineTo(0, -10);
    ctx.stroke();
    orb(ctx, -2, -20, 4, 2.4, 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)');
    orb(ctx, 14, -12, 6.5, 5.2, '#c8ecb0', '#5fa85a');
    eye(ctx, 15, -13, time, 8, 1.8);
  } else if (id === 'fengling') {
    orb(ctx, -12, -16 + wag * 0.15, 9, 5.5, '#d7f0ff', '#6eb4e6');
    orb(ctx, 12, -16 - wag * 0.15, 9, 5.5, '#d7f0ff', '#6eb4e6');
    orb(ctx, 0, -18, 12, 10, '#ffffff', '#d5e7f5');
    ctx.fillStyle = '#f2c14d';
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.quadraticCurveTo(0, 4, 7, -8);
    ctx.closePath();
    ctx.fill();
    orb(ctx, 0, 0, 2.2, 2.2, '#fff', '#f2c14d');
    ctx.fillStyle = '#ffb4c8';
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(-4, -36);
    ctx.lineTo(3, -30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f29a3a';
    ctx.beginPath();
    ctx.moveTo(8, -18);
    ctx.lineTo(17, -15);
    ctx.lineTo(8, -13);
    ctx.closePath();
    ctx.fill();
    eye(ctx, 4, -20, time, 9, 2.3);
  } else if (id === 'taibei') {
    orb(ctx, 0, -16, 18, 14, '#f0c29a', '#a86b4a');
    orb(ctx, 0, -22, 13, 9, '#c6e7a4', '#4f9a46');
    orb(ctx, 5, -30, 3.4, 2.6, '#ffd0d0', '#e25b5b');
    ctx.fillStyle = '#fff';
    ctx.fillRect(4.2, -31, 1.6, 4);
    orb(ctx, -9, -30, 4.2, 4.2, '#e7b48e', '#8d5a40');
    orb(ctx, 9, -30, 4.2, 4.2, '#e7b48e', '#8d5a40');
    orb(ctx, 0, -12, 6, 4, '#fff1e0', '#e7c4a4');
    eye(ctx, -4, -18, time, 10, 2.2);
    eye(ctx, 5, -18, time, 10.4, 2.2);
  } else {
    orb(ctx, -2, -14, 16, 9, '#c89674', '#7a4e36');
    orb(ctx, -2, -11, 10, 5, '#fff1e0', '#f0d2b4');
    orb(ctx, 12, -22, 7.4, 6.2, '#e2b08a', '#8a5a42');
    const tail = ctx.createLinearGradient(-22, -8, -8, -16);
    tail.addColorStop(0, '#7ec8ea');
    tail.addColorStop(1, '#3a6f92');
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(-12, -12);
    ctx.quadraticCurveTo(-26, -6 + wag, -18, 0);
    ctx.quadraticCurveTo(-10, -6, -8, -12);
    ctx.fill();
    eye(ctx, 14, -23, time, 11, 2.1);
    ctx.strokeStyle = '#6b4636';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(18, -20);
    ctx.lineTo(24, -18);
    ctx.moveTo(18, -22);
    ctx.lineTo(24, -24);
    ctx.stroke();
  }
}

export function drawCreature(
  ctx: CanvasRenderingContext2D,
  id: SpeciesId,
  x: number,
  y: number,
  time: number,
  scale = 1,
  flip = false,
  faint = false,
): void {
  ctx.save();
  ctx.translate(x, y + Math.sin(time * 3 + x) * 1.2);
  ctx.scale(flip ? -scale : scale, scale);
  if (faint) ctx.filter = 'grayscale(0.85) brightness(0.92)';
  shadow(ctx, 0, 2, 16, 6);
  try {
    drawSpecies(ctx, id, time);
  } catch {
    orb(ctx, 0, -16, 12, 10, '#ffe7c8', '#e7b184');
  }
  ctx.restore();
}

export function drawGull(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const flap = Math.sin(time * 8) * 5;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.quadraticCurveTo(-4, -flap - 4, 0, -1);
  ctx.quadraticCurveTo(4, -flap - 4, 10, 0);
  ctx.quadraticCurveTo(0, 2, -10, 0);
  ctx.fill();
  ctx.restore();
}

export function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.save();
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'center';
  const width = ctx.measureText(text).width + 16;
  ctx.fillStyle = 'rgba(255,248,239,0.94)';
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - 18, width, 20, 10);
  ctx.fill();
  ctx.fillStyle = '#3c2a22';
  ctx.fillText(text, x, y - 4);
  ctx.restore();
}

export function paintPortrait(canvas: HTMLCanvasElement, id: SpeciesId, time: number, faint = false): void {
  const fit = canvas.dataset.fit;
  const short = window.innerHeight < 700;
  const css = fit === 'hud' ? { w: 64, h: 64 } : fit === 'card' ? { w: 88, h: 88 } : short ? { w: 112, h: 100 } : PORTRAIT_CSS;
  const box = lockBox(canvas, css.w, css.h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
  ctx.clearRect(0, 0, box.w, box.h);
  try {
    const species = getSpecies(id);
    const soft = TYPE_META[species.type].soft;
    const glow = ctx.createRadialGradient(box.w / 2, box.h * 0.58, 8, box.w / 2, box.h * 0.62, box.w * 0.42);
    glow.addColorStop(0, '#fffaf3');
    glow.addColorStop(0.55, soft);
    glow.addColorStop(1, soft);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(box.w / 2, box.h * 0.58, box.w * 0.36, box.h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    drawCreature(ctx, id, box.w / 2, box.h * 0.78, time, Math.min(box.w, box.h) / 72, false, faint);
  } catch {
    fallbackCreature(ctx, box.w, box.h);
  }
}

export function paintRing(canvas: HTMLCanvasElement, scale: number): void {
  const locked = Number(canvas.dataset.boxW);
  const measured = locked || Math.min(240, Math.max(120, canvas.clientWidth || 220));
  if (!locked) canvas.dataset.boxW = String(measured);
  const box = lockBox(canvas, measured, measured);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
  ctx.clearRect(0, 0, box.w, box.h);
  const cx = box.w / 2;
  const cy = box.h / 2;
  const base = Math.min(box.w, box.h) * 0.28;
  const close = Math.abs(scale - 1);
  ctx.beginPath();
  ctx.arc(cx, cy, base, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(47, 154, 90, 0.22)';
  ctx.lineWidth = 16;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, base, 0, Math.PI * 2);
  ctx.strokeStyle = '#2f9a5a';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, base * scale, 0, Math.PI * 2);
  ctx.strokeStyle = close < 0.08 ? '#ef6844' : close < 0.16 ? '#e2a51a' : '#3c2a22';
  ctx.lineWidth = 4;
  ctx.stroke();
  drawBall(ctx, cx, cy + 18, 0);
}
