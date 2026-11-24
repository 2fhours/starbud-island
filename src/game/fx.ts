import { TYPE_META } from './elements';
import { SKILL_LIST, skillForm, type SkillForm } from './skills';
import type { TypeId } from './types';

export type CueSide = 'player' | 'foe';

export interface CueNames {
  player: string;
  foe: string;
  playerType: string;
  foeType: string;
}

export interface CueMemory {
  actor: CueSide | null;
  form: SkillForm | '';
  element: string;
}

export interface BattleCue {
  kind: 'physical' | 'magic' | 'crit' | 'hurt' | 'heal' | 'shield' | 'buff' | 'ailment' | 'miss' | 'none';
  actor: CueSide | null;
  target: CueSide | null;
  element: string;
  text: string;
  hpSide: CueSide | null;
  hpDelta: number;
  mpSide: CueSide | null;
  mpDelta: number;
  shieldSide: CueSide | null;
  shieldDelta: number;
}

/** 战报尚未走完时，界面按已出现的句子显示的体力和护盾。 */
export interface ShownVitals {
  playerHp: number;
  foeHp: number;
  playerMp: number;
  foeMp: number;
  playerShield: number;
  foeShield: number;
}

export interface ShownLimits {
  playerHp: number;
  foeHp: number;
  playerMp: number;
  foeMp: number;
}

export function blankCueMemory(): CueMemory {
  return { actor: null, form: '', element: '' };
}

export function elementColor(id: string): string {
  return TYPE_META[id as TypeId]?.color ?? '#fff6ec';
}

function other(side: CueSide | null): CueSide | null {
  if (side === 'player') return 'foe';
  if (side === 'foe') return 'player';
  return null;
}

function who(name: string, names: CueNames): CueSide | null {
  if (name === names.player) return 'player';
  if (name === names.foe) return 'foe';
  return null;
}

function empty(memory: CueMemory): BattleCue {
  return {
    kind: 'none',
    actor: memory.actor,
    target: null,
    element: memory.element,
    text: '',
    hpSide: null,
    hpDelta: 0,
    mpSide: null,
    mpDelta: 0,
    shieldSide: null,
    shieldDelta: 0,
  };
}

