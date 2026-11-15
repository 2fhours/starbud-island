import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { playerMove, prepareBattle } from './battle';
import { getSpecies, SPECIES_LIST } from './data';
import { actionOrder, cloneMon, grantExp, makeMon, maxHp, maxMp, profile, resolveSkill, blankFighter } from './logic';
import { deserialize } from './save';
import { basicStrike, getMove } from './skills';
import { derive, evasionChance, hitChance } from './stats';
import type { Five } from './types';

const zero: Five = { con: 0, str: 0, int: 0, spi: 0, spd: 0 };
const race: Five = { con: 50, str: 50, int: 50, spi: 50, spd: 50 };

function bumped(key: keyof Five, amount = 20): Five {
  return { ...zero, [key]: amount };
}

describe('五维因果关系', () => {
  it('每一项只提高用户指定的推导值', () => {
    const base = derive(race, zero, 10);
    const con = derive(race, bumped('con'), 10);
    const str = derive(race, bumped('str'), 10);
    const intel = derive(race, bumped('int'), 10);
    const spi = derive(race, bumped('spi'), 10);
    const spd = derive(race, bumped('spd'), 10);
    expect(con.maxHp).toBeGreaterThan(base.maxHp);
    expect(con.physDef).toBeGreaterThan(base.physDef);
    expect(con.physAtk).toBe(base.physAtk);
    expect(con.maxMp).toBe(base.maxMp);
    expect(str.physAtk).toBeGreaterThan(base.physAtk);
    expect(str.physDef).toBeGreaterThan(base.physDef);
    expect(str.magAtk).toBe(base.magAtk);
    expect(intel.magAtk).toBeGreaterThan(base.magAtk);
    expect(intel.magDef).toBeGreaterThan(base.magDef);
    expect(intel.physAtk).toBe(base.physAtk);
    expect(spi.maxMp).toBeGreaterThan(base.maxMp);
    expect(spi.magDef).toBeGreaterThan(base.magDef);
    expect(spi.hit).toBeGreaterThan(base.hit);
    expect(spi.evasion).toBe(base.evasion);
    expect(spd.action).toBeGreaterThan(base.action);
    expect(spd.evasion).toBeGreaterThan(base.evasion);
    expect(spd.hit).toBeGreaterThan(base.hit);
    expect(spd.maxHp).toBe(base.maxHp);
  });

  it('等级提高可见五维，个体在升级后不变', () => {
    const low = derive(race, zero, 5);
    const high = derive(race, zero, 12);
    expect(high.core.con).toBeGreaterThan(low.core.con);
    expect(high.maxHp).toBeGreaterThan(low.maxHp);
    const mon = makeMon('lujiao', 5, 0.4, true, zero);
    mon.mp = 3;
    const beforeHp = mon.hp;
    grantExp(mon, 200);
    expect(mon.level).toBeGreaterThan(5);
    expect(mon.ivs).toEqual(zero);
    expect(mon.hp).toBeGreaterThan(beforeHp);
    expect(mon.hp).toBeLessThan(maxHp(mon));
    expect(mon.mp).toBeGreaterThan(3);
    expect(mon.mp).toBeLessThan(maxMp(mon));
  });

  it('同种同级的个体差异稳定，不会在重复计算时重掷', () => {
    const left = makeMon('yanwei', 9, 1, true, bumped('spd', 31));
    const right = makeMon('yanwei', 9, 1, true, zero);
    expect(profile(left).core.spd).toBeGreaterThan(profile(right).core.spd);
    expect(profile(left)).toEqual(profile(left));
    const copy = cloneMon(left);
    expect(copy.ivs).toEqual(left.ivs);
    expect(copy.uid).not.toBe(left.uid);
  });
});

