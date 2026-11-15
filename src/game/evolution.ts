import type { Five, ItemBag, ItemId, MapId, Mon, SpeciesId } from './types';

export const RACE_FLAT = 4;
export const RACE_PEAK = 6;
export const EXP_STEP = 8;
export const CATCH_STEP = 20;
export const CATCH_FLOOR = 40;
export const GATHER_STEPS = 40;

export type { ItemBag, ItemId };

export const ITEM_LABEL: Record<ItemId, string> = {
  yanxinshi: '焰心石',
  qingfengling: '清风铃',
};

const STATS = ['con', 'str', 'int', 'spi', 'spd'] as const;

export function peakStat(race: Five): (typeof STATS)[number] {
  let best: (typeof STATS)[number] = 'con';
  for (const key of STATS) if (race[key] > race[best]) best = key;
  return best;
}

export function raceAtStage(base: Five, stage: number): Five {
  const steps = Math.max(0, stage - 1);
  const peak = peakStat(base);
  const next: Five = { con: 0, str: 0, int: 0, spi: 0, spd: 0 };
  for (const key of STATS) next[key] = base[key] + steps * RACE_FLAT;
  next[peak] += steps * RACE_PEAK;
  return next;
}

export interface EvoStep {
  id: SpeciesId;
  stage: 1 | 2 | 3;
  level?: number;
  item?: ItemId;
  mapId?: MapId;
}

export const EVOLUTION_LINES: EvoStep[][] = [
  [{ id: 'lujiao', stage: 1 }, { id: 'cuizhi', stage: 2, level: 14 }, { id: 'senmian', stage: 3, level: 32 }],
  [{ id: 'yanwei', stage: 1 }, { id: 'huowen', stage: 2, level: 14 }, { id: 'chiyan', stage: 3, level: 33, item: 'yanxinshi' }],
  [{ id: 'luzhu', stage: 1 }, { id: 'linlu', stage: 2, level: 13 }, { id: 'jinglu', stage: 3, level: 30 }],
  [{ id: 'dianrong', stage: 1 }, { id: 'shanrong', stage: 2, level: 12 }, { id: 'tingrong', stage: 3, level: 31 }],
  [{ id: 'yanke', stage: 1 }, { id: 'panjia', stage: 2, level: 18 }],
  [{ id: 'fengling', stage: 1 }, { id: 'lingyu', stage: 2, level: 15 }, { id: 'yaoling', stage: 3, level: 32, item: 'qingfengling' }],
  [{ id: 'taibei', stage: 1 }, { id: 'senbei', stage: 2, level: 17 }],
  [{ id: 'xiwen', stage: 1 }, { id: 'chaowen', stage: 2, level: 15 }, { id: 'canglan', stage: 3, level: 32 }],
  [{ id: 'wudeng', stage: 1 }, { id: 'wuhui', stage: 2, level: 18 }, { id: 'landeng', stage: 3, level: 34, mapId: 'ridge' }],
  [{ id: 'yunyang', stage: 1 }, { id: 'lanjiao', stage: 2, level: 22 }],
  [{ id: 'luoxing', stage: 1 }, { id: 'xingyi', stage: 2, level: 19 }, { id: 'liuxing', stage: 3, level: 35 }],
  [{ id: 'hanquan', stage: 1 }, { id: 'shuangquan', stage: 2, level: 21 }],
];

const BY_ID = new Map<SpeciesId, { line: EvoStep[]; index: number }>();
for (const line of EVOLUTION_LINES) {
  line.forEach((step, index) => BY_ID.set(step.id, { line, index }));
}

export function familyBase(id: SpeciesId): SpeciesId {
  return BY_ID.get(id)?.line[0].id ?? id;
}

export function familyStage(id: SpeciesId): number {
  return BY_ID.get(id)?.line.find((step) => step.id === id)?.stage ?? 1;
}

export function nextStep(id: SpeciesId): EvoStep | null {
  const found = BY_ID.get(id);
  if (!found) return null;
  return found.line[found.index + 1] ?? null;
}

export function emptyItems(): ItemBag {
  return { yanxinshi: 0, qingfengling: 0 };
}

export function itemFromWild(speciesId: SpeciesId): ItemId | null {
  if (speciesId === 'yanwei') return 'yanxinshi';
  if (speciesId === 'fengling') return 'qingfengling';
  return null;
}

export interface EvoContext {
  mapId: MapId;
  items: ItemBag;
}

export interface EvoStatus {
  ready: boolean;
  final: boolean;
  to: SpeciesId | null;
  line: string;
  item: ItemId | null;
}

export function evolutionStatus(mon: Pick<Mon, 'speciesId' | 'level'>, ctx: EvoContext, names: (id: SpeciesId) => string): EvoStatus {
  const next = nextStep(mon.speciesId);
  if (!next) return { ready: false, final: true, to: null, line: '最终形态', item: null };
  const name = names(next.id);
  const item = next.item ?? null;
  const needLevel = next.level ?? 1;
  const levelOk = mon.level >= needLevel;
  const itemOk = !item || (ctx.items[item] ?? 0) >= 1;
  const mapOk = !next.mapId || ctx.mapId === next.mapId;
  const held = item ? ctx.items[item] ?? 0 : 0;
  const bits = [`下一形态${name}`];
  if (!levelOk) bits.push(`还要到 ${needLevel} 级，现在 ${mon.level} 级`);
  else bits.push(`已经到 ${needLevel} 级`);
  if (item) {
    bits.push(itemOk ? `会消耗 1 个${ITEM_LABEL[item]}` : `还缺 1 个${ITEM_LABEL[item]}，现在持有 ${held} 个`);
  }
  if (next.mapId === 'ridge') {
    bits.push(mapOk ? '现在就在星雾岭' : '先去星雾岭再进化');
  }
  return {
    ready: levelOk && itemOk && mapOk,
    final: false,
    to: next.id,
    line: `${bits.join('。')}。`,
    item,
  };
}