/** 只读战报文字，不改伤害结算。 */
export function readBattleCue(line: string, names: CueNames, memory: CueMemory): { cue: BattleCue; memory: CueMemory } {
  const used = line.match(/^(.+)使用了(.+)$/);
  if (used) {
    const actor = who(used[1], names);
    const move = used[2] === '普通攻击' ? null : SKILL_LIST.find((item) => item.name === used[2]);
    const form: SkillForm | '' = used[2] === '普通攻击' ? 'physical' : move ? skillForm(move) : '';
    const element = used[2] === '普通攻击' ? (actor === 'player' ? names.playerType : names.foeType) : move?.type ?? '';
    const next: CueMemory = { actor, form, element };
    const kind = form === 'magic' ? 'magic' : form === 'physical' ? 'physical' : 'none';
    const target = form === 'physical' || form === 'magic' ? other(actor) : actor;
    const cost = move?.cost ?? 0;
    return {
      cue: { ...empty(next), kind, actor, target, element, mpSide: cost > 0 ? actor : null, mpDelta: cost > 0 ? -cost : 0 },
      memory: next,
    };
  }
  const damage = line.match(/造成 (\d+) 点伤害/);
  if (damage && memory.actor) {
    const amount = Number(damage[1]);
    const absorbed = line.match(/护盾挡下 (\d+)/);
    const loss = Math.max(0, amount - (absorbed ? Number(absorbed[1]) : 0));
    const target = other(memory.actor);
    const crit = line.startsWith('暴击');
    return {
      cue: {
        ...empty(memory),
        kind: crit ? 'crit' : 'hurt',
        target,
        text: crit ? `暴击 ${amount}` : `-${amount}`,
        hpSide: target,
        hpDelta: -loss,
        shieldSide: absorbed ? target : null,
        shieldDelta: absorbed ? -Number(absorbed[1]) : 0,
      },
      memory,
    };
  }
  const recoil = line.match(/^(.+)受到反震 (\d+)$/);
  if (recoil) {
    const side = who(recoil[1], names);
    return { cue: { ...empty(memory), kind: 'hurt', actor: side, target: side, text: `-${recoil[2]}`, hpSide: side, hpDelta: -Number(recoil[2]) }, memory };
  }
  const heal = line.match(/^(.+?)(?:持续恢复了|恢复了) (\d+) 点体力$/);
  if (heal) {
    const side = who(heal[1], names);
    return { cue: { ...empty(memory), kind: 'heal', actor: side, target: side, text: `+${heal[2]}`, hpSide: side, hpDelta: Number(heal[2]) }, memory };
  }
  const mana = line.match(/^(.+)恢复了 (\d+) 点法力$/);
  if (mana) {
    const side = who(mana[1], names);
    return { cue: { ...empty(memory), kind: 'heal', actor: side, target: side, text: `法力 +${mana[2]}`, mpSide: side, mpDelta: Number(mana[2]) }, memory };
  }
  const shield = line.match(/^(.+)获得 (\d+) 点护盾$/);
  if (shield) {
    const side = who(shield[1], names);
    return { cue: { ...empty(memory), kind: 'shield', actor: side, target: side, text: `护盾 +${shield[2]}`, shieldSide: side, shieldDelta: Number(shield[2]) }, memory };
  }
  if (/的(攻击|防御|速度)上升了$/.test(line)) {
    const side = who(line.split('的')[0], names);
    return { cue: { ...empty(memory), kind: 'buff', actor: side, target: side, text: '强化' }, memory };
  }
  if (/灼伤了|中毒了|麻痹了|睡着了|被附上持续伤害/.test(line)) {
    const side = memory.actor ? other(memory.actor) : null;
    const text = line.includes('睡着') ? '睡眠' : line.includes('中毒') ? '中毒' : line.includes('麻痹') ? '麻痹' : line.includes('灼伤') ? '灼伤' : '持续';
    return { cue: { ...empty(memory), kind: 'ailment', target: side, text }, memory };
  }
  const statusHit = line.match(/^(.+)受到(?:灼伤|中毒|持续)伤害 (\d+)$/);
  if (statusHit) {
    const side = who(statusHit[1], names);
    return { cue: { ...empty(memory), kind: 'hurt', actor: side, target: side, text: `-${statusHit[2]}`, hpSide: side, hpDelta: -Number(statusHit[2]) }, memory };
  }
  if (line.includes('没有命中') || line.includes('闪避')) {
    const target = memory.actor ? other(memory.actor) : null;
    return { cue: { ...empty(memory), kind: 'miss', target, text: '未命中' }, memory };
  }
  return { cue: empty(memory), memory };
}

export function applyShownCue(shown: ShownVitals, cue: BattleCue, limits: ShownLimits): ShownVitals {
  const cap = (value: number, max: number) => Math.max(0, Math.min(max, value));
  const next = { ...shown };
  if (cue.hpSide === 'player') next.playerHp = cap(next.playerHp + cue.hpDelta, limits.playerHp);
  if (cue.hpSide === 'foe') next.foeHp = cap(next.foeHp + cue.hpDelta, limits.foeHp);
  if (cue.mpSide === 'player') next.playerMp = cap(next.playerMp + cue.mpDelta, limits.playerMp);
  if (cue.mpSide === 'foe') next.foeMp = cap(next.foeMp + cue.mpDelta, limits.foeMp);
  if (cue.shieldSide === 'player') next.playerShield = Math.max(0, next.playerShield + cue.shieldDelta);
  if (cue.shieldSide === 'foe') next.foeShield = Math.max(0, next.foeShield + cue.shieldDelta);
  return next;
}
