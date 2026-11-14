export type TypeId = 'grass' | 'fire' | 'water' | 'electric' | 'rock' | 'wind';

export type SpeciesId =
  | 'lujiao'
  | 'yanwei'
  | 'luzhu'
  | 'dianrong'
  | 'yanke'
  | 'fengling'
  | 'taibei'
  | 'xiwen';

export type MoveId =
  | 'yeren'
  | 'guanghe'
  | 'huohua'
  | 'weiyan'
  | 'shuidan'
  | 'paomo'
  | 'jingdian'
  | 'dianchong'
  | 'luoshi'
  | 'suoke'
  | 'jifeng'
  | 'lingyin'
  | 'tengda'
  | 'mengbao'
  | 'langda'
  | 'chaopai';

export type MoveKind = 'damage' | 'heal' | 'buff' | 'debuff';

export type Dir = 'down' | 'up' | 'left' | 'right';

export type Timing = 'perfect' | 'good' | 'close' | 'miss';

export interface MoveDef {
  id: MoveId;
  name: string;
  type: TypeId;
  power: number;
  kind: MoveKind;
  desc: string;
}

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  type: TypeId;
  catchRate: number;
  baseExp: number;
  bases: { hp: number; atk: number; def: number; spd: number };
  moves: [MoveId, MoveId];
  blurb: string;
  dex: string;
}

export interface Mon {
  uid: string;
  speciesId: SpeciesId;
  level: number;
  exp: number;
  hp: number;
  stages: { atk: number; def: number };
}

export interface QuestFlags {
  introduced: boolean;
  caughtWild: boolean;
  bossDefeated: boolean;
  completed: boolean;
}

export interface PlayState {
  name: string;
  x: number;
  y: number;
  dir: Dir;
  team: Mon[];
  box: Mon[];
  dex: Record<SpeciesId, { seen: boolean; caught: boolean }>;
  balls: number;
  quest: QuestFlags;
  pickups: string[];
  trainers: { qinghe: boolean; lanchuan: boolean };
  playMs: number;
}

export const SAVE_KEY = 'xingya-island-save-v1';
export const MUTE_KEY = 'xingya-island-mute';
export const MUSIC_ON_KEY = 'xingya-island-music';
export const MUSIC_VOL_KEY = 'xingya-island-music-volume';
export const MAX_LEVEL = 30;
export const TEAM_LIMIT = 6;
export const BALL_TOP_UP = 8;
export const START_BALLS = 12;
