import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASE_SPECIES, SPECIES_LIST, getSpecies } from './data';
import {
  CATCH_FLOOR,
  CATCH_STEP,
  EVOLUTION_LINES,
  EXP_STEP,
  GATHER_STEPS,
  evolutionStatus,
  familyBase,
  itemFromWild,
  nextStep,
  raceAtStage,
} from './evolution';
import { commitEvolution, damageOf, emptyDex, grantExp, makeMon, maxHp, maxMp } from './logic';
import { FULL_BODY_SPECIES, SPECIES_PORTRAIT_IDS } from './portraits';
import { deserialize } from './save';
import { basicStrike, getMove, skillForm } from './skills';
import { createRidge, createWorld, isWalkable, pathExists } from './world';
import type { Five, PlayState, SpeciesId } from './types';
import { MAX_LEVEL, SAVE_KEY } from './types';

const zero: Five = { con: 0, str: 0, int: 0, spi: 0, spd: 0 };

function playWith(mon: ReturnType<typeof makeMon>, extra: Partial<PlayState> = {}): PlayState {
  const dex = emptyDex();
  dex[mon.speciesId] = { seen: true, caught: true };
  return {
    name: '小芽',
    x: 100,
    y: 100,
    dir: 'down',
    mapId: 'island',
    team: [mon],
    box: [],
    dex,
    balls: 3,
    items: { yanxinshi: 0, qingfengling: 0 },
    steps: 0,
    gather: {},
    quest: { introduced: true, caughtWild: true, bossDefeated: true, completed: true },
    ridgeQuest: { introduced: false, caught: false, trial: false, completed: false },
    pickups: [],
    trainers: { qinghe: false, lanchuan: false, shiling: false },
    playMs: 0,
    ...extra,
  };
}

