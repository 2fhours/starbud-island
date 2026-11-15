import type { Five, SpeciesId } from './types';

export const IV_MAX = 31;

const LEGACY_HP: Record<SpeciesId, number> = {
  lujiao: 50,
  yanwei: 44,
  luzhu: 52,
  dianrong: 40,
  yanke: 64,
  fengling: 42,
  taibei: 70,
  xiwen: 54,
};

export function clampStat(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function rollIvs(rng: () => number = Math.random): Five {
  const roll = () => clampStat(Math.floor(rng() * (IV_MAX + 1)), 0, IV_MAX);
  return { con: roll(), str: roll(), int: roll(), spi: roll(), spd: roll() };
}

export function ivFromUid(uid: string): Five {
  let hash = 2166136261;
  for (const char of uid || 'missing') {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const mix = (salt: number) => {
    let value = hash ^ Math.imul(salt, 0x9e3779b1);
    value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
    value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
    value ^= value >>> 16;
    return (value >>> 0) % (IV_MAX + 1);
  };
  return { con: mix(1), str: mix(2), int: mix(3), spi: mix(4), spd: mix(5) };
}

export function validIvs(value: unknown): value is Five {
  if (!value || typeof value !== 'object') return false;
  const raw = value as Partial<Five>;
  return (['con', 'str', 'int', 'spi', 'spd'] as const).every((key) => {
    const stat = raw[key];
    return typeof stat === 'number' && Number.isInteger(stat) && stat >= 0 && stat <= IV_MAX;
  });
}

export function coreStat(race: number, iv: number, level: number): number {
  const potential = race + clampStat(Math.round(iv), 0, IV_MAX);
  return Math.floor((potential * (level + 8)) / 20);
}

export function fiveCores(race: Five, ivs: Five, level: number): Five {
  return {
    con: coreStat(race.con, ivs.con, level),
    str: coreStat(race.str, ivs.str, level),
    int: coreStat(race.int, ivs.int, level),
    spi: coreStat(race.spi, ivs.spi, level),
    spd: coreStat(race.spd, ivs.spd, level),
  };
}

export function maxHpFrom(core: Five, level: number): number {
  return Math.floor((core.con * 8) / 5) + level + 12;
}

export function maxMpFrom(core: Five, level: number): number {
  return Math.floor((core.spi * 6) / 5) + level + 6;
}

export function physAtk(core: Five): number {
  return Math.floor((core.str * 3) / 5) + 6;
}

export function physDef(core: Five): number {
  return Math.floor((core.con * 2) / 5) + Math.floor(core.str / 5) + 4;
}

export function magAtk(core: Five): number {
  return Math.floor((core.int * 3) / 5) + 6;
}

export function magDef(core: Five): number {
  return Math.floor((core.int * 3) / 10) + Math.floor((core.spi * 3) / 10) + 4;
}

export function actionSpeed(core: Five): number {
  return Math.floor((core.spd * 7) / 10) + 4;
}

export function hitChance(spirit: number, speedPoint: number): number {
  return clampStat(0.78 + spirit / 480 + speedPoint / 700, 0.78, 0.96);
}

export function evasionChance(speedPoint: number): number {
  return clampStat(0.03 + speedPoint / 650, 0.03, 0.16);
}

export function legacyMaxHp(speciesId: SpeciesId, level: number): number {
  const base = LEGACY_HP[speciesId];
  return Math.floor((base * 2 * level) / 40) + level + 12;
}

export function convertLegacyHp(rawHp: number, oldMax: number, newMax: number): number {
  if (newMax < 1) return 0;
  if (rawHp >= oldMax && oldMax > 0) return newMax;
  const scaled = oldMax > 0 ? Math.round((newMax * Math.max(0, rawHp)) / oldMax) : Math.round(rawHp);
  const hp = clampStat(scaled, 0, newMax);
  if (rawHp > 0 && hp === 0) return 1;
  return hp;
}

export interface DerivedStats {
  core: Five;
  maxHp: number;
  maxMp: number;
  physAtk: number;
  physDef: number;
  magAtk: number;
  magDef: number;
  action: number;
  hit: number;
  evasion: number;
}

export function derive(race: Five, ivs: Five, level: number): DerivedStats {
  const core = fiveCores(race, ivs, level);
  return {
    core,
    maxHp: maxHpFrom(core, level),
    maxMp: maxMpFrom(core, level),
    physAtk: physAtk(core),
    physDef: physDef(core),
    magAtk: magAtk(core),
    magDef: magDef(core),
    action: actionSpeed(core),
    hit: hitChance(core.spi, core.spd),
    evasion: evasionChance(core.spd),
  };
}
