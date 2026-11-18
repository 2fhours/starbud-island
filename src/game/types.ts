export type ElementId = 'jin' | 'mu' | 'shui' | 'huo' | 'tu';

export type TypeId =
  | 'yinjin'
  | 'yangjin'
  | 'yinmu'
  | 'yangmu'
  | 'yinshui'
  | 'yangshui'
  | 'yinhuo'
  | 'yanghuo'
  | 'yintu'
  | 'yangtu'
  | 'chunyin'
  | 'chunyang';

export type MoveTier = 'basic' | 'mid' | 'high' | 'divine';
export type MoveCat = 'attack' | 'guard' | 'heal' | 'aid' | 'status';
export type MoveEffect =
  | 'strike'
  | 'pierce'
  | 'recoil'
  | 'dotstrike'
  | 'shield'
  | 'ward'
  | 'mend'
  | 'hot'
  | 'cleanse'
  | 'buff'
  | 'blight'
  | 'root';

export type SpeciesId =
  | 'lujiao'
  | 'cuizhi'
  | 'senmian'
  | 'yanwei'
  | 'huowen'
  | 'chiyan'
  | 'luzhu'
  | 'linlu'
  | 'jinglu'
  | 'dianrong'
  | 'shanrong'
  | 'tingrong'
  | 'yanke'
  | 'panjia'
  | 'fengling'
  | 'lingyu'
  | 'yaoling'
  | 'taibei'
  | 'senbei'
  | 'xiwen'
  | 'chaowen'
  | 'canglan'
  | 'wudeng'
  | 'wuhui'
  | 'landeng'
  | 'yunyang'
  | 'lanjiao'
  | 'luoxing'
  | 'xingyi'
  | 'liuxing'
  | 'hanquan'
  | 'shuangquan';

export type MapId = 'island' | 'ridge';
export type ItemId = 'yanxinshi' | 'qingfengling';

export interface ItemBag {
  yanxinshi: number;
  qingfengling: number;
}

export type MoveId = string;
export type AttackKind = 'physical' | 'magic';

export interface Five {
  con: number;
  str: number;
  int: number;
  spi: number;
  spd: number;
}

export type Dir = 'down' | 'up' | 'left' | 'right';
export type Timing = 'perfect' | 'good' | 'close' | 'miss';

export interface MoveDef {
  id: string;
  name: string;
  type: TypeId;
  tier: MoveTier;
  cat: MoveCat;
  effect: MoveEffect;
  target: 'foe' | 'self';
  power: number;
  ratio: number;
  chance: number;
  turns: number;
  cooldown: number;
  cost: number;
  kind: AttackKind | '';
  stat: 'atk' | 'def' | 'spd' | '';
  cleanse: boolean;
  bonusFlat: number;
  bonusPercent: number;
  cutFlat: number;
  cutPercent: number;
  critRate: number;
  critDamage: number;
  desc: string;
}

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  type: TypeId;
  catchRate: number;
  baseExp: number;
  race: Five;
  moves: [string, string];
  blurb: string;
  dex: string;
}

export type AilmentName = '' | 'burn' | 'poison' | 'paralyze' | 'sleep';

export interface Fighter {
  mon: Mon;
  shield: number;
  dotTurns: number;
  dotRatio: number;
  hotTurns: number;
  hotRatio: number;
  rootTurns: number;
  ailment: AilmentName;
  ailmentTurns: number;
  ailmentChecked: boolean;
  bonusFlat: number;
  bonusPercent: number;
  cutFlat: number;
  cutPercent: number;
  critRate: number;
  critDamage: number;
  cd: Record<string, number>;
}

export interface Mon {
  uid: string;
  speciesId: SpeciesId;
  level: number;
  exp: number;
  hp: number;
  mp: number;
  ivs: Five;
  stages: { atk: number; def: number; spd: number };
  aspect?: TypeId;
  moves?: string[];
}

export interface QuestFlags {
  introduced: boolean;
  caughtWild: boolean;
  bossDefeated: boolean;
  completed: boolean;
}

export interface RidgeQuest {
  introduced: boolean;
  caught: boolean;
  trial: boolean;
  completed: boolean;
}

export interface PlayState {
  name: string;
  x: number;
  y: number;
  dir: Dir;
  mapId: MapId;
  team: Mon[];
  box: Mon[];
  dex: Record<SpeciesId, { seen: boolean; caught: boolean }>;
  balls: number;
  items: ItemBag;
  steps: number;
  gather: Record<string, number>;
  quest: QuestFlags;
  ridgeQuest: RidgeQuest;
  pickups: string[];
  trainers: { qinghe: boolean; lanchuan: boolean; shiling: boolean };
  playMs: number;
}

export const SAVE_KEY = 'xingya-island-save-v1';
export const MUTE_KEY = 'xingya-island-mute';
export const MUSIC_ON_KEY = 'xingya-island-music';
export const MUSIC_VOL_KEY = 'xingya-island-music-volume';
export const DRAG_HINT_KEY = 'xingya-island-drag-hint';
export const MAX_LEVEL = 40;
export const TEAM_LIMIT = 6;
export const BALL_TOP_UP = 8;
export const START_BALLS = 12;
export const LOADOUT_LIMIT = 4;

export const TIER_LEVEL: Record<MoveTier, number> = { basic: 1, mid: 8, high: 16, divine: 24 };
export const TIER_LABEL: Record<MoveTier, string> = { basic: '初级', mid: '中级', high: '高级', divine: '神级' };
export const CAT_LABEL: Record<MoveCat, string> = { attack: '攻击', guard: '防御', heal: '治疗', aid: '辅助', status: '状态' };
