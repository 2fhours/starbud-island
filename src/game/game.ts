import { AudioEngine } from './audio';
import { playerMove, playerRun, playerSwitch, prepareBattle, resolveCatch, type Battle } from './battle';
import { RIDGE_TRIAL, bossScript, getSpecies, introScript, practiceScript } from './data';
import { Input } from './input';
import {
  catchProbability,
  cloneMon,
  commitEvolution,
  emptyDex,
  expGain,
  fleeChance,
  formatPlay,
  grandmaFollowup,
  grantExp,
  cycleAspect,
  healTeam,
  judgeTiming,
  makeMon,
  maxHp,
  readDelay,
  receiveMon,
  setLead,
  timingLabel,
  toggleEquip,
  topUpBalls,
} from './logic';
import { emptyItems, GATHER_STEPS, ITEM_LABEL, itemFromWild } from './evolution';
import { clearSave, readSave, writeSave } from './save';
import {
  drawBall,
  drawCreature,
  drawGate,
  drawFlower,
  drawGull,
  drawHouse,
  drawLabel,
  drawNpc,
  drawPlayer,
  drawRock,
  drawShrine,
  drawSign,
  drawTile,
  drawTree,
  paintActor,
  paintPortrait,
  paintRing,
} from './sprites';
import type { Dir, Mon, PlayState, SpeciesId } from './types';
import { DRAG_HINT_KEY, MUTE_KEY, START_BALLS } from './types';
import { hudHtml, mountTouch, renderOverlay, skillResultsHtml, type CaptureView, type EncounterView, type GameHost } from './ui';
import { COLS, ROWS, TILE, canWalkPixel, createWorld, gateChoice, tileCenter, worldFor, type GateDef, type NpcDef, type SignDef, type World } from './world';

interface Wild {
  id: string;
  speciesId: SpeciesId;
  level: number;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  mon: Mon;
  timer: number;
  vx: number;
  vy: number;
  pause: boolean;
  hidden: boolean;
  respawnAt: number;
  ignoreUntil: number;
  flip: boolean;
  seed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

type Nearby = { kind: 'npc'; npc: NpcDef } | { kind: 'door' } | { kind: 'sign'; sign: SignDef } | { kind: 'gate'; gate: GateDef };

export class Game implements GameHost {
  mode = 'title';
  play: PlayState | null = null;
  currentLog = '';
  logsDone = true;
  switchOpen = false;
  saveExists = false;
  saveSummaryText = '还没有旅程记录';
  createName = '小芽';
  selectedStarter: SpeciesId | null = null;
  nearbyLabel: string | null = null;
  shakeSuccess = false;
  skillQuery = '';
  skillType = 'all';
  skillTier = 'all';
  skillCat = 'all';
  loadoutIndex = 0;
  muted = false;
  battle: Battle | null = null;
  signView: { title: string; text: string } | null = null;
  npcId: string | null = null;
  private dialogueState: { speaker: string; text: string; afterLines: string[]; after?: () => void; auto?: boolean } | null = null;
  wilds: Wild[] = [];
  debugFreezeScale: number | null = null;
  rngQueue: number[] | null = null;
  captureScale = 1.6;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hud: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly input = new Input();
  private readonly audio = new AudioEngine();
  private world: World;
  private readonly wildCache = new Map<string, Wild[]>();
  private travelLockUntil = 0;
  private readonly fast: boolean;
  private viewW = 800;
  private viewH = 600;
  private camX = 0;
  private camY = 0;
  private time = 0;
  private last = 0;
  private hudSig = '';
  private activeWildId: string | null = null;
  private captureFrom: 'field' | 'battle' = 'field';
  private captureLock = false;
  private captureT = 0;
  private captureFails = 0;
  private throwResolved = false;
  private logs: string[] = [];
  private logIndex = 0;
  private afterLogs: (() => void) | null = null;
  private timer = 0;
  private logWait: { ms: number; fn: () => void } | null = null;
  private logPaused = false;
  private dragPointer: number | null = null;
  private saveTimer = 0;
  private stepTile: { x: number; y: number } | null = null;
  private gatherNotice = '';
  private encounterLockUntil = 0;
  private talkLockUntil = 0;
  private talkLockId = '';
  private trainerKey: 'qinghe' | 'lanchuan' | 'shiling' | null = null;
  private nearby: Nearby | null = null;
  private particles: Particle[] = [];
  private hist: { x: number; y: number }[] = [];
  private followX = 0;
  private followY = 0;
  private moving = false;
  private resetReturn: 'title' | 'menu' = 'title';

