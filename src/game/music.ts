export type TrackName = 'explore' | 'battle' | 'ridge';

export interface ScoreNote {
  beat: number;
  midi: number;
  dur: number;
  vel: number;
}

export interface Score {
  bpm: number;
  beats: number;
  melody: ScoreNote[];
  harmony: ScoreNote[];
}

function notes(rows: number[][]): ScoreNote[] {
  return rows.map(([beat, midi, dur, vel]) => ({ beat, midi, dur, vel }));
}

/** 原创探索乐句：G 大调，慢速，旋律加长音和声。 */
export const EXPLORE_SCORE: Score = {
  bpm: 74,
  beats: 16,
  melody: notes([
    [0, 67, 1.4, 0.62],
    [2, 71, 0.9, 0.55],
    [3, 74, 0.9, 0.58],
    [4, 72, 1.6, 0.56],
    [6, 71, 0.8, 0.5],
    [7, 69, 0.8, 0.5],
    [8, 67, 1.4, 0.6],
    [10, 64, 0.8, 0.46],
    [11, 67, 0.8, 0.52],
    [12, 69, 1.6, 0.58],
    [14, 71, 1.4, 0.54],
  ]),
  harmony: notes([
    [0, 55, 4, 0.28],
    [4, 57, 4, 0.26],
    [8, 55, 4, 0.28],
    [12, 59, 4, 0.24],
  ]),
};

/** 原创战斗乐句：更密的四分节奏，音量不高于探索。 */
export const BATTLE_SCORE: Score = {
  bpm: 112,
  beats: 8,
  melody: notes([
    [0, 69, 0.45, 0.58],
    [1, 72, 0.4, 0.52],
    [2, 76, 0.7, 0.6],
    [3, 74, 0.4, 0.5],
    [4, 72, 0.45, 0.56],
    [5, 69, 0.4, 0.5],
    [6, 67, 0.7, 0.54],
    [7, 72, 0.45, 0.52],
  ]),
  harmony: notes([
    [0, 57, 1.8, 0.26],
    [2, 55, 1.8, 0.24],
    [4, 52, 1.8, 0.26],
    [6, 55, 1.8, 0.24],
  ]),
};

export function trackForMode(mode: string, mapId = 'island'): TrackName {
  if (mode === 'battle') return 'battle';
  if (mapId === 'ridge') return 'ridge';
  return 'explore';
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 70;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** 原创岭上乐句：D 多利亚，比岛上更慢，音量上限与探索相同。 */
export const RIDGE_SCORE: Score = {
  bpm: 66,
  beats: 16,
  melody: notes([
    [0, 62, 1.8, 0.5],
    [2, 65, 1.2, 0.46],
    [4, 69, 1.6, 0.52],
    [6, 67, 1.2, 0.46],
    [8, 65, 1.8, 0.5],
    [10, 62, 1.2, 0.44],
    [12, 60, 1.6, 0.48],
    [14, 62, 1.4, 0.46],
  ]),
  harmony: notes([
    [0, 50, 4, 0.22],
    [4, 53, 4, 0.2],
    [8, 50, 4, 0.22],
    [12, 48, 4, 0.2],
  ]),
};

export function scoreFor(track: TrackName): Score {
  if (track === 'battle') return BATTLE_SCORE;
  if (track === 'ridge') return RIDGE_SCORE;
  return EXPLORE_SCORE;
}

export function musicBusTargets(track: TrackName | 'idle', volume: number): { explore: number; battle: number } {
  if (track === 'idle' || volume <= 0) return { explore: 0, battle: 0 };
  const level = (volume / 100) * (track === 'battle' ? 0.2 : 0.18);
  return { explore: track === 'battle' ? 0 : level, battle: track === 'battle' ? level : 0 };
}