describe('战斗里的物魔、法力和命中', () => {
  it('力量只提高物理伤害，智力只提高魔法伤害', () => {
    const foe = makeMon('yanwei', 8, 1, true, zero);
    const plain = makeMon('luzhu', 8, 1, true, zero);
    const strong = makeMon('luzhu', 8, 1, true, bumped('str', 31));
    const mage = makeMon('luzhu', 8, 1, true, bumped('int', 31));
    const physical = getMove('yinshui-basic-attack-0');
    const magic = getMove('yinshui-basic-attack-1');
    expect(physical.kind).toBe('physical');
    expect(physical.cost).toBe(0);
    expect(magic.kind).toBe('magic');
    expect(magic.cost).toBeGreaterThan(0);
    const roll = () => 0.5;
    expect(resolveDamage(strong, foe, physical, roll)).toBeGreaterThan(resolveDamage(plain, foe, physical, roll));
    expect(resolveDamage(strong, foe, magic, roll)).toBe(resolveDamage(plain, foe, magic, roll));
    expect(resolveDamage(mage, foe, magic, roll)).toBeGreaterThan(resolveDamage(plain, foe, magic, roll));
    expect(resolveDamage(mage, foe, physical, roll)).toBe(resolveDamage(plain, foe, physical, roll));
  });

  it('法力不足时不能放技能，普通攻击仍然能打', () => {
    const user = makeMon('lujiao', 8, 1, true, zero);
    const foe = makeMon('yanwei', 8, 1, true, zero);
    user.mp = 0;
    const guard = resolveSkill(blankFighter(user), blankFighter(foe), getMove('yangmu-basic-guard-0'), () => 0.5);
    expect(guard.join('')).toContain('法力不足');
    expect(user.mp).toBe(0);
    const before = foe.hp;
    const basic = resolveSkill(blankFighter(user), blankFighter(foe), basicStrike(user.aspect!), () => 0.5);
    expect(basic.join('')).toContain('普通攻击');
    expect(foe.hp).toBeLessThan(before);
    expect(user.mp).toBe(0);
  });

  it('未命中和闪避会写进战报，并且不掉血', () => {
    const user = makeMon('luzhu', 8, 1, true, zero);
    const foe = makeMon('yanwei', 8, 1, true, zero);
    const move = getMove('yinshui-basic-attack-1');
    const missed = resolveSkill(blankFighter(user), blankFighter(foe), move, () => 0.99);
    expect(missed.join('')).toContain('没有命中');
    expect(foe.hp).toBe(maxHp(foe));
    let call = 0;
    const evaded = resolveSkill(blankFighter(user), blankFighter(foe), move, () => (call++ === 0 ? 0.2 : 0));
    expect(evaded.join('')).toContain('闪避了攻击');
    expect(foe.hp).toBe(maxHp(foe));
    expect(hitChance(1, 1)).toBeGreaterThanOrEqual(0.78);
    expect(hitChance(999, 999)).toBeLessThanOrEqual(0.96);
    expect(evasionChance(1)).toBeGreaterThanOrEqual(0.03);
    expect(evasionChance(999)).toBeLessThanOrEqual(0.16);
  });

  it('出手高的一方先动，没有法力时敌方改用普通攻击', () => {
    const slow = makeMon('yanke', 24, 1, true, zero);
    const fast = makeMon('dianrong', 24, 1, true, zero);
    expect(actionOrder(fast)).toBeGreaterThan(actionOrder(slow));
    fast.mp = 0;
    fast.moves = ['yangjin-divine-attack-0'];
    const battle = prepareBattle([slow], [fast], 'wild', '');
    expect(playerMove(battle, 0, () => 0.5)[0]).toContain('普通攻击');
  });
});

describe('旧存档迁移', () => {
  it('同一份旧档迁移两次结果相同，保存后再读不会重算血量', () => {
    const legacy = JSON.stringify({
      version: 1,
      play: {
        name: '旧档',
        x: 80,
        y: 90,
        dir: 'down',
        team: [{ uid: 'old-fox', speciesId: 'yanwei', level: 7, exp: 3, hp: 12 }],
        dex: { yanwei: { seen: true, caught: true } },
        balls: 4,
        quest: { introduced: true, caughtWild: false, bossDefeated: false, completed: false },
        trainers: {},
        playMs: 10,
      },
    });
    const once = deserialize(legacy);
    const twice = deserialize(legacy);
    expect(once?.team[0].ivs).toEqual(twice?.team[0].ivs);
    expect(once?.team[0].hp).toBe(twice?.team[0].hp);
    expect(once?.team[0].mp).toBe(maxMp(once!.team[0]));
    expect(once!.team[0].hp).toBeGreaterThan(0);
    expect(once!.team[0].hp).toBeLessThanOrEqual(maxHp(once!.team[0]));
    once!.team[0].hp = 4;
    once!.team[0].mp = 2;
    const saved = deserialize(JSON.stringify({ version: 1, play: once }));
    expect(saved?.team[0].hp).toBe(4);
    expect(saved?.team[0].mp).toBe(2);
    expect(saved?.team[0].ivs).toEqual(once?.team[0].ivs);
  });
});

describe('物种分布和界面', () => {
  it('八种种族值有差别，并且落在同一档', () => {
    const totals = SPECIES_LIST.map((species) => Object.values(species.race).reduce((sum, value) => sum + value, 0));
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(20);
    const peaks = new Set(SPECIES_LIST.map((species) => Object.entries(species.race).sort((a, b) => b[1] - a[1])[0][0]));
    expect(peaks.size).toBeGreaterThan(2);
    expect(getSpecies('yanke').race.con).toBeGreaterThan(getSpecies('dianrong').race.con);
    expect(getSpecies('dianrong').race.spd).toBeGreaterThan(getSpecies('yanke').race.spd);
  });

  it('队伍界面说明五维，不写出种族值或个体值', () => {
    const ui = readFileSync(new URL('./ui.ts', import.meta.url), 'utf8');
    const skills = readFileSync(new URL('./skills.ts', import.meta.url), 'utf8');
    expect(ui).toContain('体质');
    expect(ui).toContain('basic.name');
    expect(skills).toContain('普通攻击');
    expect(ui).not.toContain('种族值');
    expect(ui).not.toContain('个体值');
  });
});

function resolveDamage(attacker: ReturnType<typeof makeMon>, defender: ReturnType<typeof makeMon>, move: ReturnType<typeof getMove>, rng: () => number): number {
  const foe = cloneMon(defender);
  foe.hp = maxHp(foe);
  const before = foe.hp;
  resolveSkill(blankFighter(attacker), blankFighter(foe), move, rng);
  return before - foe.hp;
}