  constructor(opts: { canvas: HTMLCanvasElement; hud: HTMLElement; touch: HTMLElement; overlay: HTMLElement }) {
    this.canvas = opts.canvas;
    const ctx = opts.canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建画布');
    this.ctx = ctx;
    this.hud = opts.hud;
    this.overlay = opts.overlay;
    this.world = createWorld();
    this.fast = new URLSearchParams(location.search).has('test');
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
    this.audio.sfxMuted = this.muted;
    this.mountMusicDock();
    this.mountMapDrag();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.onPageHidden();
      else this.onPageVisible();
    });
    window.addEventListener('blur', () => {
      this.stopMapDrag();
      this.audio.setAudible(false);
    });
    window.addEventListener('focus', () => {
      if (document.visibilityState === 'visible') this.audio.setAudible(true);
    });
    this.resetWilds();
    this.refreshSummary();
    mountTouch(opts.touch, this.input, (act) => this.handle(act));
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('beforeunload', () => this.persist(true));
    this.overlay.addEventListener('click', (event) => this.onUiClick(event));
    this.overlay.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.id !== 'skill-q') return;
      this.skillQuery = target.value.slice(0, 16);
      const box = document.getElementById('skill-results');
      if (box) box.innerHTML = skillResultsHtml(this);
    });
    this.hud.addEventListener('click', (event) => this.onUiClick(event));
    this.resize();
    this.refresh();
    window.__xingya = this;
  }

  start(): void {
    requestAnimationFrame((now) => {
      this.last = now;
      this.frame(now);
    });
  }

  get audioState() {
    return this.audio.debug();
  }

  setPageAudible(on: boolean): void {
    this.audio.setAudible(on);
  }

  exerciseMusic(times: number): void {
    for (let i = 0; i < times; i += 1) this.audio.sync(i % 2 === 0 ? 'battle' : 'explore');
  }

  get canAct(): boolean {
    return this.mode === 'battle' && !!this.battle && this.battle.phase === 'input' && this.logsDone;
  }

  get mustSwitch(): boolean {
    return this.mode === 'battle' && this.battle?.phase === 'switch' && this.logsDone;
  }

  get encounterView(): EncounterView | null {
    const wild = this.activeWild();
    if (this.mode !== 'encounter' || !wild) return null;
    const species = getSpecies(wild.speciesId);
    return { speciesId: wild.speciesId, name: species.name, level: wild.level, hp: wild.mon.hp, max: maxHp(wild.mon), type: species.type };
  }

  get dialogue(): { speaker: string; text: string } | null {
    if (!this.dialogueState) return null;
    return { speaker: this.dialogueState.speaker, text: this.dialogueState.text };
  }

  get captureView(): CaptureView | null {
    if (this.mode !== 'capture' && this.mode !== 'shake') return null;
    const mon = this.captureMon();
    if (!mon || !this.play) return null;
    const species = getSpecies(mon.speciesId);
    return { speciesId: mon.speciesId, name: species.name, level: mon.level, hp: mon.hp, max: maxHp(mon), type: species.type, balls: this.play.balls };
  }

  handle(act: string, arg?: string | null): void {
    if (act === 'confirm') {
      if (this.mode === 'dialogue') act = 'dialogue-next';
      else if (this.mode === 'capture') act = 'throw';
      else if (this.mode === 'shake') act = 'shake-skip';
      else if (this.mode === 'battle' && !this.logsDone) act = 'log-next';
      else if (this.mode === 'explore') act = 'interact';
      else if (this.mode === 'sign' || this.mode === 'heal' || this.mode === 'npc') act = 'close';
      else return;
    }
    if (act === 'esc') {
      if (this.mode === 'confirm-reset') act = 'cancel-reset';
      else if (this.mode === 'confirm-new' || this.mode === 'create-name' || this.mode === 'create-starter') act = 'title';
      else if (this.mode === 'team' || this.mode === 'dex' || this.mode === 'bag' || this.mode === 'quest' || this.mode === 'help' || this.mode === 'elements' || this.mode === 'skilldex' || this.mode === 'loadout') act = 'panel';
      else if (this.mode === 'menu' || this.mode === 'sign' || this.mode === 'heal' || this.mode === 'npc') act = 'close';
      else if (this.mode === 'encounter') act = 'encounter-leave';
      else if (this.mode === 'capture') act = 'capture-back';
      else if (this.mode === 'dialogue') act = 'dialogue-next';
      else return;
      if (act === 'panel') arg = 'menu';
    }
    this.audio.unlock();
    switch (act) {
      case 'new-game':
        this.mode = this.saveExists ? 'confirm-new' : 'create-name';
        break;
      case 'confirm-new':
        this.mode = 'create-name';
        break;
      case 'title':
        this.persist(true);
        this.abandonTimedWork();
        this.battle = null;
        this.dialogueState = null;
        this.mode = 'title';
        this.refreshSummary();
        break;
      case 'continue':
        this.continueGame();
        return;
      case 'ask-reset':
        this.resetReturn = this.mode === 'menu' ? 'menu' : 'title';
        this.mode = 'confirm-reset';
        break;
      case 'cancel-reset':
        this.mode = this.resetReturn === 'menu' && this.play ? 'menu' : 'title';
        break;
      case 'confirm-reset':
        clearSave(localStorage);
        this.play = null;
        this.saveExists = false;
        this.saveSummaryText = '还没有旅程记录';
        this.mode = 'title';
        this.toast('存档已清除');
        break;
      case 'pick-name':
        if (arg) this.createName = arg;
        break;
      case 'to-starter':
        this.mode = 'create-starter';
        break;
      case 'to-name':
        this.mode = 'create-name';
        break;
      case 'pick-starter':
        if (arg) this.selectedStarter = arg as SpeciesId;
        break;
      case 'confirm-starter':
        if (this.selectedStarter) this.beginJourney(this.selectedStarter);
        return;
      case 'dialogue-next':
        this.advanceDialogue();
        return;
      case 'interact':
        this.interact();
        return;
      case 'menu':
        if (this.mode === 'explore' && this.play) this.mode = 'menu';
        break;
      case 'close':
        this.mode = 'explore';
        this.switchOpen = false;
        this.encounterLockUntil = this.time + 0.4;
        break;
      case 'panel':
        if (arg === 'menu') this.mode = 'menu';
        else if (arg) this.mode = arg;
        break;
      case 'save':
        this.persist(false);
        break;
      case 'mute':
        this.muted = !this.muted;
        this.audio.sfxMuted = this.muted;
        localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
        break;
      case 'set-lead':
        if (this.play && arg) {
          setLead(this.play.team, Number(arg));
          this.persist(true);
          this.toast('领队已更换，它会跟在身后');
        }
        break;
      case 'open-loadout':
        if (this.play && arg) {
          this.loadoutIndex = Number(arg);
          this.mode = 'loadout';
        }
        break;
      case 'equip-move':
        if (this.play && arg) {
          const mon = this.play.team[this.loadoutIndex];
          if (mon) this.toast(toggleEquip(mon, arg));
          this.persist(true);
        }
        break;
      case 'attune':
        if (this.play && arg) {
          const mon = this.play.team[Number(arg)];
          if (mon) this.toast(cycleAspect(mon));
          this.persist(true);
        }
        break;
      case 'evolve':
        if (this.mode !== 'team' || !this.play || !arg) break;
        {
          const mon = this.play.team[Number(arg)];
          if (!mon) break;
          const result = commitEvolution(mon, this.play);
          this.toast(result.text);
          if (result.ok) this.audio.play('level');
          this.persist(true);
        }
        break;
      case 'skill-type':
        this.skillType = arg || 'all';
        break;
      case 'skill-tier':
        this.skillTier = arg || 'all';
        break;
      case 'skill-cat':
        this.skillCat = arg || 'all';
        break;
      case 'encounter-catch':
        this.beginCapture('field');
        return;
      case 'encounter-fight':
        this.startWildBattle();
        return;
      case 'encounter-leave':
        this.leaveEncounter();
        return;
      case 'throw':
        this.throwBall();
        return;
      case 'capture-back':
        if (!this.captureLock) this.mode = this.captureFrom === 'battle' ? 'battle' : 'encounter';
        break;
      case 'shake-skip':
        this.finishThrow();
        return;
      case 'battle-move':
        this.doMove(Number(arg ?? 0));
        return;
      case 'battle-basic':
        this.doMove(-1);
        return;
      case 'battle-catch':
        this.beginCapture('battle');
        return;
      case 'battle-run':
        this.doRun();
        return;
      case 'toggle-switch':
        this.switchOpen = !this.switchOpen;
        break;
      case 'switch':
        this.doSwitch(Number(arg ?? 0));
        return;
      case 'log-next':
        this.skipLog();
        return;
      case 'npc-heal':
        this.doHeal(this.npcId === 'wushou' ? '雾守' : '芽婆婆');
        return;
      case 'heal-yes':
        this.doHeal(this.play?.mapId === 'ridge' ? '雾守' : '星芽驿');
        return;
      case 'npc-quest':
        if (this.npcId === 'wushou') this.turnInRidge();
        else this.turnInQuest();
        return;
      case 'npc-fight':
        this.startNpcBattle();
        return;
      default:
        break;
    }
    this.refresh();
  }

  private frame = (now: number): void => {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.audio.sync(this.mode);
    this.update(dt);
    this.render();
    requestAnimationFrame(this.frame);
  };

  private update(dt: number): void {
    const roaming = this.mode === 'explore' || this.mode === 'title' || this.mode === 'create-name' || this.mode === 'create-starter' || this.mode === 'confirm-new';
    if (roaming) this.updateWilds(dt);
    if (this.mode === 'capture') {
      if (this.debugFreezeScale != null) this.captureScale = this.debugFreezeScale;
      else {
        this.captureT += dt;
        const unit = (this.captureT % 1.35) / 1.35;
        this.captureScale = 1.85 - unit * 1.3;
      }
    }
    if (this.play && this.mode !== 'title') this.play.playMs += dt * 1000;
    if (this.mode === 'explore' && this.play) {
      this.movePlayer(dt);
      this.collectPickups();
      this.collectGathers();
      this.nearby = this.findNearby();
      this.nearbyLabel = this.nearby ? this.nearbyText(this.nearby) : null;
      if (this.input.consumeInteract()) this.interact();
      if (this.input.consumeMenu()) this.handle('menu');
      if (this.mode === 'explore' && this.time > this.encounterLockUntil) this.touchWilds();
      this.saveTimer += dt;
      if (this.saveTimer > 8) {
        this.saveTimer = 0;
        this.persist(true);
      }
    }
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    this.updateCamera(dt);
  }

  private movePlayer(dt: number): void {
    if (!this.play) return;
    const axis = this.input.axis();
    const len = Math.hypot(axis.x, axis.y);
    if (len < 0.12) {
      this.moving = false;
      return;
    }
    const speed = 176;
    const dx = axis.x * speed * dt;
    const dy = axis.y * speed * dt;
    if (canWalkPixel(this.world, this.play.x + dx, this.play.y + dy)) {
      this.play.x += dx;
      this.play.y += dy;
    } else if (canWalkPixel(this.world, this.play.x + dx, this.play.y)) this.play.x += dx;
    else if (canWalkPixel(this.world, this.play.x, this.play.y + dy)) this.play.y += dy;
    this.moving = true;
    this.noteStep();
    const dir: Dir = Math.abs(axis.x) > Math.abs(axis.y) ? (axis.x < 0 ? 'left' : 'right') : axis.y < 0 ? 'up' : 'down';
    this.play.dir = dir;
    this.hist.push({ x: this.play.x, y: this.play.y });
    if (this.hist.length > 48) this.hist.shift();
    const target = this.hist[Math.max(0, this.hist.length - 16)];
    this.followX += (target.x - this.followX) * Math.min(1, dt * 8);
    this.followY += (target.y - this.followY) * Math.min(1, dt * 8);
  }

  private updateWilds(dt: number): void {
    for (const wild of this.wilds) {
      if (wild.hidden) {
        if (this.time >= wild.respawnAt) {
          const dist = this.play ? Math.hypot(this.play.x - wild.homeX, this.play.y - wild.homeY) : 999;
          if (dist > 80) {
            wild.hidden = false;
            wild.mon = makeMon(wild.speciesId, wild.level);
            wild.x = wild.homeX;
            wild.y = wild.homeY;
          }
        }
        continue;
      }
      wild.timer -= dt;
      if (wild.timer <= 0) {
        const angle = (wild.seed * 12.3 + this.time) * 2.1;
        wild.vx = Math.cos(angle);
        wild.vy = Math.sin(angle * 0.8);
        wild.timer = 0.7 + (wild.seed % 1) * 1.4;
        wild.pause = Math.sin(this.time + wild.seed) > 0.2;
      }
      if (wild.pause || this.mode === 'encounter' || this.mode === 'battle' || this.mode === 'capture') continue;
      const nx = wild.x + wild.vx * 28 * dt;
      const ny = wild.y + wild.vy * 24 * dt;
      if (Math.hypot(nx - wild.homeX, ny - wild.homeY) < TILE * 2.4 && canWalkPixel(this.world, nx, ny)) {
        wild.x = nx;
        wild.y = ny;
        wild.flip = wild.vx < 0;
      } else wild.timer = 0;
    }
  }

  private touchWilds(): void {
    if (!this.play) return;
    for (const wild of this.wilds) {
      if (wild.hidden || this.time < wild.ignoreUntil) continue;
      if (Math.hypot(this.play.x - wild.x, this.play.y - wild.y) < 30) {
        this.activeWildId = wild.id;
        this.captureFails = 0;
        wild.ignoreUntil = this.time + 99;
        this.markSeen(wild.speciesId);
        this.mode = 'encounter';
        this.stopMapDrag();
        this.refresh();
        return;
      }
    }
  }

  private updateCamera(dt: number): void {
    let focusX = (20.5 + Math.sin(this.time * 0.18) * 4.2) * TILE;
    let focusY = (16.4 + Math.cos(this.time * 0.15) * 2.1) * TILE;
    if (this.play && this.mode !== 'title' && this.mode !== 'confirm-new' && !this.mode.startsWith('create')) {
      focusX = this.play.x;
      focusY = this.play.y - 12;
    }
    const desiredX = focusX - this.viewW / 2;
    const desiredY = focusY - this.viewH / 2;
    this.camX += (desiredX - this.camX) * Math.min(1, dt * 5);
    this.camY += (desiredY - this.camY) * Math.min(1, dt * 5);
    const mapW = COLS * TILE;
    const mapH = ROWS * TILE;
    this.camX = this.viewW >= mapW ? (mapW - this.viewW) / 2 : Math.max(0, Math.min(mapW - this.viewW, this.camX));
    this.camY = this.viewH >= mapH ? (mapH - this.viewH) / 2 : Math.max(0, Math.min(mapH - this.viewH, this.camY));
  }

  private render(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.ctx.clearRect(0, 0, this.viewW, this.viewH);
    const x0 = Math.max(0, Math.floor(this.camX / TILE) - 1);
    const y0 = Math.max(0, Math.floor(this.camY / TILE) - 1);
    const x1 = Math.min(COLS, Math.ceil((this.camX + this.viewW) / TILE) + 1);
    const y1 = Math.min(ROWS, Math.ceil((this.camY + this.viewH) / TILE) + 1);
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) drawTile(this.ctx, this.world.tiles[y][x], x * TILE - this.camX, y * TILE - this.camY, x, y, this.time);
    }
    const sprites: { y: number; draw: () => void }[] = [];
    for (const prop of this.world.props) {
      const sx = prop.x * TILE - this.camX;
      const sy = prop.y * TILE - this.camY;
      if (prop.kind === 'tree') sprites.push({ y: (prop.y + 1) * TILE, draw: () => drawTree(this.ctx, sx + TILE / 2, sy + TILE - 4, prop.variant, this.time) });
      else if (prop.kind === 'rock') sprites.push({ y: (prop.y + 1) * TILE, draw: () => drawRock(this.ctx, sx + TILE / 2, sy + TILE - 6, prop.variant) });
      else if (prop.kind === 'flower') sprites.push({ y: (prop.y + 0.6) * TILE, draw: () => drawFlower(this.ctx, sx + TILE / 2, sy + TILE - 8, prop.variant, this.time) });
      else if (prop.kind === 'house') sprites.push({ y: (prop.y + (prop.h ?? 2)) * TILE, draw: () => drawHouse(this.ctx, sx, sy, prop.w ?? 3, prop.h ?? 2, prop.roof ?? '#ef7d62') });
      else sprites.push({ y: (prop.y + (prop.h ?? 3)) * TILE, draw: () => drawShrine(this.ctx, sx, sy, prop.w ?? 3, prop.h ?? 3, this.time) });
    }
    for (const sign of this.world.signs) {
      const sx = (sign.x + 0.5) * TILE - this.camX;
      const sy = (sign.y + 1) * TILE - this.camY;
      sprites.push({ y: (sign.y + 1) * TILE, draw: () => drawSign(this.ctx, sx, sy - 8) });
    }
    if (this.play) {
      for (const pickup of this.world.pickups) {
        if (this.play.pickups.includes(pickup.id)) continue;
        const sx = (pickup.x + 0.5) * TILE - this.camX;
        const sy = (pickup.y + 1) * TILE - this.camY;
        sprites.push({ y: (pickup.y + 0.8) * TILE, draw: () => drawBall(this.ctx, sx, sy, this.time) });
      }
    } else {
      for (const pickup of this.world.pickups) {
        const sx = (pickup.x + 0.5) * TILE - this.camX;
        const sy = (pickup.y + 1) * TILE - this.camY;
        sprites.push({ y: (pickup.y + 0.8) * TILE, draw: () => drawBall(this.ctx, sx, sy, this.time) });
      }
    }
    for (const node of this.world.gathers) {
      const sx = (node.x + 0.5) * TILE - this.camX;
      const sy = (node.y + 1) * TILE - this.camY;
      const ready = !this.play || this.play.steps >= (this.play.gather[node.id] ?? 0);
      sprites.push({
        y: (node.y + 0.8) * TILE,
        draw: () => {
          if (node.item === 'yanxinshi') drawRock(this.ctx, sx, sy - 8, ready ? 1 : 0);
          else drawFlower(this.ctx, sx, sy - 6, ready ? 2 : 0, this.time);
          if (this.play && Math.hypot(this.play.x - (node.x + 0.5) * TILE, this.play.y - (node.y + 0.5) * TILE) < 72) {
            drawLabel(this.ctx, node.name, sx, sy - 36);
          }
        },
      });
    }
    for (const gate of this.world.gates) {
      const open = !!this.play && gateChoice(this.play.quest.completed, gate) === 'go';
      drawGate(this.ctx, (gate.x + 0.5) * TILE - this.camX, (gate.y + 1) * TILE - this.camY, open);
    }
    for (const npc of this.world.npcs) {
      const sx = (npc.x + 0.5) * TILE - this.camX;
      const sy = (npc.y + 1) * TILE - this.camY - 6;
      sprites.push({
        y: (npc.y + 1) * TILE,
        draw: () => {
          drawNpc(this.ctx, sx, sy, npc.id, this.time);
          drawLabel(this.ctx, npc.name, sx, sy - 52);
        },
      });
    }
    for (const wild of this.wilds) {
      if (wild.hidden) continue;
      const sx = wild.x - this.camX;
      const sy = wild.y - this.camY;
      sprites.push({
        y: wild.y,
        draw: () => {
          drawCreature(this.ctx, wild.speciesId, sx, sy, this.time, 0.78, wild.flip, wild.mon.hp <= 0);
          if (this.play && Math.hypot(this.play.x - wild.x, this.play.y - wild.y) < 78) drawLabel(this.ctx, getSpecies(wild.speciesId).name, sx, sy - 50);
        },
      });
    }
    if (this.play && this.mode !== 'title' && !this.mode.startsWith('create') && this.mode !== 'confirm-new') {
      const lead = this.play.team[0];
      sprites.push({
        y: this.followY - 8,
        draw: () => drawCreature(this.ctx, lead.speciesId, this.followX - this.camX, this.followY - this.camY, this.time, 0.7, this.followX > this.play!.x, lead.hp <= 0),
      });
      sprites.push({
        y: this.play.y,
        draw: () => drawPlayer(this.ctx, this.play!.x - this.camX, this.play!.y - this.camY, this.play!.dir, this.moving, this.time),
      });
    }
    sprites.sort((a, b) => a.y - b.y);
    for (const sprite of sprites) sprite.draw();
    for (let i = 0; i < 3; i += 1) {
      const gx = ((this.time * 28 + i * 280) % (COLS * TILE));
      const gy = 18 + i * 26;
      if (this.world.tiles[0]?.[Math.floor(gx / TILE)] === 0) drawGull(this.ctx, gx - this.camX, gy - this.camY, this.time + i);
    }
    for (const particle of this.particles) {
      this.ctx.globalAlpha = Math.max(0, particle.life / particle.max);
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x - this.camX, particle.y - this.camY, particle.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }
    if (this.viewW > 980 && (this.mode === 'explore' || this.mode === 'title')) this.drawMinimap();
    this.paintDom();
    this.updateHud();
  }

  private drawMinimap(): void {
    const size = 132;
    const x = this.viewW - size - 16;
    const y = this.viewH - size - 36;
    this.ctx.fillStyle = 'rgba(255,248,239,0.88)';
    this.ctx.beginPath();
    this.ctx.roundRect(x - 6, y - 6, size + 12, size + 12, 16);
    this.ctx.fill();
    const sx = size / COLS;
    const sy = size / ROWS;
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        const tile = this.world.tiles[ty][tx];
        if (tile === 0 || tile === 1) this.ctx.fillStyle = '#49b7d4';
        else if (tile === 2) this.ctx.fillStyle = '#f0d2a0';
        else if (tile === 6) this.ctx.fillStyle = '#4f8f45';
        else this.ctx.fillStyle = '#8ed478';
        this.ctx.fillRect(x + tx * sx, y + ty * sy, sx + 0.4, sy + 0.4);
      }
    }
    if (this.play && this.mode === 'explore') {
      this.ctx.fillStyle = '#ef6844';
      this.ctx.beginPath();
      this.ctx.arc(x + (this.play.x / TILE) * sx, y + (this.play.y / TILE) * sy, 3.5, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private paintDom(): void {
    document.querySelectorAll<HTMLCanvasElement>('canvas[data-species]').forEach((canvas) => {
      const id = canvas.dataset.species as SpeciesId | undefined;
      if (id) paintPortrait(canvas, id, this.time, canvas.dataset.faint === '1');
    });
    document.querySelectorAll<HTMLCanvasElement>('canvas[data-actor]').forEach((canvas) => {
      const id = canvas.dataset.actor;
      if (id) paintActor(canvas, id, this.time);
    });
    const ring = document.getElementById('catch-ring');
    if (ring instanceof HTMLCanvasElement && this.mode === 'capture') {
      paintRing(ring, this.captureScale);
      const odds = document.getElementById('catch-odds');
      const mon = this.captureMon();
      if (odds && mon) {
        const timing = judgeTiming(this.captureScale);
        const chance = catchProbability(getSpecies(mon.speciesId).catchRate, mon.hp / maxHp(mon), timing);
        odds.textContent = `${timingLabel(timing)} · 现在投掷大约 ${Math.round(chance * 100)}%`;
      }
    }
  }

  private updateHud(): void {
    const lead = this.play?.team[0];
    const sig = `${this.mode}|${lead?.hp}|${lead?.speciesId}|${lead?.level}|${this.play?.balls}|${this.nearbyLabel}|${this.play?.quest.completed}|${this.muted}`;
    if (sig === this.hudSig) return;
    this.hudSig = sig;
    this.hud.innerHTML = hudHtml(this);
  }

  private beginJourney(speciesId: SpeciesId): void {
    const spawn = tileCenter(this.world.spawnTile.x, this.world.spawnTile.y);
    const starter = makeMon(speciesId, 5, 1, true);
    const dex = emptyDex();
    dex[speciesId] = { seen: true, caught: true };
    this.play = {
      name: this.createName,
      x: spawn.x,
      y: spawn.y,
      dir: 'down',
      team: [starter],
      box: [],
      dex,
      balls: START_BALLS,
      items: emptyItems(),
      steps: 0,
      gather: {},
      quest: { introduced: false, caughtWild: false, bossDefeated: false, completed: false },
      pickups: [],
      mapId: 'island',
      ridgeQuest: { introduced: false, caught: false, trial: false, completed: false },
      trainers: { qinghe: false, lanchuan: false, shiling: false },
      playMs: 0,
    };
    this.followX = spawn.x - 28;
    this.followY = spawn.y + 8;
    this.hist = [];
    this.wildCache.clear();
    this.world = createWorld();
    this.resetWilds();
    this.persist(true);
    const lines = introScript(this.createName);
    this.openDialogue(lines[0].speaker, lines.map((line) => line.text), () => {
      if (this.play) this.play.quest.introduced = true;
      this.persist(true);
      this.toast(this.claimDragHint() ?? '去草坡、湖边或苔木林看看吧');
    });
  }

  private continueGame(): void {
    const saved = readSave(localStorage);
    if (!saved) {
      this.toast('没有可以继续的存档');
      this.refresh();
      return;
    }
    this.world = worldFor(saved.mapId);
    if (!canWalkPixel(this.world, saved.x, saved.y)) {
      const spawn = tileCenter(this.world.spawnTile.x, this.world.spawnTile.y);
      saved.x = spawn.x;
      saved.y = spawn.y;
    }
    this.play = saved;
    this.followX = saved.x - 20;
    this.followY = saved.y + 10;
    this.hist = [];
    this.wildCache.clear();
    this.resetWilds();
    this.mode = 'explore';
    this.encounterLockUntil = this.time + 0.5;
    this.toast(this.claimDragHint() ?? `回到了${this.world.name}`);
    this.refresh();
  }

  private interact(): void {
    if (this.mode !== 'explore' || !this.nearby) {
      if (this.mode === 'explore') this.toast('靠近芽婆婆、告示、路口或驿站门口再交谈');
      return;
    }
    if (this.nearby.kind === 'gate') {
      this.useGate(this.nearby.gate);
      return;
    }
    if (this.nearby.kind === 'npc' && this.nearby.npc.id === this.talkLockId && this.time < this.talkLockUntil) return;
    this.audio.play('menu');
    if (this.nearby.kind === 'npc') {
      if (this.play && this.nearby.npc.id === 'wushou' && !this.play.ridgeQuest.introduced) {
        this.play.ridgeQuest.introduced = true;
        this.persist(true);
      }
      this.npcId = this.nearby.npc.id;
      this.mode = 'npc';
    } else if (this.nearby.kind === 'door') this.mode = 'heal';
    else {
      const sign = this.nearby.sign;
      this.openDialogue(sign.title, [sign.text]);
      return;
    }
    this.refresh();
  }

  private doHeal(speaker: string): void {
    if (!this.play) return;
    healTeam(this.play.team);
    const before = this.play.balls;
    this.play.balls = topUpBalls(this.play.balls);
    const extra = this.play.balls > before ? `星芽球补到了 ${this.play.balls} 个。` : '星芽球还够用。';
    this.burst(this.play.x, this.play.y - 20, ['#8ee08a', '#fff', '#f0b429']);
    this.audio.play('heal');
    this.openDialogue(speaker, ['伙伴们恢复了精神。', extra], () => this.persist(true));
  }

  private turnInQuest(): void {
    if (!this.play) return;
    const ready = this.play.quest.caughtWild && this.play.quest.bossDefeated && !this.play.quest.completed;
    if (ready) {
      this.play.quest.completed = true;
      this.burst(this.play.x, this.play.y - 30, ['#ef6844', '#f0b429', '#2f9a5a', '#fff']);
      this.audio.play('level');
    }
    this.openDialogue('芽婆婆', grandmaFollowup(this.play.quest), () => this.persist(false));
  }

  private turnInRidge(): void {
    if (!this.play) return;
    const quest = this.play.ridgeQuest;
    const ready = quest.caught && quest.trial && !quest.completed;
    if (ready) {
      quest.completed = true;
      this.audio.play('level');
    }
    const lines = quest.completed
      ? ready
        ? ['岭上的事你做完了。雾还在，但路你已经认得。', '再往北的山路仍关着，那不是下一张地图。南边的台阶可以回星芽岛。']
        : ['岭上的委托已经完成了。南边的台阶回到星芽岛，北边的雾还没开放。']
      : quest.caught && quest.trial
        ? ['可以复命了。']
        : ['先在岭上收服一只芽灵，再去北面找石岭。', '北边的牌子后面没有路，不要把雾当成下一张地图。'];
    this.openDialogue('雾守', lines, () => this.persist(false));
  }

  private noteCatch(): void {
    if (!this.play) return;
    if (this.play.mapId === 'ridge') this.play.ridgeQuest.caught = true;
    else this.play.quest.caughtWild = true;
  }

  private useGate(gate: GateDef): void {
    if (!this.play) return;
    if (this.time < this.travelLockUntil) return;
    const choice = gateChoice(this.play.quest.completed, gate);
    if (choice === 'stay' || !gate.to) {
      this.toast(gate.textLocked);
      this.audio.play('tap');
      return;
    }
    const arriveX = gate.arriveX;
    const arriveY = gate.arriveY;
    this.play.mapId = gate.to;
    this.world = worldFor(gate.to);
    const pos = tileCenter(arriveX, arriveY);
    if (!canWalkPixel(this.world, pos.x, pos.y)) {
      const spawn = tileCenter(this.world.spawnTile.x, this.world.spawnTile.y);
      this.play.x = spawn.x;
      this.play.y = spawn.y;
    } else {
      this.play.x = pos.x;
      this.play.y = pos.y;
    }
    this.followX = this.play.x;
    this.followY = this.play.y;
    this.travelLockUntil = this.time + 1.2;
    this.encounterLockUntil = this.time + 0.8;
    this.talkLockUntil = this.time + 1.2;
    this.resetWilds();
    this.toast(gate.textOpen);
    this.audio.play('menu');
    this.persist(true);
    this.refresh();
  }

  private startNpcBattle(): void {
    if (!this.play || !this.npcId) return;
    if (!this.play.team.some((mon) => mon.hp > 0)) {
      this.toast('伙伴们都没有体力了，先去星芽驿休息');
      return;
    }
    if (this.npcId === 'qinghe') {
      this.trainerKey = 'qinghe';
      this.battle = prepareBattle(this.play.team, [makeMon('fengling', 4)], 'trainer', '青禾');
      this.mode = 'battle';
      this.beginLogs([practiceScript(this.play.trainers.qinghe)[0].text, '青禾派出了风铃鸟'], () => undefined);
      return;
    }
    if (this.npcId === 'shiling') {
      this.trainerKey = 'shiling';
      this.battle = prepareBattle(this.play.team, RIDGE_TRIAL.map((entry) => makeMon(entry.speciesId, entry.level)), 'trainer', '石岭');
      this.mode = 'battle';
      this.beginLogs(['石岭放下拐杖。雾里的试炼开始了。', '石岭派出了雾灯蛾'], () => undefined);
      return;
    }
    if (this.npcId !== 'lanchuan') return;
    this.trainerKey = 'lanchuan';
    this.battle = prepareBattle(this.play.team, [makeMon('yanwei', 7), makeMon('yanke', 8), makeMon('dianrong', 7)], 'trainer', '岚川');
    this.mode = 'battle';
    this.beginLogs([bossScript(false)[0].text, '岚川派出了焰尾狐'], () => undefined);
  }

  private startWildBattle(): void {
    const wild = this.activeWild();
    if (!wild || !this.play) return;
    if (!this.play.team.some((mon) => mon.hp > 0)) {
      this.toast('伙伴们都没有体力了，先去星芽驿休息');
      return;
    }
    this.trainerKey = null;
    this.battle = prepareBattle(this.play.team, [wild.mon], 'wild', '');
    this.mode = 'battle';
    this.beginLogs([`野生的${getSpecies(wild.speciesId).name}（${wild.level} 级）看着你们`], () => undefined);
  }

  private beginCapture(from: 'field' | 'battle'): void {
    if (!this.play) return;
    if (from === 'battle' && this.battle?.kind === 'trainer') {
      this.toast('训练师的伙伴不能收服');
      return;
    }
    if (this.play.balls <= 0) {
      this.toast('没有星芽球了。回星芽驿可以补充');
      return;
    }
    this.captureFrom = from;
    this.captureLock = false;
    this.captureT = 0;
    this.mode = 'capture';
    this.refresh();
  }

  private throwBall(): void {
    if (this.mode !== 'capture' || this.captureLock || !this.play) return;
    const mon = this.captureMon();
    if (!mon || this.play.balls <= 0) return;
    this.captureLock = true;
    this.throwResolved = false;
    const timing = judgeTiming(this.captureScale);
    const chance = catchProbability(getSpecies(mon.speciesId).catchRate, mon.hp / maxHp(mon), timing);
    const success = this.rng() < chance;
    this.play.balls -= 1;
    this.shakeSuccess = success;
    this.pendingThrow = { success, timing, chance };
    this.mode = 'shake';
    this.audio.play(success ? 'catch' : 'fail');
    this.refresh();
    this.later(this.fast ? 30 : 1100, () => this.finishThrow());
  }

  private pendingThrow: { success: boolean; timing: ReturnType<typeof judgeTiming>; chance: number } | null = null;

  private finishThrow(): void {
    if (this.throwResolved || !this.pendingThrow || !this.play) return;
    this.throwResolved = true;
    this.clearTimer();
    const { success, timing, chance } = this.pendingThrow;
    this.pendingThrow = null;
    const mon = this.captureMon();
    const wild = this.activeWild();
    const percent = `这次成功率约 ${Math.round(chance * 100)}%`;
    if (!mon) {
      this.mode = 'explore';
      this.refresh();
      return;
    }
    const name = getSpecies(mon.speciesId).name;
    if (this.captureFrom === 'battle' && this.battle) {
      if (success) {
        const where = receiveMon(this.play.team, this.play.box, cloneMon(mon));
        this.markCaught(mon.speciesId);
        this.noteCatch();
        const trophy = wild ? this.awardWildItem(wild.speciesId) : '';
        if (wild) this.retireWild(wild);
        const logs = [`${timingLabel(timing)}，${percent}`, ...resolveCatch(this.battle, true, () => this.rng())];
        logs.push(where === 'team' ? `${name}加入了队伍` : `队伍满了，${name}寄存在星芽驿`);
        if (trophy) logs.push(trophy);
        this.mode = 'battle';
        this.burst(this.play.x, this.play.y - 20, ['#f0b429', '#fff', '#2f9a5a']);
        this.beginLogs(logs, () => this.finishBattle());
      } else {
        this.captureFails += 1;
        if (this.battle.kind === 'wild' && this.rng() < fleeChance(this.captureFails - 1)) {
          this.battle.phase = 'end';
          this.battle.result = 'run';
          if (wild) this.retireWild(wild);
          this.mode = 'battle';
          this.beginLogs([`${timingLabel(timing)}，${percent}`, '它跳出了星芽球，趁乱跑掉了'], () => this.finishBattle());
        } else {
          const logs = [`${timingLabel(timing)}，${percent}`, ...resolveCatch(this.battle, false, () => this.rng())];
          this.mode = 'battle';
          this.beginLogs(logs, () => {
            if (this.battle?.phase === 'end') this.finishBattle();
          });
        }
      }
      return;
    }
    const lines = [`${timingLabel(timing)}。${percent}`];
    if (success) {
      const where = receiveMon(this.play.team, this.play.box, cloneMon(mon));
      this.markCaught(mon.speciesId);
      this.noteCatch();
      const trophy = this.awardWildItem(mon.speciesId);
      const lead = this.play.team.find((member) => member.uid === this.play!.team[0].uid) ?? this.play.team[0];
      lines.push(`收服了${name}！`, where === 'team' ? '它加入了队伍。' : '队伍已满，先寄存在星芽驿。', ...grantExp(lead, expGain(mon.level, getSpecies(mon.speciesId).baseExp, false)));
      if (trophy) lines.push(trophy);
      if (wild) this.retireWild(wild);
      this.burst(this.play.x, this.play.y - 24, ['#f0b429', '#fff8ef', '#2f9a5a']);
      this.openDialogue('捕捉', lines, () => this.persist(false));
    } else {
      this.captureFails += 1;
      lines.push('它挣脱了星芽球。');
      if (this.rng() < fleeChance(this.captureFails - 1)) {
        lines.push('它跑回草丛里了，过一会儿还会出现。');
        if (wild) this.retireWild(wild);
        this.openDialogue('捕捉', lines, () => this.persist(true));
      } else {
        lines.push('还可以再试一次，或者先离开。');
        this.captureLock = false;
        this.openDialogue('捕捉', lines, () => {
          this.mode = 'encounter';
        });
      }
    }
  }

  private doMove(index: number): void {
    if (!this.canAct || !this.battle) return;
    const logs = playerMove(this.battle, index, () => this.rng());
    this.audio.play('hit');
    this.beginLogs(logs, () => {
      if (this.battle?.phase === 'end') this.finishBattle();
    });
  }

  private doSwitch(index: number): void {
    if (!this.battle || (!this.canAct && !this.mustSwitch)) return;
    const logs = playerSwitch(this.battle, index, () => this.rng());
    this.switchOpen = false;
    this.beginLogs(logs, () => {
      if (this.battle?.phase === 'end') this.finishBattle();
    });
  }

  private doRun(): void {
    if (!this.canAct || !this.battle) return;
    const logs = playerRun(this.battle);
    this.beginLogs(logs, () => {
      if (this.battle?.phase === 'end') this.finishBattle();
    });
  }

  private finishBattle(): void {
    const battle = this.battle;
    if (!battle || !this.play) return;
    const wild = this.activeWild();
    if (battle.result === 'lose') {
      this.battle = null;
      this.blackout();
      return;
    }
    if (wild && battle.kind === 'wild') {
      if (battle.result === 'run') this.bumpAway(wild);
      else this.retireWild(wild);
    }
    let line = '对战结束了。';
    if (battle.kind === 'trainer' && battle.result === 'win') line = this.applyTrainerReward(battle.trainerName);
    else if (battle.result === 'catch') line = '新的伙伴和你一起走了。';
    else if (battle.result === 'run') line = '你们先离开了。野生芽灵还留在原地。';
    else if (battle.result === 'win') {
      const trophy = wild ? this.awardWildItem(wild.speciesId) : '';
      line = trophy ? `野生芽灵退开了。${trophy}` : '野生芽灵退开了。';
    }
    this.battle = null;
    this.trainerKey = null;
    this.openDialogue('对战', [line], () => this.persist(false));
  }

  private applyTrainerReward(name: string): string {
    if (!this.play) return '对战结束了。';
    if (this.trainerKey === 'qinghe') {
      if (!this.play.trainers.qinghe) {
        this.play.trainers.qinghe = true;
        this.play.balls += 3;
        this.audio.play('level');
        return `${name}点到为止。你学会了怎么对战，并得到 3 个星芽球。`;
      }
      return `${name}说你已经很熟练了。`;
    }
    if (this.trainerKey === 'lanchuan') {
      if (!this.play.trainers.lanchuan) {
        this.play.trainers.lanchuan = true;
        this.play.quest.bossDefeated = true;
        this.play.balls += 5;
        this.audio.play('level');
        return '试炼通过了。岚川留下 5 个星芽球，让你回去告诉芽婆婆。';
      }
      return '岚川认可了这次再战。';
    }
    if (this.trainerKey === 'shiling') {
      if (!this.play.trainers.shiling) {
        this.play.trainers.shiling = true;
        this.play.ridgeQuest.trial = true;
        this.play.balls += 5;
        this.audio.play('level');
        return '试炼通过了。石岭留下 5 个星芽球，让你回岭南告诉雾守。';
      }
      return '石岭说这次只是再练。';
    }
    return `${name}收回了伙伴。`;
  }

  private blackout(): void {
    if (!this.play) return;
    const spawn = tileCenter(this.world.spawnTile.x, this.world.spawnTile.y);
    this.play.x = spawn.x;
    this.play.y = spawn.y;
    this.followX = spawn.x - 20;
    this.followY = spawn.y + 12;
    this.travelLockUntil = this.time + 1.2;
    healTeam(this.play.team);
    this.play.balls = topUpBalls(this.play.balls);
    this.encounterLockUntil = this.time + 1;
    this.audio.play('heal');
    const lines = this.play.mapId === 'ridge'
      ? ['伙伴们都撑不住了。我把你们接回了岭南营地。', '休息好了再往上走，南边的台阶也能回岛。']
      : ['伙伴们都撑不住了。我把你们接回了星芽驿。', '休息好了再出发就行，星芽球也帮你补上了。'];
    this.openDialogue(this.play.mapId === 'ridge' ? '雾守' : '芽婆婆', lines, () => this.persist(true));
  }

  private leaveEncounter(): void {
    const wild = this.activeWild();
    if (wild) this.bumpAway(wild);
    this.mode = 'explore';
    this.encounterLockUntil = this.time + 0.6;
    this.refresh();
  }

  private bumpAway(wild: Wild): void {
    if (!this.play) return;
    const dx = this.play.x - wild.x || 1;
    const dy = this.play.y - wild.y || 0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = this.play.x + (dx / len) * 40;
    const ny = this.play.y + (dy / len) * 40;
    if (canWalkPixel(this.world, nx, ny)) {
      this.play.x = nx;
      this.play.y = ny;
    }
    wild.ignoreUntil = this.time + 2.6;
  }

  private retireWild(wild: Wild): void {
    wild.hidden = true;
    wild.respawnAt = this.time + 24;
    wild.x = wild.homeX;
    wild.y = wild.homeY;
    wild.mon = makeMon(wild.speciesId, wild.level);
    wild.ignoreUntil = 0;
  }

  private noteStep(): void {
    if (!this.play) return;
    const x = Math.floor(this.play.x / TILE);
    const y = Math.floor(this.play.y / TILE);
    if (this.stepTile && (this.stepTile.x !== x || this.stepTile.y !== y)) this.play.steps += 1;
    this.stepTile = { x, y };
  }

  private awardWildItem(speciesId: SpeciesId): string {
    const item = itemFromWild(speciesId);
    if (!item || !this.play) return '';
    this.play.items[item] += 1;
    return `得到 1 个${ITEM_LABEL[item]}。`;
  }

  private collectGathers(): void {
    if (!this.play) return;
    let near = '';
    for (const node of this.world.gathers) {
      const center = tileCenter(node.x, node.y);
      if (Math.hypot(this.play.x - center.x, this.play.y - center.y) >= 30) continue;
      near = node.id;
      const readyAt = this.play.gather[node.id] ?? 0;
      if (this.play.steps < readyAt) {
        if (this.gatherNotice !== node.id) {
          this.gatherNotice = node.id;
          this.toast(node.waiting);
        }
        continue;
      }
      this.play.items[node.item] += 1;
      this.play.gather[node.id] = this.play.steps + GATHER_STEPS;
      this.gatherNotice = node.id;
      this.toast(node.got);
      this.audio.play('tap');
      this.persist(true);
    }
    if (!near) this.gatherNotice = '';
  }

  private collectPickups(): void {
    if (!this.play) return;
    for (const pickup of this.world.pickups) {
      if (this.play.pickups.includes(pickup.id)) continue;
      const center = tileCenter(pickup.x, pickup.y);
      if (Math.hypot(this.play.x - center.x, this.play.y - center.y) < 30) {
        this.play.pickups.push(pickup.id);
        this.play.balls += pickup.balls;
        this.toast(`捡到 ${pickup.balls} 个星芽球`);
        this.audio.play('tap');
        this.persist(true);
      }
    }
  }

  private findNearby(): Nearby | null {
    if (!this.play) return null;
    const tx = this.play.x / TILE;
    const ty = this.play.y / TILE;
    const near = (x: number, y: number, radius = 1.35) => Math.hypot(tx - (x + 0.5), ty - (y + 0.5)) <= radius;
    if (Math.floor(tx) === this.world.door.x && Math.floor(ty) === this.world.door.y) return { kind: 'door' };
    for (const gate of this.world.gates) if (near(gate.x, gate.y, 1.15)) return { kind: 'gate', gate };
    for (const npc of this.world.npcs) if (near(npc.x, npc.y, 1.28)) return { kind: 'npc', npc };
    if (near(this.world.door.x, this.world.door.y, 1.25)) return { kind: 'door' };
    for (const sign of this.world.signs) if (near(sign.x, sign.y, 1.4)) return { kind: 'sign', sign };
    return null;
  }

  private nearbyText(nearby: Nearby): string {
    if (nearby.kind === 'gate') {
      const open = !!this.play && gateChoice(this.play.quest.completed, nearby.gate) === 'go';
      return open ? nearby.gate.promptOpen : nearby.gate.promptLocked;
    }
    if (nearby.kind === 'npc') return `交谈 · ${nearby.npc.name}`;
    if (nearby.kind === 'door') return this.play?.mapId === 'ridge' ? '交谈 · 岭南营地' : '交谈 · 星芽驿';
    return `阅读 · ${nearby.sign.title}`;
  }

  private openDialogue(speaker: string, lines: string[], after?: () => void): void {
    this.clearTimer();
    const queue = lines.filter(Boolean);
    this.dialogueState = { speaker, text: queue[0] ?? '……', afterLines: queue.slice(1), after, auto: true };
    this.mode = 'dialogue';
    this.refresh();
    this.later(readDelay(this.dialogueState.text, this.fast), () => this.advanceAutoDialogue());
  }

  private advanceAutoDialogue(): void {
    if (this.mode !== 'dialogue' || !this.dialogueState?.auto) return;
    this.advanceDialogue();
  }

  private advanceDialogue(): void {
    if (!this.dialogueState) return;
    this.clearTimer();
    this.logWait = null;
    this.audio.play('tap');
    if (this.dialogueState.afterLines.length) {
      this.dialogueState = {
        ...this.dialogueState,
        text: this.dialogueState.afterLines[0],
        afterLines: this.dialogueState.afterLines.slice(1),
        auto: true,
      };
      this.refresh();
      this.later(readDelay(this.dialogueState.text, this.fast), () => this.advanceAutoDialogue());
      return;
    }
    const after = this.dialogueState.after;
    this.dialogueState = null;
    this.mode = 'explore';
    this.talkLockUntil = this.time + 1.1;
    this.talkLockId = this.npcId ?? '';
    after?.();
    this.refresh();
  }

  private beginLogs(lines: string[], after: () => void): void {
    this.logs = lines.length ? lines : ['……'];
    this.logIndex = 0;
    this.logsDone = false;
    this.afterLogs = after;
    this.revealLog();
  }

  private revealLog(): void {
    this.clearTimer();
    this.currentLog = this.logs[this.logIndex] ?? '';
    const last = this.logIndex >= this.logs.length - 1;
    this.refresh();
    const wait = readDelay(this.currentLog, this.fast);
    if (!last) this.later(wait, () => {
      this.logIndex += 1;
      this.revealLog();
    });
    else this.later(Math.min(wait, this.fast ? 40 : 900), () => this.finishLog());
  }

  private skipLog(): void {
    if (this.logsDone) return;
    this.clearTimer();
    if (this.logIndex < this.logs.length - 1) {
      this.logIndex += 1;
      this.revealLog();
    } else this.finishLog();
  }

  private finishLog(): void {
    if (this.logsDone) return;
    this.logsDone = true;
    this.logWait = null;
    this.logPaused = false;
    const callback = this.afterLogs;
    this.afterLogs = null;
    callback?.();
    this.refresh();
  }

  private later(ms: number, fn: () => void): void {
    this.clearTimer();
    this.logWait = { ms, fn };
    if (document.visibilityState === 'hidden') {
      this.logPaused = true;
      return;
    }
    this.logPaused = false;
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      this.logWait = null;
      fn();
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = 0;
    }
  }

  private abandonTimedWork(): void {
    this.clearTimer();
    this.logWait = null;
    this.logPaused = false;
    this.afterLogs = null;
    this.logsDone = true;
    this.stopMapDrag();
  }

  onPageHidden(): void {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = 0;
      this.logPaused = this.logWait != null;
    }
    this.stopMapDrag();
    this.audio.setAudible(false);
  }

  onPageVisible(): void {
    this.audio.setAudible(true);
    if (!this.logPaused || !this.logWait) return;
    const wait = this.logWait;
    this.later(wait.ms, wait.fn);
  }

  private burst(x: number, y: number, colors: string[]): void {
    for (let i = 0; i < 16; i += 1) {
      const angle = (Math.PI * 2 * i) / 16;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * 40,
        vy: Math.sin(angle) * 40 - 20,
        life: 0.8,
        max: 0.8,
        color: colors[i % colors.length],
        size: 3 + (i % 3),
      });
    }
  }

  private markSeen(id: SpeciesId): void {
    if (!this.play) return;
    this.play.dex[id].seen = true;
  }

  private markCaught(id: SpeciesId): void {
    if (!this.play) return;
    this.play.dex[id].seen = true;
    this.play.dex[id].caught = true;
  }

  private activeWild(): Wild | null {
    return this.wilds.find((wild) => wild.id === this.activeWildId) ?? null;
  }

  private captureMon(): Mon | null {
    if (this.captureFrom === 'battle' && this.battle) return this.battle.foes[this.battle.fIndex] ?? null;
    return this.activeWild()?.mon ?? null;
  }

  private resetWilds(): void {
    const key = this.play?.mapId ?? this.world.id;
    const cached = this.wildCache.get(key);
    if (cached) {
      this.wilds = cached;
      return;
    }
    this.wilds = this.world.spawns.map((spawn, index) => {
      const center = tileCenter(spawn.x, spawn.y);
      return {
        id: spawn.id,
        speciesId: spawn.speciesId,
        level: spawn.level,
        homeX: center.x,
        homeY: center.y,
        x: center.x,
        y: center.y,
        mon: makeMon(spawn.speciesId, spawn.level),
        timer: index * 0.2,
        vx: 1,
        vy: 0,
        pause: false,
        hidden: false,
        respawnAt: 0,
        ignoreUntil: 0,
        flip: false,
        seed: index + 1.3,
      };
    });
    this.wildCache.set(key, this.wilds);
  }

  private persist(silent: boolean): void {
    if (!this.play) return;
    const ok = writeSave(localStorage, this.play);
    this.saveExists = ok || this.saveExists;
    this.refreshSummary();
    if (!silent) this.toast(ok ? '进度已保存在这台设备' : '这台设备暂时写不了存档');
  }

  private refreshSummary(): void {
    const saved = readSave(localStorage);
    this.saveExists = !!saved;
    if (!saved) {
      this.saveSummaryText = '还没有旅程记录';
      return;
    }
    const caught = Object.values(saved.dex).filter((entry) => entry.caught).length;
    const total = Object.keys(saved.dex).length;
    this.saveSummaryText = `${saved.name} · 图鉴 ${caught}/${total} · ${formatPlay(saved.playMs)}`;
  }

  private refresh(): void {
    document.body.dataset.mode = this.mode;
    renderOverlay(this.overlay, this);
    this.hudSig = '';
    this.placeChrome();
    requestAnimationFrame(() => this.placeChrome());
  }

  private placeChrome(): void {
    const dock = document.querySelector<HTMLElement>('#music-dock');
    const toast = document.getElementById('toast');
    const explore = this.mode === 'explore';
    if (dock) {
      if (explore) {
        const left = document.querySelector('.hud-left')?.getBoundingClientRect();
        const right = document.querySelector('.hud-right')?.getBoundingClientRect();
        const below = Math.max(left?.bottom ?? 0, right?.bottom ?? 0);
        if (below >= 48) {
          dock.style.top = `${Math.ceil(below + 10)}px`;
          dock.style.left = '50%';
          dock.style.right = 'auto';
          dock.style.bottom = 'auto';
          dock.style.transform = 'translateX(-50%)';
        }
      } else {
        dock.style.top = '';
        dock.style.left = '';
        dock.style.right = '';
        dock.style.bottom = '';
        dock.style.transform = '';
      }
    }
    if (toast && explore) {
      const joy = document.querySelector('#joy')?.getBoundingClientRect();
      if (joy && joy.height > 2) {
        toast.style.top = 'auto';
        toast.style.bottom = `${Math.ceil(window.innerHeight - joy.top + 14)}px`;
      }
    } else if (toast) {
      toast.style.top = '';
      toast.style.bottom = '';
    }
  }

  private toast(message: string): void {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    window.setTimeout(() => el.classList.remove('show'), 1700);
  }

  private rng(): number {
    if (this.rngQueue && this.rngQueue.length) return this.rngQueue.shift() ?? Math.random();
    return Math.random();
  }

  private claimDragHint(): string | null {
    try {
      if (localStorage.getItem(DRAG_HINT_KEY) === '1') return null;
      const coarse = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
      if (!coarse) return null;
      localStorage.setItem(DRAG_HINT_KEY, '1');
      return '在地图上按住拖动就能走路，松开即停';
    } catch {
      return null;
    }
  }

  private mountMapDrag(): void {
    const canvas = this.canvas;
    const dead = 16;
    const reach = 70;
    const stop = () => this.stopMapDrag();
    canvas.addEventListener('pointerdown', (event) => {
      if (this.dragPointer != null) return;
      if (event.pointerType === 'mouse') return;
      if (this.mode !== 'explore' || !this.play) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest('button, input, a, .music-dock, .sheet, #touch, #hud')) return;
      this.dragPointer = event.pointerId;
      this.input.dragActive = true;
      this.input.dragX = 0;
      this.input.dragY = 0;
      canvas.dataset.dragX = String(event.clientX);
      canvas.dataset.dragY = String(event.clientY);
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* synthetic pointers in tests have no capture */
      }
      this.paintDragCue(event.clientX, event.clientY, 0, 0);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.dragPointer) return;
      if (this.mode !== 'explore' || !this.play) {
        stop();
        return;
      }
      const originX = Number(canvas.dataset.dragX);
      const originY = Number(canvas.dataset.dragY);
      const dx = event.clientX - originX;
      const dy = event.clientY - originY;
      const len = Math.hypot(dx, dy);
      if (len < dead) {
        this.input.dragX = 0;
        this.input.dragY = 0;
      } else {
        const scale = Math.min(len, reach) / reach;
        this.input.dragX = (dx / len) * scale;
        this.input.dragY = (dy / len) * scale;
      }
      this.paintDragCue(originX, originY, dx, dy);
    });
    const end = (event: PointerEvent) => {
      if (event.pointerId !== this.dragPointer) return;
      stop();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  stopMapDrag(): void {
    this.dragPointer = null;
    this.input.dragActive = false;
    this.input.dragX = 0;
    this.input.dragY = 0;
    const cue = document.getElementById('drag-cue');
    if (cue) cue.hidden = true;
  }

  private paintDragCue(x: number, y: number, dx: number, dy: number): void {
    const cue = document.getElementById('drag-cue');
    if (!cue) return;
    cue.hidden = false;
    const len = Math.hypot(dx, dy);
    const shown = len < 16 ? 0 : Math.min(len, 70);
    const nx = len ? dx / len : 0;
    const ny = len ? dy / len : 0;
    cue.style.transform = `translate(${x}px, ${y}px)`;
    const knob = cue.querySelector<HTMLElement>('.drag-knob');
    if (knob) knob.style.transform = `translate(${nx * shown}px, ${ny * shown}px)`;
  }

  private mountMusicDock(): void {
    const button = document.querySelector('#music-toggle');
    const slider = document.querySelector('#music-volume');
    if (button instanceof HTMLButtonElement) {
      button.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.setMusicOn(!this.audio.musicEnabled);
        this.paintMusicDock();
      });
    }
    if (slider instanceof HTMLInputElement) {
      slider.value = String(this.audio.volumePercent);
      slider.addEventListener('input', () => {
        this.audio.unlock();
        this.audio.setVolume(Number(slider.value));
        this.paintMusicDock();
      });
    }
    this.paintMusicDock();
  }

  private paintMusicDock(): void {
    const button = document.querySelector('#music-toggle');
    const slider = document.querySelector('#music-volume');
    if (button instanceof HTMLButtonElement) {
      button.setAttribute('aria-pressed', this.audio.musicEnabled ? 'true' : 'false');
      button.setAttribute('aria-label', this.audio.musicEnabled ? '关闭背景音乐' : '打开背景音乐');
      button.textContent = this.audio.musicEnabled ? '音乐' : '音乐关';
    }
    if (slider instanceof HTMLInputElement && document.activeElement !== slider) {
      slider.value = String(this.audio.volumePercent);
      slider.setAttribute('aria-valuenow', String(this.audio.volumePercent));
    }
  }

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = Math.max(1, Math.floor(this.viewW * dpr));
    this.canvas.height = Math.max(1, Math.floor(this.viewH * dpr));
    this.canvas.style.width = `${this.viewW}px`;
    this.canvas.style.height = `${this.viewH}px`;
    this.placeChrome();
    requestAnimationFrame(() => this.placeChrome());
  }

  private onUiClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('[data-act]');
    if (!(button instanceof HTMLElement)) return;
    event.preventDefault();
    this.handle(button.dataset.act ?? '', button.dataset.arg);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.audio.unlock();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    this.input.keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Escape') this.handle('esc');
    else if (event.code === 'KeyE' || event.code === 'Enter' || event.code === 'Space') this.handle('confirm');
    else if (event.code === 'Digit1') this.handle('battle-move', '0');
    else if (event.code === 'Digit2') this.handle('battle-move', '1');
    else if (event.code === 'Digit3') this.handle('battle-move', '2');
    else if (event.code === 'Digit4') this.handle('battle-move', '3');
    else if (event.code === 'KeyM') this.handle('mute');
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.input.keys.delete(event.code);
  };
}

declare global {
  interface Window {
    __xingya?: Game;
  }
}
