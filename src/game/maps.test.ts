import { describe, expect, it } from 'vitest';
import { RIDGE_SPECIES, RIDGE_TRIAL } from './data';
import { deserialize } from './save';
import { gateChoice, createRidge, createWorld, isWalkable, pathExists } from './world';

describe('两张地图', () => {
  const island = createWorld();
  const ridge = createRidge();

  it('岛和岭的野生芽灵互不重复，等级也分开', () => {
    const islandIds = new Set(island.spawns.map((spawn) => spawn.speciesId));
    const ridgeIds = new Set(ridge.spawns.map((spawn) => spawn.speciesId));
    for (const id of islandIds) expect(ridgeIds.has(id)).toBe(false);
    for (const id of RIDGE_SPECIES) expect(islandIds.has(id)).toBe(false);
    expect(ridgeIds.size).toBe(4);
    expect(island.spawns.every((spawn) => spawn.level >= 3 && spawn.level <= 6)).toBe(true);
    expect(ridge.spawns.every((spawn) => spawn.level >= 8 && spawn.level <= 12)).toBe(true);
    expect(RIDGE_TRIAL.map((entry) => entry.level)).toEqual([13, 14, 13]);
    expect(new Set(island.spawns.map((spawn) => spawn.id)).size).toBe(island.spawns.length);
    expect(new Set(ridge.spawns.map((spawn) => spawn.id)).size).toBe(ridge.spawns.length);
    for (const id of island.spawns.map((spawn) => spawn.id)) {
      expect(ridge.spawns.some((spawn) => spawn.id === id)).toBe(false);
    }
  });

  it('路口看得见，南北都能走通，最外端不是假地图', () => {
    const north = island.gates.find((gate) => gate.id === 'island-north');
    const south = island.gates.find((gate) => gate.id === 'island-south');
    const ridgeSouth = ridge.gates.find((gate) => gate.id === 'ridge-south');
    const ridgeNorth = ridge.gates.find((gate) => gate.id === 'ridge-north');
    expect(north && south && ridgeSouth && ridgeNorth).toBeTruthy();
    expect(north!.y).not.toBe(south!.y);
    expect(ridgeSouth!.y).toBeGreaterThan(ridgeNorth!.y);
    expect(pathExists(island, island.spawnTile.x, island.spawnTile.y, north!.x, north!.y)).toBe(true);
    expect(pathExists(island, island.spawnTile.x, island.spawnTile.y, south!.x, south!.y)).toBe(true);
    expect(pathExists(ridge, ridge.spawnTile.x, ridge.spawnTile.y, ridgeSouth!.x, ridgeSouth!.y)).toBe(true);
    expect(pathExists(ridge, ridge.spawnTile.x, ridge.spawnTile.y, ridgeNorth!.x, ridgeNorth!.y)).toBe(true);
    for (const spawn of ridge.spawns) {
      expect(pathExists(ridge, ridge.spawnTile.x, ridge.spawnTile.y, spawn.x, spawn.y), spawn.id).toBe(true);
    }
    expect(south!.kind).toBe('sealed');
    expect(south!.to).toBeNull();
    expect(ridgeNorth!.kind).toBe('sealed');
    expect(ridgeNorth!.to).toBeNull();
  });

  it('委托没完成时北岭关着，完成后往返都落在路口外面', () => {
    const north = island.gates.find((gate) => gate.id === 'island-north')!;
    const ridgeSouth = ridge.gates.find((gate) => gate.id === 'ridge-south')!;
    expect(gateChoice(false, north)).toBe('stay');
    expect(gateChoice(true, north)).toBe('go');
    expect(gateChoice(true, island.gates.find((gate) => gate.id === 'island-south')!)).toBe('stay');
    expect(north.to).toBe('ridge');
    expect(north.arriveX).toBe(ridgeSouth.x);
    expect(Math.abs(north.arriveY - ridgeSouth.y)).toBeGreaterThanOrEqual(2);
    expect(isWalkable(ridge, north.arriveX, north.arriveY)).toBe(true);
    expect(ridgeSouth.to).toBe('island');
    expect(Math.abs(ridgeSouth.arriveY - north.y)).toBeGreaterThanOrEqual(2);
    expect(isWalkable(island, ridgeSouth.arriveX, ridgeSouth.arriveY)).toBe(true);
    expect(ridge.spawnTile.x !== ridgeSouth.x || ridge.spawnTile.y !== ridgeSouth.y).toBe(true);
    expect(isWalkable(ridge, ridge.spawnTile.x, ridge.spawnTile.y)).toBe(true);
  });

  it('旧档仍在星芽岛，完成过的委托立刻可以上岭，再读一次不变', () => {
    const legacy = JSON.stringify({
      version: 1,
      play: {
        name: '旧档',
        x: 100,
        y: 200,
        dir: 'down',
        team: [{ uid: 'old', speciesId: 'yanwei', level: 7, exp: 3, hp: 12 }],
        dex: { yanwei: { seen: true, caught: true } },
        balls: 4,
        quest: { introduced: true, caughtWild: true, bossDefeated: true, completed: true },
        pickups: ['balls-south'],
        trainers: { qinghe: true, lanchuan: true },
        playMs: 5000,
      },
    });
    const once = deserialize(legacy);
    const twice = deserialize(JSON.stringify({ version: 1, play: once }));
    expect(once?.mapId).toBe('island');
    expect(once?.quest.completed).toBe(true);
    expect(once?.ridgeQuest).toEqual({ introduced: false, caught: false, trial: false, completed: false });
    expect(once?.trainers.shiling).toBe(false);
    expect(once?.pickups).toEqual(['balls-south']);
    expect(twice).toEqual(once);
    const north = island.gates.find((gate) => gate.id === 'island-north')!;
    expect(gateChoice(!!once?.quest.completed, north)).toBe('go');
    const ridgeSave = deserialize(JSON.stringify({
      version: 1,
      play: { ...once, mapId: 'ridge', x: 1, y: 1, pickups: ['balls-south', 'ridge:camp-balls'], ridgeQuest: { introduced: true, caught: true, trial: false, completed: false } },
    }));
    expect(ridgeSave?.mapId).toBe('ridge');
    expect(ridgeSave?.pickups).toContain('balls-south');
    expect(ridgeSave?.pickups).toContain('ridge:camp-balls');
    expect(isWalkable(ridge, Math.floor((ridgeSave?.x ?? 0) / 48), Math.floor((ridgeSave?.y ?? 0) / 48)) || ridgeSave?.x === createRidge().spawnTile.x * 48 + 24).toBe(true);
  });
});
