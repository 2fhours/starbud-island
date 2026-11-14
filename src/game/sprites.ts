import { getSpecies, TYPE_META } from './data';
import type { Dir, SpeciesId } from './types';
import { TILE, hash } from './world';

export const FONT = '"WenQuanYi Micro Hei", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", "Droid Sans Fallback", sans-serif';

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(70, 46, 24, 0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, seed: number, r = 3.3): void {
  const blink = Math.sin(time * 2.2 + seed) > 0.975;
  ctx.fillStyle = '#2c241e';
  if (blink) {
    ctx.fillRect(x - r, y, r * 2, 1.7);
    return;
  }
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - r * 0.28, y - r * 0.32, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
}

function cheeks(ctx: CanvasRenderingContext2D, x: number, y: number, spread: number): void {
  ctx.fillStyle = 'rgba(255, 140, 150, 0.55)';
  ellipse(ctx, x - spread, y, 3.2, 2.1, 'rgba(255, 140, 150, 0.45)');
  ellipse(ctx, x + spread, y, 3.2, 2.1, 'rgba(255, 140, 150, 0.45)');
}

export function drawTile(ctx: CanvasRenderingContext2D, tile: number, x: number, y: number, gx: number, gy: number, time: number): void {
  const n = hash(gx, gy);
  const palette = ['#7ec86a', '#8ed478', '#6fba5c', '#f2d7a2', '#6dbe58', '#e7c48a', '#5f9a49', '#f6e2bf', '#e7b56a'];
  if (tile === 0) ctx.fillStyle = n > 0.5 ? '#2f92b8' : '#2786ae';
  else if (tile === 1) ctx.fillStyle = '#49b7d4';
  else if (tile === 2) ctx.fillStyle = n > 0.6 ? '#f3d7a4' : '#efcf96';
  else if (tile === 4) ctx.fillStyle = n > 0.5 ? '#63a84a' : '#589c42';
  else if (tile === 5) ctx.fillStyle = '#e6c48a';
  else if (tile === 6) ctx.fillStyle = '#6aaa52';
  else if (tile === 7 || tile === 8) ctx.fillStyle = '#f0d7a8';
  else ctx.fillStyle = palette[Math.floor(n * 3)];
  ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
  if (tile === 0 || tile === 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    const wobble = Math.sin(time * 2 + gx * 0.7 + gy) * 3;
    ellipse(ctx, x + 14 + wobble, y + 16, 7, 2.2, 'rgba(255,255,255,0.28)');
    ellipse(ctx, x + 32 - wobble, y + 30, 5, 1.6, 'rgba(255,255,255,0.2)');
  } else if (tile === 3 || tile === 6 || tile === 4) {
    ctx.fillStyle = tile === 4 ? 'rgba(40, 90, 30, 0.28)' : 'rgba(255,255,255,0.16)';
    for (let i = 0; i < 3; i += 1) {
      const bx = x + 8 + ((gx * 5 + i * 13) % 28);
      const by = y + 18 + ((gy * 3 + i * 9) % 18);
      ctx.fillRect(bx, by, 2, 7 + (i % 2));
    }
  } else if (tile === 5 || tile === 7) {
    ctx.fillStyle = 'rgba(160, 110, 60, 0.18)';
    if (n > 0.72) ellipse(ctx, x + 16, y + 20, 4, 2.4, 'rgba(160, 110, 60, 0.18)');
  }
  if (tile === 8) {
    ctx.fillStyle = '#d9b888';
    ctx.fillRect(x + 10, y + 34, TILE - 20, 8);
  }
}

export function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number, time: number): void {
  shadow(ctx, x, y, 16, 6);
  ctx.fillStyle = '#8a5a3a';
  ctx.fillRect(x - 4, y - 18, 8, 18);
  const sway = Math.sin(time * 1.4 + x) * 1.5;
  const greens = variant ? ['#2f7d45', '#46a45a', '#7dcb6e'] : ['#3c8d48', '#5cb56a', '#8ed67a'];
  ellipse(ctx, x + sway, y - 34, 18, 14, greens[0]);
  ellipse(ctx, x - 10 + sway, y - 26, 12, 10, greens[1]);
  ellipse(ctx, x + 10 + sway, y - 24, 11, 9, greens[2]);
  ellipse(ctx, x - 4, y - 40, 5, 3, 'rgba(255,255,255,0.25)');
}

