import './style.css';
import { Game } from './game/game';

const canvas = document.querySelector('#view');
const hud = document.querySelector('#hud');
const touch = document.querySelector('#touch');
const overlay = document.querySelector('#overlay');
if (!(canvas instanceof HTMLCanvasElement) || !(hud instanceof HTMLElement) || !(touch instanceof HTMLElement) || !(overlay instanceof HTMLElement)) {
  throw new Error('页面结构不完整');
}

const game = new Game({ canvas, hud, touch, overlay });
game.start();
