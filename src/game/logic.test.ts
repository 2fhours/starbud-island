import { describe, expect, it } from 'vitest';
import { playerMove, playerRun, prepareBattle, resolveCatch } from './battle';
import { effectiveness, getMove, getSpecies, SPECIES_LIST } from './data';
import {
  catchProbability,
  damageOf,
  emptyDex,
  grantExp,
  healTeam,
  judgeTiming,
  makeMon,
  maxHp,
  performMove,
  questObjectives,
  receiveMon,
  setLead,
  topUpBalls,
} from './logic';
import { clearSave, deserialize, readSave, writeSave } from './save';
import type { Mon, PlayState, SpeciesId } from './types';
import { createWorld, isWalkable, pathExists, tileCenter } from './world';

const fixed = () => 0.5;

describe('芽灵与属性', () => {
  it('至少 8 种生物，每种两个技能', () => {
    expect(SPECIES_LIST.length).toBeGreaterThanOrEqual(8);
    for (const species of SPECIES_LIST) {
      expect(species.moves).toHaveLength(2);
      expect(species.name.length).toBeGreaterThan(1);
      expect(getMove(species.moves[0]).power + getMove(species.moves[1]).power).toBeGreaterThan(0);
    }
  });

  it('五行相克相生有上限，不会叠成秒杀', () => {
    expect(effectiveness('yinshui', 'yanghuo')).toBe(2);
    expect(effectiveness('yinjin', 'yangjin')).toBe(1.5);
    expect(effectiveness('yangjin', 'yinjin')).toBe(1.5);
    expect(effectiveness('yanghuo', 'yinshui')).toBe(0.75);
    expect(effectiveness('yinshui', 'yangmu')).toBe(0.85);
    expect(effectiveness('chunyang', 'chunyin')).toBe(1.5);
    expect(effectiveness('chunyang', 'yinjin')).toBe(1);
    for (const attack of ['yinjin', 'yangmu', 'yinshui', 'yanghuo', 'yintu', 'chunyin', 'chunyang'] as const) {
      for (const defense of ['yinjin', 'yangmu', 'yinshui', 'yanghuo', 'yintu', 'chunyin', 'chunyang'] as const) {
        const value = effectiveness(attack, defense);
        expect(value).toBeGreaterThanOrEqual(0.75);
        expect(value).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('战斗数值', () => {
  it('克制伤害高于抵抗，防御强化会减伤', () => {
    const ivs = { con: 10, str: 10, int: 10, spi: 10, spd: 10 };
    const attacker = makeMon('luzhu', 8, 1, true, ivs);
    const move = getMove(getSpecies('luzhu').moves[0]);
    const superHit = damageOf(attacker, makeMon('yanwei', 8, 1, true, ivs), move, fixed);
    const resist = damageOf(attacker, makeMon('lujiao', 8, 1, true, ivs), move, fixed);
    expect(superHit.mult).toBe(2);
    expect(resist.mult).toBe(0.85);
    expect(superHit.damage).toBeGreaterThan(resist.damage);
    const bulky = makeMon('yanwei', 8, 1, true, ivs);
    bulky.stages.def = 2;
    expect(damageOf(attacker, bulky, move, fixed).damage).toBeLessThan(superHit.damage);
  });

  it('治疗不造成伤害，连打可以击败低等级对手', () => {
    const healer = makeMon('lujiao', 6, 0.4);
    const before = healer.hp;
    const logs = performMove(healer, makeMon('dianrong', 3), getMove('guanghe'), fixed);
    expect(logs.join('')).toContain('光合');
    expect(healer.hp).toBeGreaterThan(before);
    const even = { con: 8, str: 8, int: 8, spi: 8, spd: 8 };
    const player = [makeMon('lujiao', 8, 1, true, even)];
    const battle = prepareBattle(player, [makeMon('luzhu', 3, 1, false, even)], 'wild', '');
    let guard = 0;
    while (battle.phase === 'input' && guard < 40) {
      playerMove(battle, 0, fixed);
      guard += 1;
    }
    expect(battle.result).toBe('win');
    expect(player[0].level).toBeGreaterThanOrEqual(8);
  });

  it('训练师战不能逃走，捕捉成功会结束战斗并发放经验', () => {
    const player = [makeMon('yanke', 5)];
    const battle = prepareBattle(player, [makeMon('fengling', 4)], 'trainer', '青禾');
    expect(playerRun(battle).join('')).toContain('挡住');
    expect(battle.phase).toBe('input');
    const wild = prepareBattle(player, [makeMon('dianrong', 4, 0.3)], 'wild', '');
    const logs = resolveCatch(wild, true, fixed);
    expect(wild.result).toBe('catch');
    expect(logs.some((line) => line.includes('经验') || line.includes('级'))).toBe(true);
  });
});

describe('捕捉、成长与队伍', () => {
  it('血量越低、时机越好，成功率越高，且落在可读区间', () => {
    const fullMiss = catchProbability(150, 1, 'miss');
    const midGood = catchProbability(150, 0.5, 'good');
    const lowPerfect = catchProbability(150, 0.05, 'perfect');
    expect(lowPerfect).toBeGreaterThan(midGood);
    expect(midGood).toBeGreaterThan(fullMiss);
    for (const value of [fullMiss, midGood, lowPerfect]) {
      expect(value).toBeGreaterThanOrEqual(0.06);
      expect(value).toBeLessThanOrEqual(0.92);
    }
    expect(judgeTiming(1)).toBe('perfect');
    expect(judgeTiming(1.12)).toBe('good');
    expect(judgeTiming(1.7)).toBe('miss');
  });

  it('经验升级会提高体力上限，治疗和补球能避免卡死', () => {
    const mon = makeMon('yanwei', 4, 0.5);
    const beforeMax = maxHp(mon);
    const logs = grantExp(mon, 500);
    expect(mon.level).toBeGreaterThan(4);
    expect(maxHp(mon)).toBeGreaterThan(beforeMax);
    expect(logs.some((line) => line.includes('级'))).toBe(true);
    mon.hp = 1;
    healTeam([mon]);
    expect(mon.hp).toBe(maxHp(mon));
    expect(topUpBalls(2)).toBe(8);
    expect(topUpBalls(12)).toBe(12);
  });

  it('队伍满员后进入寄存，并可切换领队', () => {
    const team = (['lujiao', 'yanwei', 'luzhu', 'dianrong', 'yanke', 'fengling'] as SpeciesId[]).map((id, index) =>
      makeMon(id, 5 + index),
    );
    const box: Mon[] = [];
    expect(receiveMon(team, box, makeMon('taibei', 6))).toBe('box');
    expect(team).toHaveLength(6);
    expect(box).toHaveLength(1);
    setLead(team, 2);
    expect(team[0].speciesId).toBe('luzhu');
  });
});

describe('存档与地图', () => {
  it('存档往返后保留进度，损坏数据会被拒绝', () => {
    const world = createWorld();
    const start = tileCenter(world.spawnTile.x, world.spawnTile.y);
    const play: PlayState = {
      name: '小芽',
      x: start.x,
      y: start.y,
      dir: 'down',
      mapId: 'island',
      ridgeQuest: { introduced: false, caught: false, trial: false, completed: false },
      team: [makeMon('lujiao', 5)],
      box: [],
      dex: emptyDex(),
      balls: 9,
      items: { yanxinshi: 0, qingfengling: 0 },
      steps: 0,
      gather: {},
      quest: { introduced: true, caughtWild: true, bossDefeated: false, completed: false },
      pickups: ['balls-south'],
      trainers: { qinghe: true, lanchuan: false, shiling: false },
      playMs: 12000,
    };
    play.dex.lujiao = { seen: true, caught: true };
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
      removeItem: (key: string) => void memory.delete(key),
    };
    expect(writeSave(storage, play)).toBe(true);
    const loaded = readSave(storage);
    expect(loaded?.name).toBe('小芽');
    expect(loaded?.quest.caughtWild).toBe(true);
    expect(loaded?.team[0].speciesId).toBe('lujiao');
    expect(loaded?.balls).toBe(9);
    const legacy = JSON.stringify({
      version: 1,
      play: {
        name: '旧档',
        x: 100,
        y: 200,
        dir: 'down',
        team: [{ uid: 'old', speciesId: 'yanwei', level: 7, exp: 3, hp: 12, stages: { atk: 0, def: 0 } }],
        dex: { yanwei: { seen: true, caught: true } },
        balls: 4,
        quest: { introduced: true, caughtWild: false, bossDefeated: false, completed: false },
        trainers: {},
        playMs: 5000,
      },
    });
    const restored = deserialize(legacy);
    expect(restored?.name).toBe('旧档');
    expect(restored?.team[0].speciesId).toBe('yanwei');
    expect(restored?.team[0].level).toBe(7);
    expect(restored?.box).toEqual([]);
    expect(restored?.balls).toBe(4);
    memory.set('xingya-island-save-v1', '{');
    expect(readSave(storage)).toBeNull();
    clearSave(storage);
    expect(readSave(storage)).toBeNull();
  });

  it('小镇、治疗点、北林和每只野生芽灵互相走得通', () => {
    const world = createWorld();
    expect(isWalkable(world, world.spawnTile.x, world.spawnTile.y)).toBe(true);
    expect(isWalkable(world, world.door.x, world.door.y)).toBe(true);
    expect(isWalkable(world, world.bossTile.x, world.bossTile.y)).toBe(true);
    expect(pathExists(world, world.spawnTile.x, world.spawnTile.y, world.bossTile.x, world.bossTile.y)).toBe(true);
    expect(pathExists(world, world.spawnTile.x, world.spawnTile.y, world.door.x, world.door.y)).toBe(true);
    expect(world.spawns.length).toBeGreaterThanOrEqual(12);
    for (const spawn of world.spawns) {
      expect(isWalkable(world, spawn.x, spawn.y), spawn.id).toBe(true);
      expect(pathExists(world, world.spawnTile.x, world.spawnTile.y, spawn.x, spawn.y), spawn.id).toBe(true);
    }
    const objectives = questObjectives({ introduced: true, caughtWild: false, bossDefeated: false, completed: false });
    expect(objectives.filter((item) => item.done)).toHaveLength(1);
  });
});
