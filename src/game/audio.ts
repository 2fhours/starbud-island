import { clampVolume, midiToFreq, musicBusTargets, scoreFor, trackForMode, type Score, type ScoreNote, type TrackName } from './music';
import { MUSIC_ON_KEY, MUSIC_VOL_KEY } from './types';

type ToneName = 'tap' | 'hit' | 'heal' | 'catch' | 'fail' | 'level' | 'menu' | 'win';

export interface AudioDebug {
  contexts: number;
  unlocked: boolean;
  audible: boolean;
  musicOn: boolean;
  volume: number;
  track: TrackName | 'idle';
  scheduling: boolean;
  live: number;
  state: AudioContextState | 'none';
  targets: { explore: number; battle: number };
}

let contextsCreated = 0;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function readStoredMusic(): { on: boolean; volume: number } {
  let on = !prefersReducedMotion();
  let volume = 70;
  try {
    const storedOn = localStorage.getItem(MUSIC_ON_KEY);
    if (storedOn === '0' || storedOn === '1') on = storedOn === '1';
    const storedVol = localStorage.getItem(MUSIC_VOL_KEY);
    if (storedVol != null) volume = clampVolume(Number(storedVol));
  } catch {
    /* private mode */
  }
  return { on, volume };
}

export class AudioEngine {
  sfxMuted = false;
  private ctx: AudioContext | null = null;
  private exploreBus: GainNode | null = null;
  private battleBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicOn: boolean;
  private volume: number;
  private unlocked = false;
  private audible = true;
  private track: TrackName | 'idle' = 'idle';
  private mode = 'title';
  private mapId = 'island';
  private timer: number | null = null;
  private cursor = 0;
  private nextBeatTime = 0;
  private live = 0;
  private appliedLevel = -1;

  constructor() {
    const stored = readStoredMusic();
    this.musicOn = stored.on;
    this.volume = stored.volume;
    try {
      this.audible = document.visibilityState !== 'hidden';
    } catch {
      this.audible = true;
    }
  }

  get musicEnabled(): boolean {
    return this.musicOn;
  }

  get volumePercent(): number {
    return this.volume;
  }

  unlock(): void {
    this.unlocked = true;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    this.sync(this.mode);
  }

  sync(mode: string, mapId = this.mapId): void {
    this.mode = mode;
    this.mapId = mapId;
    if (!this.unlocked || !this.audible || !this.musicOn || this.volume <= 0) {
      this.quietMusic();
      return;
    }
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    this.fadeTo(trackForMode(mode, mapId));
  }

