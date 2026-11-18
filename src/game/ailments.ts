import type { AilmentName, MoveDef } from './types';

export const BURN_PHYS_MUL = 0.85;
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
