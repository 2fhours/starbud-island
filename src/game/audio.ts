export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  unlock(): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (ctx?.state === 'suspended') void ctx.resume();
  }

  play(name: 'tap' | 'hit' | 'heal' | 'catch' | 'fail' | 'level' | 'menu'): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const tone = (freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + delay);
      amp.gain.setValueAtTime(0.0001, now + delay);
      amp.gain.exponentialRampToValueAtTime(gain, now + delay + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.02);
    };
    if (name === 'tap') tone(520, 0.08, 'sine', 0.04);
    else if (name === 'menu') tone(440, 0.07, 'triangle', 0.035);
    else if (name === 'hit') {
      tone(210, 0.12, 'square', 0.03);
      tone(140, 0.16, 'sine', 0.04, 0.02);
    } else if (name === 'heal') {
      tone(523, 0.12, 'sine', 0.04);
      tone(659, 0.14, 'sine', 0.04, 0.08);
      tone(784, 0.18, 'sine', 0.035, 0.16);
    } else if (name === 'catch') {
      tone(392, 0.1, 'triangle', 0.04);
      tone(523, 0.12, 'triangle', 0.04, 0.1);
      tone(659, 0.16, 'sine', 0.045, 0.2);
    } else if (name === 'fail') {
      tone(311, 0.12, 'sine', 0.04);
      tone(233, 0.18, 'triangle', 0.035, 0.08);
    } else if (name === 'level') {
      tone(494, 0.1, 'sine', 0.04);
      tone(622, 0.12, 'sine', 0.04, 0.09);
      tone(740, 0.18, 'triangle', 0.04, 0.18);
    }
  }

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }
}