  setMusicOn(on: boolean): void {
    this.musicOn = on;
    try {
      localStorage.setItem(MUSIC_ON_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
    this.sync(this.mode);
  }

  setVolume(percent: number): void {
    this.volume = clampVolume(percent);
    try {
      localStorage.setItem(MUSIC_VOL_KEY, String(this.volume));
    } catch {
      /* ignore */
    }
    this.sync(this.mode);
  }

  setAudible(on: boolean): void {
    this.audible = on;
    if (!on) {
      this.quietMusic();
      if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
      return;
    }
    if (!this.unlocked) return;
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    this.sync(this.mode);
  }

  play(name: ToneName): void {
    if (this.sfxMuted || !this.audible) return;
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    const tone = (freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) => {
      this.voice(this.sfxBus!, now + delay, freq, dur, gain, type, 1800);
    };
    if (name === 'tap') tone(520, 0.08, 'sine', 0.05);
    else if (name === 'menu') tone(440, 0.07, 'triangle', 0.04);
    else if (name === 'hit') {
      tone(220, 0.09, 'triangle', 0.05);
      tone(146, 0.14, 'sine', 0.045, 0.03);
    } else if (name === 'heal') {
      tone(523, 0.12, 'sine', 0.045);
      tone(659, 0.14, 'sine', 0.04, 0.08);
      tone(784, 0.18, 'sine', 0.035, 0.16);
    } else if (name === 'catch') {
      tone(392, 0.1, 'triangle', 0.045);
      tone(523, 0.12, 'triangle', 0.04, 0.1);
      tone(659, 0.18, 'sine', 0.04, 0.2);
    } else if (name === 'fail') {
      tone(311, 0.12, 'sine', 0.04);
      tone(233, 0.18, 'triangle', 0.035, 0.08);
    } else if (name === 'win') {
      tone(523, 0.1, 'sine', 0.04);
      tone(659, 0.12, 'sine', 0.038, 0.08);
      tone(784, 0.2, 'triangle', 0.034, 0.16);
    } else {
      tone(494, 0.1, 'sine', 0.04);
      tone(622, 0.12, 'sine', 0.04, 0.09);
      tone(740, 0.2, 'triangle', 0.038, 0.18);
    }
  }

  debug(): AudioDebug {
    return {
      contexts: contextsCreated,
      unlocked: this.unlocked,
      audible: this.audible,
      musicOn: this.musicOn,
      volume: this.volume,
      track: this.track,
      scheduling: this.timer != null,
      live: this.live,
      state: this.ctx?.state ?? 'none',
      targets: musicBusTargets(this.track, this.musicOn && this.audible ? this.volume : 0),
    };
  }

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
        contextsCreated += 1;
        this.exploreBus = this.ctx.createGain();
        this.battleBus = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.exploreBus.gain.value = 0;
        this.battleBus.gain.value = 0;
        this.sfxBus.gain.value = 0.9;
        this.exploreBus.connect(this.ctx.destination);
        this.battleBus.connect(this.ctx.destination);
        this.sfxBus.connect(this.ctx.destination);
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private quietMusic(): void {
    if (this.track === 'idle' && this.timer == null) return;
    this.track = 'idle';
    this.appliedLevel = -1;
    this.stopScheduler();
    if (this.exploreBus) this.ramp(this.exploreBus, 0, 0.06);
    if (this.battleBus) this.ramp(this.battleBus, 0, 0.06);
  }

  private fadeTo(next: TrackName): void {
    if (!this.ctx || !this.exploreBus || !this.battleBus) return;
    const targets = musicBusTargets(next, this.volume);
    const level = next === 'battle' ? targets.battle : targets.explore;
    const changed = this.track !== next || this.appliedLevel !== level;
    if (!changed && this.timer != null) return;
    if (this.track !== next) {
      this.cursor = 0;
      this.nextBeatTime = this.ctx.currentTime + 0.06;
    }
    this.track = next;
    this.appliedLevel = level;
    this.ramp(this.exploreBus, targets.explore, 0.45);
    this.ramp(this.battleBus, targets.battle, 0.45);
    this.startScheduler();
  }

  private ramp(node: GainNode, value: number, seconds: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const current = Number.isFinite(node.gain.value) ? node.gain.value : 0;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(current, now);
    node.gain.linearRampToValueAtTime(value, now + seconds);
  }

  private startScheduler(): void {
    if (this.timer != null) return;
    this.timer = window.setInterval(() => this.pump(), 250);
  }

  private stopScheduler(): void {
    if (this.timer == null) return;
    window.clearInterval(this.timer);
    this.timer = null;
  }

  private pump(): void {
    if (!this.ctx || this.track === 'idle' || !this.musicOn || !this.audible) return;
    if (this.live > 28) return;
    const score = scoreFor(this.track);
    const beat = 60 / score.bpm;
    const now = this.ctx.currentTime;
    if (this.nextBeatTime < now) this.nextBeatTime = now + 0.02;
    const horizon = now + 0.5;
    let guard = 0;
    while (this.nextBeatTime < horizon && guard < 6) {
      this.scheduleBeat(score, this.cursor, this.nextBeatTime);
      this.cursor = (this.cursor + 1) % score.beats;
      this.nextBeatTime += beat;
      guard += 1;
    }
  }

  private scheduleBeat(score: Score, beatIndex: number, time: number): void {
    const bus = this.track === 'battle' ? this.battleBus : this.exploreBus;
    if (!bus) return;
    for (const note of score.melody) this.voiceIf(bus, score, note, beatIndex, time, 'triangle', 1500);
    for (const note of score.harmony) this.voiceIf(bus, score, note, beatIndex, time, 'sine', 700);
  }

  private voiceIf(bus: GainNode, score: Score, note: ScoreNote, beatIndex: number, time: number, type: OscillatorType, cutoff: number): void {
    if (note.beat !== beatIndex || this.live > 28) return;
    this.voice(bus, time, midiToFreq(note.midi), (60 / score.bpm) * note.dur * 0.92, 0.075 * note.vel, type, cutoff);
  }

  private voice(bus: GainNode, time: number, freq: number, dur: number, gain: number, type: OscillatorType, cutoff: number): void {
    if (!this.ctx || dur <= 0) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    filter.Q.setValueAtTime(0.6, time);
    const peak = Math.max(0.0002, Math.min(0.08, gain));
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(peak, time + 0.035);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.06, dur));
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(bus);
    osc.start(time);
    const stopAt = time + Math.max(0.08, dur) + 0.04;
    osc.stop(stopAt);
    this.live += 1;
    osc.onended = () => {
      this.live = Math.max(0, this.live - 1);
      osc.disconnect();
      filter.disconnect();
      amp.disconnect();
    };
  }
}