export function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number): void {
  shadow(ctx, x, y, 12, 5);
  ellipse(ctx, x, y - 8, variant ? 14 : 11, 9, '#b7aa9c');
  ellipse(ctx, x - 3, y - 12, 6, 4, '#d9d0c4');
  ctx.fillStyle = '#7dae6a';
  ctx.fillRect(x + 2, y - 14, 6, 3);
}

export function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number, time: number): void {
  const bob = Math.sin(time * 2 + x) * 1.2;
  const colors = ['#f27ca8', '#ffd15c', '#f2f4ff'];
  ctx.strokeStyle = '#3e8a45';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 10 + bob);
  ctx.stroke();
  ellipse(ctx, x, y - 12 + bob, 4, 4, colors[variant % 3]);
  ellipse(ctx, x, y - 12 + bob, 1.4, 1.4, '#fff6df');
}

export function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, roof: string): void {
  const width = w * TILE;
  const height = h * TILE;
  shadow(ctx, x + width / 2, y + height - 4, width * 0.42, 8);
  ctx.fillStyle = '#fff6ea';
  ctx.beginPath();
  ctx.roundRect(x + 6, y + height * 0.42, width - 12, height * 0.55, 6);
  ctx.fill();
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 4, y + height * 0.48);
  ctx.lineTo(x + width / 2, y - 8);
  ctx.lineTo(x + width + 4, y + height * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y - 2);
  ctx.lineTo(x + width * 0.72, y + height * 0.42);
  ctx.lineTo(x + width / 2, y + height * 0.36);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8a5a3a';
  ctx.fillRect(x + width / 2 - 7, y + height * 0.62, 14, height * 0.34);
  ctx.fillStyle = '#9fd8ef';
  ctx.fillRect(x + 14, y + height * 0.55, 12, 10);
  ctx.fillRect(x + width - 28, y + height * 0.55, 12, 10);
}

