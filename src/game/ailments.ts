import type { AilmentName, MoveDef } from './types';

export const PARALYZE_SKIP = 0.25;
export const BURN_FRACTION = 1 / 16;
export const POISON_FRACTION = 1 / 12;
export const STATUS_HP_CAP = 0.08;

export const AILMENT_LABEL: Record<Exclude<AilmentName, ''>, string> = {
  burn: '灼伤',
  poison: '中毒',
  paralyze: '麻痹',
  sleep: '睡眠',
};

export function moveEffectLabel(move: Pick<MoveDef, 'cat' | 'effect' | 'stat'>): string {
  const ailment = ailmentOf(move);
  if (ailment) return AILMENT_LABEL[ailment];
  if (move.effect === 'shield' || move.effect === 'ward') return '护盾';
  if (move.cat === 'heal') return '治疗';
  if (move.cat === 'aid') return '强化';
  if (move.effect === 'recoil') return '反伤';
  if (move.effect === 'pierce') return '破防';
  if (move.effect === 'dotstrike') return '持续';
  if (move.cat === 'attack') return '直击';
  return '';
}

export function ailmentOf(move: Pick<MoveDef, 'cat' | 'effect' | 'stat'>): AilmentName {
  if (move.effect === 'root') return 'sleep';
  if (move.cat !== 'status' || move.effect !== 'blight') return '';
  if (move.stat === 'def') return 'poison';
  if (move.stat === 'spd') return 'paralyze';
  return 'burn';
}

export function statusLoss(maxHp: number, fraction: number): number {
  const raw = Math.floor(maxHp * fraction);
  const cap = Math.floor(maxHp * STATUS_HP_CAP);
  return Math.max(1, Math.min(cap, raw));
}
