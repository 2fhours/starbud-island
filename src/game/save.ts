import { getSpecies, SPECIES_LIST } from './data';
import { emptyDex, ensureLoadout, maxHp, maxMp } from './logic';
import { convertLegacyHp, ivFromUid, legacyMaxHp, validIvs } from './stats';
import type { Dir, Five, MapId, Mon, PlayState, SpeciesId, TypeId } from './types';
import { SAVE_KEY } from './types';
import { TYPE_META } from './elements';
import { canWalkPixel, tileCenter, worldFor } from './world';

const DIRS = new Set<Dir>(['down', 'up', 'left', 'right']);
const SPECIES = new Set<SpeciesId>(SPECIES_LIST.map((species) => species.id));

function asMon(value: unknown): Mon | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<Mon>;
  if (typeof raw.speciesId !== 'string' || !SPECIES.has(raw.speciesId as SpeciesId)) return null;
  if (typeof raw.level !== 'number' || raw.level < 1 || raw.level > 30) return null;
  const speciesId = raw.speciesId as SpeciesId;
  const aspect = typeof raw.aspect === 'string' && raw.aspect in TYPE_META ? raw.aspect as TypeId : getSpecies(speciesId).type;
  const uid = typeof raw.uid === 'string' ? raw.uid : 'restored';
  const level = Math.floor(raw.level);
  let migrated = false;
  let ivs: Five;
  if (validIvs(raw.ivs)) {
    ivs = raw.ivs;
    migrated = true;
  } else ivs = ivFromUid(uid);
  const mon: Mon = {
    uid,
    speciesId,
    level,
    exp: typeof raw.exp === 'number' && raw.exp >= 0 ? Math.floor(raw.exp) : 0,
    hp: typeof raw.hp === 'number' ? Math.floor(raw.hp) : 1,
    mp: 0,
    ivs,
    stages: { atk: 0, def: 0, spd: 0 },
    aspect,
    moves: Array.isArray(raw.moves) ? raw.moves.filter((id) => typeof id === 'string') : [],
  };
  const cap = maxHp(mon);
  if (migrated) mon.hp = Math.max(0, Math.min(cap, mon.hp));
  else mon.hp = convertLegacyHp(mon.hp, legacyMaxHp(speciesId, level), cap);
  const mpCap = maxMp(mon);
  mon.mp = typeof raw.mp === 'number' ? Math.max(0, Math.min(mpCap, Math.floor(raw.mp))) : mpCap;
  ensureLoadout(mon);
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
    const mapId: MapId = play.mapId === 'ridge' ? 'ridge' : 'island';
    const world = worldFor(mapId);
    let x = play.x;
    let y = play.y;
    if (!canWalkPixel(world, x, y)) {
      const spawn = tileCenter(world.spawnTile.x, world.spawnTile.y);
      x = spawn.x;
      y = spawn.y;
    }
    return {
      name: play.name.slice(0, 8),
      x,
      y,
      dir: play.dir,
      mapId,
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
      ridgeQuest: {
        introduced: !!play.ridgeQuest?.introduced,
        caught: !!play.ridgeQuest?.caught,
        trial: !!play.ridgeQuest?.trial,
        completed: !!play.ridgeQuest?.completed,
      },
      pickups: Array.isArray(play.pickups) ? play.pickups.filter((id) => typeof id === 'string') : [],
      trainers: {
        qinghe: !!play.trainers?.qinghe,
        lanchuan: !!play.trainers?.lanchuan,
        shiling: !!play.trainers?.shiling,
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
