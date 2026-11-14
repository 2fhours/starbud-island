import { getSpecies } from './data';
import { emptyDex, maxHp } from './logic';
import type { Dir, Mon, PlayState, SpeciesId } from './types';
import { SAVE_KEY } from './types';

const DIRS = new Set<Dir>(['down', 'up', 'left', 'right']);
const SPECIES = new Set<SpeciesId>(['lujiao', 'yanwei', 'luzhu', 'dianrong', 'yanke', 'fengling', 'taibei', 'xiwen']);

function asMon(value: unknown): Mon | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<Mon>;
  if (typeof raw.speciesId !== 'string' || !SPECIES.has(raw.speciesId as SpeciesId)) return null;
  if (typeof raw.level !== 'number' || raw.level < 1 || raw.level > 30) return null;
  const speciesId = raw.speciesId as SpeciesId;
  const mon: Mon = {
    uid: typeof raw.uid === 'string' ? raw.uid : 'restored',
    speciesId,
    level: Math.floor(raw.level),
    exp: typeof raw.exp === 'number' && raw.exp >= 0 ? Math.floor(raw.exp) : 0,
    hp: typeof raw.hp === 'number' ? Math.floor(raw.hp) : 1,
    stages: { atk: 0, def: 0 },
  };
  mon.hp = Math.max(0, Math.min(maxHp(mon), mon.hp));
  getSpecies(speciesId);
  return mon;
}

export function serialize(play: PlayState): string {
  return JSON.stringify({ version: 1, play });
}

export function deserialize(raw: string | null): PlayState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { version?: number; play?: PlayState };
    if (data.version !== 1 || !data.play) return null;
    const play = data.play;
    if (typeof play.name !== 'string' || !play.name) return null;
    if (typeof play.x !== 'number' || typeof play.y !== 'number') return null;
    if (!DIRS.has(play.dir)) return null;
    if (!Array.isArray(play.team) || play.team.length < 1) return null;
    const team = play.team.map(asMon);
    const box = Array.isArray(play.box) ? play.box.map(asMon) : [];
    if (team.some((mon) => !mon) || box.some((mon) => !mon)) return null;
    const dex = emptyDex();
    for (const id of SPECIES) {
      const entry = play.dex?.[id];
      if (entry && typeof entry === 'object') {
        dex[id] = { seen: !!entry.seen, caught: !!entry.caught };
      }
    }
    for (const mon of team as Mon[]) dex[mon.speciesId].seen = true;
    return {
      name: play.name.slice(0, 8),
      x: play.x,
      y: play.y,
      dir: play.dir,
      team: team as Mon[],
      box: box as Mon[],
      dex,
      balls: typeof play.balls === 'number' ? Math.max(0, Math.floor(play.balls)) : 0,
      quest: {
        introduced: !!play.quest?.introduced,
        caughtWild: !!play.quest?.caughtWild,
        bossDefeated: !!play.quest?.bossDefeated,
        completed: !!play.quest?.completed,
      },
      pickups: Array.isArray(play.pickups) ? play.pickups.filter((id) => typeof id === 'string') : [],
      trainers: {
        qinghe: !!play.trainers?.qinghe,
        lanchuan: !!play.trainers?.lanchuan,
      },
      playMs: typeof play.playMs === 'number' ? play.playMs : 0,
    };
  } catch {
    return null;
  }
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readSave(storage: StorageLike): PlayState | null {
  try {
    return deserialize(storage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

export function writeSave(storage: StorageLike, play: PlayState): boolean {
  try {
    storage.setItem(SAVE_KEY, serialize(play));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: StorageLike): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    /* private mode */
  }
}
