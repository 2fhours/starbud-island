import './style.css';
import { Game } from './game/game';
import { APP_VERSION } from './version';

const canvas = document.querySelector('#view');
const hud = document.querySelector('#hud');
const touch = document.querySelector('#touch');
const overlay = document.querySelector('#overlay');
if (!(canvas instanceof HTMLCanvasElement) || !(hud instanceof HTMLElement) || !(touch instanceof HTMLElement) || !(overlay instanceof HTMLElement)) {
  throw new Error('页面结构不完整');
}

const syncViewport = () => {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--vvh', `${height}px`);
};
syncViewport();
window.visualViewport?.addEventListener('resize', syncViewport);
window.addEventListener('resize', syncViewport);

const version = document.querySelector('#build-tag');
if (version) version.textContent = `v${APP_VERSION}`;

const game = new Game({ canvas, hud, touch, overlay });
game.start();