export function drawShrine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, time: number): void {
  const width = w * TILE;
  const height = h * TILE;
  shadow(ctx, x + width / 2, y + height - 2, width * 0.46, 8);
  ctx.fillStyle = '#fff8ef';
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 28, width - 16, height - 32, 8);
  ctx.fill();
  ctx.fillStyle = '#3f9d5d';
  ctx.beginPath();
  ctx.moveTo(x - 2, y + 36);
  ctx.lineTo(x + width / 2, y + 4);
  ctx.lineTo(x + width + 2, y + 36);
  ctx.closePath();
  ctx.fill();
  const sway = Math.sin(time * 3) * 1.5;
  ctx.fillStyle = '#67c36a';
  ctx.beginPath();
  ctx.ellipse(x + width / 2 - 4, y + 52 + sway, 7, 11, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f9d5d';
  ctx.beginPath();
  ctx.ellipse(x + width / 2 + 4, y + 50 - sway, 7, 11, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b4632';
  ctx.fillRect(x + width / 2 - 8, y + height - 28, 16, 24);
  ctx.fillStyle = '#fff';
  ctx.font = `bold 14px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('驿', x + width / 2, y + 30);
}

export function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  shadow(ctx, x, y, 8, 3);
  ctx.fillStyle = '#8a5a3a';
  ctx.fillRect(x - 2, y - 16, 4, 16);
  ctx.fillStyle = '#fff6ea';
  ctx.beginPath();
  ctx.roundRect(x - 12, y - 28, 24, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#ef6844';
  ctx.fillRect(x - 8, y - 24, 16, 3);
}

export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const bob = Math.sin(time * 3) * 2;
  shadow(ctx, x, y, 8, 3);
  ellipse(ctx, x, y - 12 + bob, 9, 9, '#f0b429');
  ctx.fillStyle = '#3f9d5d';
  ctx.beginPath();
  ctx.arc(x, y - 12 + bob, 9, Math.PI, 0);
  ctx.fill();
  ellipse(ctx, x, y - 12 + bob, 3, 3, '#fff8ef');
  ctx.strokeStyle = '#3f9d5d';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y - 18 + bob);
  ctx.quadraticCurveTo(x + 6, y - 24 + bob, x + 4, y - 28 + bob);
  ctx.stroke();
}

export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, dir: Dir, moving: boolean, time: number): void {
  const step = moving ? Math.sin(time * 10) * 3 : 0;
  const bob = Math.sin(time * 2) * 1;
  shadow(ctx, x, y, 12, 5);
  ctx.save();
  ctx.translate(x, y + bob);
  if (dir === 'left') ctx.scale(-1, 1);
  const side = dir === 'left' || dir === 'right';
  ctx.fillStyle = '#4a3a32';
  ctx.fillRect(-7 + step, -8, 5, 7);
  ctx.fillRect(2 - step, -8, 5, 7);
  ctx.fillStyle = '#7ec8c3';
  ctx.beginPath();
  ctx.roundRect(-9, -24, 18, 16, 6);
  ctx.fill();
  ctx.fillStyle = '#ef6d4a';
  ctx.beginPath();
  ctx.ellipse(0, -20, 7, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (dir === 'up') {
    ctx.fillStyle = '#c9844a';
    ctx.beginPath();
    ctx.roundRect(-8, -22, 7, 9, 3);
    ctx.fill();
  }
  ctx.fillStyle = '#f3c7a1';
  ellipse(ctx, side ? 2 : 0, -32, 8, 8, '#f3c7a1');
  ctx.fillStyle = '#5b3a2a';
  ellipse(ctx, side ? 2 : 0, -36, 8.5, 6, '#5b3a2a');
  ctx.fillStyle = '#3f9d5d';
  ctx.beginPath();
  ctx.ellipse(-2, -42, 3, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  if (dir !== 'up') {
    eye(ctx, side ? 5 : -3, -32, time, 1, 2.2);
    if (!side) eye(ctx, 3, -32, time, 1, 2.2);
  }
  ctx.restore();
}

export function drawNpc(ctx: CanvasRenderingContext2D, x: number, y: number, id: string, time: number): void {
  const bob = Math.sin(time * 2 + y) * 1;
  shadow(ctx, x, y, 12, 5);
  ctx.save();
  ctx.translate(x, y + bob);
  if (id === 'grandma') {
    ctx.fillStyle = '#6f8f62';
    ctx.beginPath();
    ctx.roundRect(-10, -26, 20, 18, 7);
    ctx.fill();
    ellipse(ctx, 0, -34, 8, 8, '#f0d0b4');
    ellipse(ctx, 0, -40, 7, 5, '#efe6dc');
    ctx.strokeStyle = '#8a5a3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, -8);
    ctx.lineTo(12, -22);
    ctx.stroke();
  } else if (id === 'qinghe') {
    ctx.fillStyle = '#3aa0c8';
    ctx.beginPath();
    ctx.roundRect(-9, -28, 18, 18, 6);
    ctx.fill();
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(-8, -24, 16, 4);
    ellipse(ctx, 0, -36, 8, 8, '#f3c7a1');
    ellipse(ctx, 0, -40, 8, 5, '#3d2a24');
    eye(ctx, -3, -36, time, 2, 2);
    eye(ctx, 3, -36, time, 2, 2);
  } else {
    ctx.fillStyle = '#8d3d3a';
    ctx.beginPath();
    ctx.roundRect(-11, -34, 22, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#efc14a';
    ctx.fillRect(-8, -36, 16, 4);
    ellipse(ctx, 0, -42, 8, 8, '#f0c8a4');
    ellipse(ctx, 0, -46, 8, 4.5, '#2d2420');
    eye(ctx, -3, -42, time, 3, 2.1);
    eye(ctx, 3, -42, time, 3, 2.1);
  }
  ctx.restore();
}

function drawSpecies(ctx: CanvasRenderingContext2D, id: SpeciesId, time: number): void {
  const wag = Math.sin(time * 6) * 4;
  if (id === 'lujiao') {
    ctx.fillStyle = '#f3e2c4';
    ellipse(ctx, 0, -16, 16, 11, '#f3e2c4');
    ellipse(ctx, 12, -28, 8, 7, '#f6e7cf');
    ellipse(ctx, 18, -24, 4, 3, '#f3b7b0');
    ctx.fillStyle = '#3aaa55';
    ctx.beginPath();
    ctx.moveTo(8, -34);
    ctx.quadraticCurveTo(4, -48, 12, -46);
    ctx.quadraticCurveTo(10, -38, 14, -34);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -32);
    ctx.quadraticCurveTo(20, -46, 16, -50);
    ctx.quadraticCurveTo(18, -40, 12, -34);
    ctx.fill();
    ellipse(ctx, -4, -14, 2, 1.4, '#e7c98a');
    ellipse(ctx, 2, -12, 2, 1.4, '#e7c98a');
    eye(ctx, 12, -29, time, 4, 2.4);
    cheeks(ctx, 14, -25, 5);
  } else if (id === 'yanwei') {
    ellipse(ctx, -2, -16, 14, 10, '#ff8a3d');
    ellipse(ctx, 10, -26, 8, 7, '#ff9a52');
    ctx.fillStyle = '#ffe7cf';
    ctx.beginPath();
    ctx.moveTo(16, -22);
    ctx.lineTo(22, -18);
    ctx.lineTo(16, -16);
    ctx.fill();
    ellipse(ctx, -1, -12, 7, 5, '#fff1e4');
    ctx.fillStyle = '#ff5a2a';
    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.quadraticCurveTo(-24, -20 + wag, -16, -28 + wag);
    ctx.quadraticCurveTo(-8, -18, -6, -12);
    ctx.fill();
    ctx.fillStyle = '#ffd15a';
    ctx.beginPath();
    ctx.ellipse(-16, -24 + wag, 4, 6, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5b3a2a';
    ctx.beginPath();
    ctx.moveTo(6, -32);
    ctx.lineTo(10, -40);
    ctx.lineTo(14, -32);
    ctx.fill();
    eye(ctx, 12, -27, time, 5, 2.3);
  } else if (id === 'luzhu') {
    ellipse(ctx, 0, -14, 15, 12, '#3ec6b0');
    ellipse(ctx, 0, -10, 9, 7, '#f7fff8');
    eye(ctx, -5, -16, time, 6, 3.4);
    eye(ctx, 5, -16, time, 6, 3.4);
    cheeks(ctx, 0, -12, 9);
    ctx.fillStyle = 'rgba(120, 210, 240, 0.85)';
    ctx.beginPath();
    ctx.ellipse(0, -28, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ellipse(ctx, -1, -30, 1.6, 2, 'rgba(255,255,255,0.85)');
  } else if (id === 'dianrong') {
    ellipse(ctx, 0, -15, 13, 11, '#ffd23a');
    ellipse(ctx, 10, -24, 7, 6, '#ffe27a');
    ellipse(ctx, 6, -32, 4, 4, '#ffd23a');
    ellipse(ctx, 14, -32, 4, 4, '#ffd23a');
    ctx.strokeStyle = '#f0a020';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(-14, -20 + wag);
    ctx.lineTo(-8, -22 + wag);
    ctx.lineTo(-16, -30 + wag);
    ctx.stroke();
    ellipse(ctx, -4, -14, 3, 2, '#ff6b6b');
    ellipse(ctx, 4, -14, 3, 2, '#ff6b6b');
    eye(ctx, 10, -25, time, 7, 2.2);
    if (Math.sin(time * 18) > 0.2) {
      ctx.strokeStyle = '#fff4b0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(16, -30);
      ctx.lineTo(20, -34);
      ctx.moveTo(-12, -28);
      ctx.lineTo(-16, -32);
      ctx.stroke();
    }
  } else if (id === 'yanke') {
    ellipse(ctx, 0, -10, 16, 9, '#7dba6a');
    ellipse(ctx, 0, -16, 16, 11, '#c4894f');
    ctx.strokeStyle = '#a86d38';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, -20);
    ctx.lineTo(0, -12);
    ctx.lineTo(8, -22);
    ctx.moveTo(0, -22);
    ctx.lineTo(0, -8);
    ctx.stroke();
    ellipse(ctx, 0, -18, 4, 3, 'rgba(255,255,255,0.28)');
    ellipse(ctx, 12, -12, 6, 5, '#8dcc78');
    eye(ctx, 13, -13, time, 8, 2);
  } else if (id === 'fengling') {
    ellipse(ctx, 0, -16, 12, 10, '#f7fbff');
    ellipse(ctx, -12, -16 + wag * 0.2, 8, 5, '#8ec8f0');
    ellipse(ctx, 12, -16 - wag * 0.2, 8, 5, '#8ec8f0');
    ctx.fillStyle = '#f2c14d';
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(0, 2);
    ctx.lineTo(6, -8);
    ctx.closePath();
    ctx.fill();
    ellipse(ctx, 0, 0, 2, 2, '#fff');
    ctx.fillStyle = '#ffb4c8';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(-3, -32);
    ctx.lineTo(3, -28);
    ctx.fill();
    ctx.fillStyle = '#f29a3a';
    ctx.beginPath();
    ctx.moveTo(8, -16);
    ctx.lineTo(16, -14);
    ctx.lineTo(8, -12);
    ctx.fill();
    eye(ctx, 4, -18, time, 9, 2.4);
  } else if (id === 'taibei') {
    ellipse(ctx, 0, -18, 18, 14, '#c48a62');
    ellipse(ctx, 0, -20, 12, 9, '#6aaa55');
    ellipse(ctx, 4, -30, 4, 3, '#e25b5b');
    ctx.fillStyle = '#fff';
    ctx.fillRect(3, -30, 2, 4);
    ellipse(ctx, -8, -30, 4, 4, '#b57852');
    ellipse(ctx, 8, -30, 4, 4, '#b57852');
    ellipse(ctx, 0, -12, 6, 4, '#f3d7b5');
    eye(ctx, -4, -18, time, 10, 2.3);
    eye(ctx, 5, -18, time, 10, 2.3);
  } else {
    ellipse(ctx, -2, -14, 16, 9, '#8a5a42');
    ellipse(ctx, -2, -10, 10, 5, '#f3d7b5');
    ellipse(ctx, 12, -20, 7, 6, '#9a684c');
    ctx.fillStyle = '#4aa7d8';
    ctx.beginPath();
    ctx.moveTo(-14, -12);
    ctx.quadraticCurveTo(-24, -8 + wag, -18, -2);
    ctx.quadraticCurveTo(-12, -8, -10, -12);
    ctx.fill();
    eye(ctx, 14, -21, time, 11, 2.2);
    ctx.strokeStyle = '#6b4636';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, -18);
    ctx.lineTo(24, -16);
    ctx.moveTo(18, -20);
    ctx.lineTo(24, -22);
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
  if (faint) ctx.filter = 'grayscale(0.85) brightness(0.9)';
  shadow(ctx, 0, 0, 16, 6);
  drawSpecies(ctx, id, time);
  ctx.restore();
}

export function drawGull(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const flap = Math.sin(time * 8) * 4;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 8, y);
  ctx.lineTo(x, y - flap);
  ctx.lineTo(x + 8, y);
  ctx.stroke();
}

export function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.save();
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'center';
  const width = ctx.measureText(text).width + 14;
  ctx.fillStyle = 'rgba(255,248,239,0.94)';
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - 16, width, 18, 9);
  ctx.fill();
  ctx.fillStyle = '#3c2a22';
  ctx.fillText(text, x, y - 3);
  ctx.restore();
}

export function paintPortrait(canvas: HTMLCanvasElement, id: SpeciesId, time: number, faint = false): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 72;
  const h = canvas.clientHeight || 72;
  const bw = Math.max(1, Math.floor(w * dpr));
  const bh = Math.max(1, Math.floor(h * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const soft = TYPE_META[getSpecies(id).type].soft;
  ctx.fillStyle = soft;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2 + 2, Math.min(w, h) * 0.42, 0, Math.PI * 2);
  ctx.fill();
  drawCreature(ctx, id, w / 2, h * 0.78, time, Math.min(w, h) / 78, false, faint);
}

export function paintRing(canvas: HTMLCanvasElement, scale: number): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 220;
  const h = canvas.clientHeight || 220;
  const bw = Math.max(1, Math.floor(w * dpr));
  const bh = Math.max(1, Math.floor(h * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const base = Math.min(w, h) * 0.28;
  const close = Math.abs(scale - 1);
  ctx.beginPath();
  ctx.arc(cx, cy, base, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(47, 154, 90, 0.25)';
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