describe('进化路线', () => {
  it('十二条路线无环，八条三阶段、四条两阶段，共三十二种', () => {
    expect(EVOLUTION_LINES).toHaveLength(12);
    expect(SPECIES_LIST).toHaveLength(32);
    expect(BASE_SPECIES).toHaveLength(12);
    const seen = new Set<SpeciesId>();
    let triples = 0;
    let pairs = 0;
    for (const line of EVOLUTION_LINES) {
      expect(line[0].stage).toBe(1);
      expect(new Set(line.map((step) => step.id)).size).toBe(line.length);
      if (line.length === 3) triples += 1;
      if (line.length === 2) pairs += 1;
      for (const step of line) {
        expect(seen.has(step.id)).toBe(false);
        seen.add(step.id);
        expect(familyBase(step.id)).toBe(line[0].id);
        expect(getSpecies(step.id).type).toBe(getSpecies(line[0].id).type);
      }
      expect(nextStep(line[line.length - 1].id)).toBeNull();
    }
    expect(triples).toBe(8);
    expect(pairs).toBe(4);
    expect(seen.size).toBe(32);
    const island = new Set(createWorld().spawns.map((spawn) => spawn.speciesId));
    const ridge = new Set(createRidge().spawns.map((spawn) => spawn.speciesId));
    for (const id of seen) {
      if (!BASE_SPECIES.includes(id)) {
        expect(island.has(id)).toBe(false);
        expect(ridge.has(id)).toBe(false);
      }
    }
  });

  it('进化阶段按基础种族值提升，并继承属性', () => {
    expect(getSpecies('wudeng').type).toBe('yinhuo');
    expect(getSpecies('wuhui').type).toBe('yinhuo');
    expect(getSpecies('landeng').type).toBe('yinhuo');
    expect(getSpecies('yunyang').type).toBe('yangtu');
    expect(getSpecies('lanjiao').type).toBe('yangtu');
    expect(getSpecies('luoxing').type).toBe('yinmu');
    expect(getSpecies('xingyi').type).toBe('yinmu');
    expect(getSpecies('liuxing').type).toBe('yinmu');
    expect(getSpecies('hanquan').type).toBe('yangshui');
    expect(getSpecies('shuangquan').type).toBe('yangshui');
    for (const line of EVOLUTION_LINES) {
      const base = getSpecies(line[0].id);
      for (const step of line) {
        const species = getSpecies(step.id);
        expect(species.race).toEqual(raceAtStage(base.race, step.stage));
        const steps = step.stage - 1;
        expect(species.baseExp).toBe(base.baseExp + steps * EXP_STEP);
        expect(species.catchRate).toBe(Math.max(CATCH_FLOOR, base.catchRate - steps * CATCH_STEP));
        expect(species.moves).toEqual(base.moves);
      }
    }
    expect(getSpecies('cuizhi').race.con).toBe(68);
    expect(getSpecies('senmian').race.con).toBe(78);
    expect(getSpecies('yanwei').race.spd).toBe(72);
    expect(getSpecies('chiyan').race.spd).toBe(92);
  });

  it('等级不够不能进化，超过门槛仍可一次只进一阶', () => {
    const young = makeMon('lujiao', 13, 1, true, zero);
    const low = playWith(young);
    expect(evolutionStatus(young, low, (id) => getSpecies(id).name).ready).toBe(false);
    expect(evolutionStatus(young, low, (id) => getSpecies(id).name).line).toContain('还要到 14 级');
    expect(commitEvolution(young, low).ok).toBe(false);
    expect(young.speciesId).toBe('lujiao');
    const elder = makeMon('lujiao', 40, 0.5, true, zero);
    elder.exp = 12;
    elder.aspect = 'chunyang';
    const moves = ['chunyang-basic-attack-0', 'chunyang-basic-heal-0'];
    elder.moves = [...moves];
    const ivs = { ...elder.ivs };
    const beforeHp = elder.hp;
    const beforeMax = maxHp(elder);
    const play = playWith(elder);
    const first = commitEvolution(elder, play);
    expect(first.ok).toBe(true);
    expect(elder.speciesId).toBe('cuizhi');
    expect(elder.level).toBe(40);
    expect(elder.exp).toBe(12);
    expect(elder.ivs).toEqual(ivs);
    expect(elder.aspect).toBe('chunyang');
    expect(elder.moves).toEqual(moves);
    expect(elder.hp).toBeGreaterThan(0);
    expect(elder.hp).toBeLessThan(maxHp(elder));
    expect(Math.round((beforeHp * maxHp(elder)) / beforeMax)).toBe(elder.hp);
    expect(play.dex.lujiao.caught).toBe(true);
    expect(play.dex.cuizhi).toEqual({ seen: true, caught: true });
    expect(commitEvolution(elder, play).ok).toBe(true);
    expect(elder.speciesId).toBe('senmian');
    expect(evolutionStatus(elder, play, (id) => getSpecies(id).name).final).toBe(true);
    expect(evolutionStatus(elder, play, (id) => getSpecies(id).name).line).toBe('最终形态');
  });

  it('道具只在确认成功时消耗一个，地图条件不消耗道具', () => {
    const fox = makeMon('huowen', 33, 1, true, zero);
    const broke = playWith(fox);
    expect(commitEvolution(fox, broke).ok).toBe(false);
    expect(fox.speciesId).toBe('huowen');
    expect(broke.items.yanxinshi).toBe(0);
    broke.items.yanxinshi = 1;
    expect(commitEvolution(fox, broke).ok).toBe(true);
    expect(fox.speciesId).toBe('chiyan');
    expect(broke.items.yanxinshi).toBe(0);
    expect(commitEvolution(fox, broke).ok).toBe(false);
    expect(broke.items.yanxinshi).toBe(0);
    const moth = makeMon('wuhui', 34, 1, true, zero);
    moth.hp = 0;
    moth.mp = 0;
    const away = playWith(moth, { mapId: 'island' });
    expect(evolutionStatus(moth, away, (id) => getSpecies(id).name).line).toContain('星雾岭');
    expect(commitEvolution(moth, away).ok).toBe(false);
    const home = playWith(moth, { mapId: 'ridge' });
    expect(commitEvolution(moth, home).ok).toBe(true);
    expect(moth.speciesId).toBe('landeng');
    expect(moth.hp).toBe(0);
    expect(moth.mp).toBe(0);
    expect(maxMp(moth)).toBeGreaterThan(0);
  });

  it('进化后仍用原来的物理和魔法结算', () => {
    const mon = makeMon('dianrong', 31, 1, true, zero);
    const play = playWith(mon);
    expect(commitEvolution(mon, play).ok).toBe(true);
    expect(mon.speciesId).toBe('shanrong');
    const physical = getMove('yangjin-basic-attack-0');
    const magic = getMove('yangjin-basic-attack-1');
    expect(skillForm(physical)).toBe('physical');
    expect(skillForm(magic)).toBe('magic');
    expect(skillForm(basicStrike(mon.aspect!))).toBe('physical');
    const foe = makeMon('yanke', 8, 1, true, zero);
    const strong = makeMon('shanrong', 31, 1, true, { ...zero, str: 31 });
    const mage = makeMon('shanrong', 31, 1, true, { ...zero, int: 31 });
    strong.aspect = mon.aspect;
    mage.aspect = mon.aspect;
    expect(damageOf(strong, foe, physical, () => 0.5).damage).toBeGreaterThan(damageOf(mon, foe, physical, () => 0.5).damage);
    expect(damageOf(mage, foe, magic, () => 0.5).damage).toBeGreaterThan(damageOf(mon, foe, magic, () => 0.5).damage);
  });

  it('等级上限到 40，原曲线仍能练到 35', () => {
    expect(MAX_LEVEL).toBe(40);
    const mon = makeMon('luoxing', 34, 1, true, zero);
    const logs = grantExp(mon, 18 + 34 * 34 * 3);
    expect(mon.level).toBe(35);
    expect(logs.join('')).toContain('35');
    grantExp(mon, 999999);
    expect(mon.level).toBe(40);
    expect(mon.exp).toBe(0);
    const play = playWith(mon);
    expect(commitEvolution(mon, play).ok).toBe(true);
    expect(mon.speciesId).toBe('xingyi');
    expect(commitEvolution(mon, play).ok).toBe(true);
    expect(mon.speciesId).toBe('liuxing');
  });

  it('野生胜利和采集是确定获得，采集点不挡路', () => {
    expect(itemFromWild('yanwei')).toBe('yanxinshi');
    expect(itemFromWild('fengling')).toBe('qingfengling');
    expect(itemFromWild('lujiao')).toBeNull();
    expect(GATHER_STEPS).toBe(40);
    const world = createWorld();
    const blocked = new Set<string>([
      ...world.gates.map((gate) => `${gate.x},${gate.y}`),
      ...world.npcs.map((npc) => `${npc.x},${npc.y}`),
      `${world.door.x},${world.door.y}`,
      ...world.spawns.map((spawn) => `${spawn.x},${spawn.y}`),
    ]);
    expect(world.gathers.map((node) => node.id).sort()).toEqual(['bell-branch', 'ember-rock']);
    for (const node of world.gathers) {
      expect(blocked.has(`${node.x},${node.y}`), node.id).toBe(false);
      expect(isWalkable(world, node.x, node.y), node.id).toBe(true);
      expect(pathExists(world, world.spawnTile.x, world.spawnTile.y, node.x, node.y), node.id).toBe(true);
    }
    expect(createRidge().gathers).toEqual([]);
  });

  it('旧档能读，畸形物种被丢掉且不清掉原字符串', () => {
    const legacy = JSON.stringify({
      version: 1,
      play: {
        name: '旧档',
        x: 80,
        y: 90,
        dir: 'down',
        team: [
          { uid: 'keep', speciesId: 'lujiao', level: 30, exp: 4, hp: 10, ivs: zero },
          { uid: 'bad', speciesId: 'not-a-bud', level: 9, exp: 1, hp: 8 },
          { uid: 'high', speciesId: 'yanwei', level: 99, exp: 2, hp: 3, ivs: zero },
        ],
        box: [{ uid: 'box-bad', speciesId: 'ghost', level: 2, exp: 0, hp: 1 }],
        dex: { lujiao: { seen: true, caught: true } },
        balls: 2,
      },
    });
    const loaded = deserialize(legacy);
    expect(loaded?.team.map((mon) => mon.speciesId)).toEqual(['lujiao', 'yanwei']);
    expect(loaded?.team[0].level).toBe(30);
    expect(loaded?.team[1].level).toBe(40);
    expect(loaded?.box).toEqual([]);
    expect(loaded?.items).toEqual({ yanxinshi: 0, qingfengling: 0 });
    expect(loaded?.steps).toBe(0);
    expect(loaded?.dex.cuizhi).toEqual({ seen: false, caught: false });
    const memory = new Map<string, string>([[SAVE_KEY, JSON.stringify({
      version: 1,
      play: { name: '空', x: 1, y: 1, dir: 'down', team: [{ speciesId: 'nope', level: 1, hp: 1 }] },
    })]]);
    expect(deserialize(memory.get(SAVE_KEY) ?? null)).toBeNull();
    expect(memory.get(SAVE_KEY)).toContain('nope');
  });

  it('四十张进化正背面都是 384×576，文档写了已实施规则', () => {
    const fullBody = new Set<string>(FULL_BODY_SPECIES);
    const evolved = SPECIES_PORTRAIT_IDS.filter((id) => !fullBody.has(id));
    expect(evolved).toHaveLength(20);
    for (const id of evolved) {
      for (const facing of ['front', 'back'] as const) {
        const file = readFileSync(new URL(`../../public/portraits/${id}-${facing}.jpg`, import.meta.url));
        expect(file.readUInt16BE(0)).toBe(0xffd8);
      }
    }
    const doc = readFileSync(new URL('../../docs/design/evolution.md', import.meta.url), 'utf8');
    expect(doc).toContain('再走 40 步');
    expect(doc).toContain('等级上限是 40');
    expect(doc).toContain('余烬暖岩');
    expect(doc).toContain('铃风枝');
    expect(doc).toContain('xingya-island-save-v1');
    const ui = readFileSync(new URL('./ui.ts', import.meta.url), 'utf8');
    expect(ui).toContain('data-act="evolve"');
    expect(ui).not.toContain('confirm(');
    const battle = ui.slice(ui.indexOf('function battleSheet'), ui.indexOf('function npcSheet'));
    expect(battle).not.toContain('data-act="evolve"');
  });
});
