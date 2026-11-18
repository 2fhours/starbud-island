import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { playerMove, playerSwitch, prepareBattle } from './battle';
import { getSpecies } from './data';
import { effectiveness } from './elements';
import {
  catchProbability,
  actionOrder,
  critChance,
  critMultiplier,
  damageOf,
  settleDamage,
  expGain,
  ensureLoadout,
  expToNext,
  fleeChance,
  grantExp,
  judgeTiming,
  makeMon,
  maxHp,
  profile,
  readDelay,
  resolveSkill,
  blankFighter,
} from './logic';
import { deserialize, serialize } from './save';
import { getMove, skillStats, SKILL_LIST, basicStrike } from './skills';
import { derive } from './stats';
import type { PlayState } from './types';

function rolls(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

const formulas = readFileSync(new URL('../../docs/design/formulas.md', import.meta.url), 'utf8');
const setting = readFileSync(new URL('../../docs/design/setting.md', import.meta.url), 'utf8');
const saves = readFileSync(new URL('../../docs/design/saves.md', import.meta.url), 'utf8');
const index = readFileSync(new URL('../../docs/design/README.md', import.meta.url), 'utf8');

describe('设定文档和公式一致', () => {
  it('索引能找到三份文档', () => {
    expect(index).toContain('evolution.md');
    expect(index).toContain('setting.md');
    expect(index).toContain('formulas.md');
    expect(index).toContain('saves.md');
    expect(setting).toContain('未实施');
    expect(setting).toContain('个体值');
    expect(setting).toContain('法力');
    expect(saves).toContain('xingya-island-save-v1');
    expect(saves).toContain('1.4.1');
  });

  it('等级、经验和属性样例与代码相同', () => {
    const zero = { con: 0, str: 0, int: 0, spi: 0, spd: 0 };
    const deer = makeMon('lujiao', 5, 1, true, zero);
    expect(maxHp(deer)).toBe(76);
    expect(expToNext(5)).toBe(93);
    expect(expGain(5, 62, false)).toBe(44);
    expect(expGain(5, 62, true)).toBe(64);
    const deerStats = derive(getSpecies('lujiao').race, zero, 5);
    expect(deerStats.core).toEqual({ con: 37, str: 35, int: 36, spi: 36, spd: 33 });
    expect(deerStats.physAtk).toBe(31);
    expect(deerStats.physDef).toBe(32);
    expect(deerStats.magAtk).toBe(31);
    expect(deerStats.magDef).toBe(30);
    expect(deerStats.action).toBe(27);
    expect(profile(deer).physAtk).toBe(31);
    expect(formulas).toContain('样例体质 37');
    expect(formulas).toContain('样例生命 76');
    expect(formulas).toContain('样例物攻 31');
    expect(formulas).toContain('样例物防 32');
    expect(formulas).toContain('样例魔攻 31');
    expect(formulas).toContain('样例魔防 30');
    expect(formulas).toContain('样例经验 93、44、64');
    const stayed = makeMon('lujiao', 5, 1, true);
    grantExp(stayed, 40);
    expect(stayed.level).toBe(5);
    expect(stayed.exp).toBe(40);
    expect(formulas).toContain('样例经验结余 40');
    expect(effectiveness('yinshui', 'yanghuo')).toBe(2);
    expect(effectiveness('yinjin', 'yangjin')).toBe(1.5);
    expect(effectiveness('yanghuo', 'yinshui')).toBe(0.75);
    expect(effectiveness('yangjin', 'yangjin')).toBe(0.9);
    expect(formulas).toContain('样例倍率 2、1.5、0.75、0.9');
  });

  it('伤害、治疗和护盾样例与代码相同', () => {
    const zero = { con: 0, str: 0, int: 0, spi: 0, spd: 0 };
    const attacker = makeMon('luzhu', 8, 1, true, zero);
    const move = getMove('yinshui-basic-attack-0');
    const fox = makeMon('yanwei', 8, 1, true, zero);
    const superHit = damageOf(attacker, fox, move, () => 0.5);
    expect(superHit.crit).toBe(false);
    expect(superHit.attackBonus).toBeGreaterThan(superHit.defenseCut);
    expect(superHit.damage).toBe(23);
    expect(damageOf(attacker, fox, move, rolls(0.5, 0)).damage).toBe(18);
    expect(damageOf(attacker, fox, move, () => 1).damage).toBe(27);
    const plainAttacker = makeMon('yanwei', 8, 1, true, zero);
    plainAttacker.aspect = 'chunyang';
    const mouse = makeMon('dianrong', 8, 1, true, zero);
    expect(profile(plainAttacker).physAtk).toBe(46);
    expect(profile(mouse).physDef).toBe(30);
    const plainMove = getMove('chunyang-basic-attack-0');
    const plain = damageOf(plainAttacker, mouse, plainMove, () => 0.5);
    expect(plain.mult).toBe(1);
    expect(plain.crit).toBe(false);
    expect(plain.damage).toBe(12);
    const yin = makeMon('fengling', 8, 1, true, zero);
    yin.aspect = 'yinjin';
    const yang = makeMon('dianrong', 8, 1, true, zero);
    yang.aspect = 'yangjin';
    const clash = damageOf(yin, yang, getMove('yinjin-basic-attack-0'), () => 0.5);
    expect(clash.mult).toBe(1.5);
    expect(clash.damage).toBe(19);
    expect(settleDamage((46 * 31 / 60) * 1.2 * 2 * 1.5, 34)).toMatchObject({ damage: 51, stopped: false, crit: false, critMult: 1 });
    expect(damageOf(plainAttacker, mouse, plainMove, () => 0.5, { bonusFlat: 4 }).damage).toBe(16);
    expect(damageOf(plainAttacker, mouse, plainMove, () => 0.5, { bonusPercent: 0.1 }).damage).toBe(16);
    expect(damageOf(plainAttacker, mouse, plainMove, () => 0.5, {
      bonusFlat: 4,
      bonusPercent: 0.1,
      cutFlat: 4,
      cutPercent: 0.1,
    }).damage).toBe(11);
    const critHit = damageOf(plainAttacker, mouse, plainMove, rolls(0, 0.5));
    expect(critHit.crit).toBe(true);
    expect(critHit.critMult).toBe(1.5);
    expect(critHit.damage).toBe(33);
    const capped = damageOf(plainAttacker, mouse, plainMove, rolls(0, 0.5), { critDamage: 0.5 });
    expect(capped.critMult).toBe(2);
    expect(capped.damage).toBe(54);
    expect(critChance(1)).toBe(0.5);
    expect(critMultiplier(true, 9)).toBe(2);
    expect(critMultiplier(false, 9)).toBe(1);
    expect(settleDamage(28, 30)).toMatchObject({ damage: 1, stopped: true, crit: false });
    expect(settleDamage(28, 30, { crit: true })).toMatchObject({ damage: 12, stopped: false, critMult: 1.5 });
    const finisher = getMove('chunyang-divine-attack-0');
    expect(finisher.critDamage).toBe(0.5);
    expect(finisher.bonusFlat).toBe(6);
    const finisherHit = damageOf(plainAttacker, mouse, finisher, rolls(0, 0.5));
    expect(finisherHit.critMult).toBe(2);
    expect(finisherHit.damage).toBe(154);
    expect(damageOf(plainAttacker, mouse, finisher, () => 0.5).damage).toBe(62);
    const aided = blankFighter(makeMon('lujiao', 8, 1, true, zero));
    const focus = getMove('yangmu-basic-aid-0');
    resolveSkill(aided, blankFighter(makeMon('dianrong', 8, 1, true, zero)), focus, () => 0.5);
    expect(aided.bonusFlat).toBe(4);
    expect(aided.bonusPercent).toBe(0.08);
    expect(aided.critRate).toBe(0.16);
    expect(focus.desc).toContain('提高暴击');
    expect(focus.desc).not.toMatch(/0\.16|16%/);
    resolveSkill(aided, blankFighter(makeMon('dianrong', 8, 1, true, zero)), focus, () => 0.5);
    expect(aided.critRate).toBe(0.32);
    expect(getMove('yangmu-basic-aid-1').critRate).toBe(0);
    expect(getMove('yangmu-basic-aid-1').desc).not.toContain('暴击');
    expect(getMove('yangmu-mid-attack-0').bonusFlat).toBe(6);
    expect(getMove('yangmu-mid-attack-0').critDamage).toBe(0);
    expect(getMove('yanghuo-high-attack-0').critRate).toBe(0.12);
    expect(getMove('yanghuo-high-attack-0').bonusPercent).toBe(0.1);
    expect(getMove('yanghuo-high-attack-0').desc).toContain('容易暴击');
    expect(getMove('chunyang-basic-attack-0').critRate).toBe(0);
    expect(basicStrike('chunyang').desc).not.toContain('暴击');
    expect(finisher.desc).toContain('暴击时伤害更高');
    expect(finisher.desc).not.toMatch(/1\.5|2\.0|0\.5/);
    const critLines = SKILL_LIST.filter((move) => move.desc.includes('暴击'));
    expect(critLines).toHaveLength(36);
    for (const move of critLines) {
      expect(move.desc.includes('容易暴击') || move.desc.includes('提高暴击') || move.desc.includes('暴击时伤害更高')).toBe(true);
      expect(move.desc).not.toMatch(/暴击率|暴击伤害|倍率/);
    }
    expect(getMove('yangmu-basic-guard-1').cutPercent).toBe(0.1);
    const feed = damageOf(attacker, makeMon('lujiao', 8, 1, true, zero), move, () => 0.5);
    expect(feed.damage).toBe(1);
    expect(feed.stopped).toBe(true);
    const tank = makeMon('yanke', 8, 1, true, zero);
    tank.stages.def = 3;
    const blocked = damageOf(attacker, tank, move, () => 0.5);
    expect(blocked.damage).toBe(1);
    expect(blocked.stopped).toBe(true);
    const blockedLog = resolveSkill(blankFighter(attacker), blankFighter(tank), move, () => 0.5);
    expect(blockedLog.join('')).toContain('没能破开防御');
    expect(formulas).toContain('样例普通 12');
    expect(formulas).toContain('样例固定 16');
    expect(formulas).toContain('样例百分比 16');
    expect(formulas).toContain('样例两边 11');
    expect(formulas).toContain('样例暴击 33');
    expect(formulas).toContain('样例暴击上限 54');
    expect(formulas).toContain('样例暴击破防 12');
    expect(formulas).toContain('样例伤害 23');
    expect(formulas).toContain('样例伤害低 18');
    expect(formulas).toContain('样例伤害高 27');
    expect(formulas).toContain('样例阴阳 19');
    expect(formulas).toContain('样例同时 51');
    expect(formulas).toContain('样例未破防 1');
    expect(formulas).toContain('样例相生伤害 1');
    expect(formulas).toContain('样例暖空暴击 154');
    const strong = makeMon('luzhu', 8, 1, true, { ...zero, str: 31 });
    const mage = makeMon('luzhu', 8, 1, true, { ...zero, int: 31 });
    const magic = getMove('yinshui-basic-attack-1');
    expect(magic.name).toBe('夜潮');
    expect(damageOf(attacker, fox, move, () => 0.5).damage).toBe(23);
    expect(damageOf(strong, fox, move, () => 0.5).damage).toBe(65);
    expect(damageOf(attacker, fox, magic, () => 0.5).damage).toBe(76);
    expect(damageOf(mage, fox, magic, () => 0.5).damage).toBe(121);
    expect(damageOf(mage, fox, move, () => 0.5).damage).toBe(23);
    expect(formulas).toContain('样例物理 65');
    expect(formulas).toContain('样例魔法 121');

    const hurt = makeMon('lujiao', 5, 0.4, true, zero);
    expect(hurt.hp).toBe(30);
    resolveSkill(blankFighter(hurt), blankFighter(makeMon('dianrong', 5, 1, true, zero)), getMove('yangmu-basic-heal-0'), () => 0.5);
    expect(hurt.hp).toBe(40);
    expect(formulas).toContain('样例回复 10');

    const full = makeMon('lujiao', 5, 1, true, zero);
    const shielded = blankFighter(full);
    const guard = getMove('yangmu-basic-guard-0');
    for (let i = 0; i < 6; i += 1) resolveSkill(shielded, blankFighter(makeMon('dianrong', 5, 1, true, zero)), guard, () => 0.5);
    expect(shielded.shield).toBe(26);
    expect(formulas).toContain('样例护盾 26');

    const elder = makeMon('lujiao', 24, 0.2, true, zero);
    expect(maxHp(elder)).toBe(183);
    expect(elder.hp).toBe(37);
    resolveSkill(blankFighter(elder), blankFighter(makeMon('dianrong', 5, 1, true, zero)), getMove('yangmu-divine-heal-0'), () => 0.5);
    expect(elder.hp).toBe(95);
    expect(formulas).toContain('样例神级回复 58');
  });

  it('捕捉、逃跑、等待和技能总数与代码相同', () => {
    expect(catchProbability(145, 1, 'perfect')).toBeCloseTo(0.3587186274509804, 12);
    expect(catchProbability(145, 0.2, 'perfect')).toBe(0.92);
    expect(judgeTiming(1)).toBe('perfect');
    expect(judgeTiming(1.07)).toBe('good');
    expect(judgeTiming(1.26)).toBe('close');
    expect(fleeChance(0)).toBeCloseTo(0.12, 10);
    expect(readDelay('结果会自动继续')).toBe(1500);
    expect(readDelay('x'.repeat(80))).toBe(4800);
    expect(skillStats().total).toBe(480);
    expect(formulas).toContain('样例捕捉 0.3587186274509804');
    expect(formulas).toContain('样例捕捉上限 0.92');
    expect(formulas).toContain('样例逃跑 0.12');
    expect(formulas).toContain('样例等待 1500');
    expect(formulas).toContain('样例等待上限 4800');
    expect(formulas).toContain('样例技能总数 480');
  });

  it('速度只比能力值，相等时玩家先动', () => {
    const zero = { con: 0, str: 0, int: 0, spi: 0, spd: 0 };
    expect(actionOrder(makeMon('yanke', 8, 1, true, zero))).toBe(27);
    expect(actionOrder(makeMon('dianrong', 8, 1, true, zero))).toBe(47);
    const fastFoe = prepareBattle([makeMon('yanke', 8, 1, true, zero)], [makeMon('dianrong', 8, 1, true, zero)], 'wild', '');
    expect(playerMove(fastFoe, 0, () => 0.5)[0]).toContain('电绒鼠');
    const tiedPlayer = makeMon('lujiao', 8, 1, true, zero);
    const tiedFoe = makeMon('lujiao', 8, 1, true, zero);
    tiedFoe.aspect = 'yinmu';
    ensureLoadout(tiedFoe);
    const tied = prepareBattle([tiedPlayer], [tiedFoe], 'wild', '');
    expect(playerMove(tied, 0, () => 0.5)[0]).toContain('叶刃');
    expect(formulas).toContain('样例出手 27 对 47');
  });

  it('暴击在命中之后掷，未命中不暴击，换下和读档都不保留', () => {
    const zero = { con: 0, str: 0, int: 0, spi: 0, spd: 0 };
    const user = makeMon('yanwei', 8, 1, true, zero);
    user.aspect = 'chunyang';
    ensureLoadout(user);
    const foe = makeMon('dianrong', 8, 1, true, zero);
    const move = getMove('chunyang-basic-attack-0');
    const before = foe.hp;
    const missed = resolveSkill(blankFighter(user), blankFighter(foe), move, () => 0.99);
    expect(missed.join('')).toContain('没有命中');
    expect(missed.join('')).not.toContain('暴击');
    expect(foe.hp).toBe(before);
    let calls = 0;
    resolveSkill(blankFighter(user), blankFighter(foe), move, () => {
      calls += 1;
      return 0.99;
    });
    expect(calls).toBe(1);
    calls = 0;
    const evaded = resolveSkill(blankFighter(user), blankFighter(foe), move, () => {
      calls += 1;
      return calls === 1 ? 0.2 : 0;
    });
    expect(evaded.join('')).toContain('闪避了攻击');
    expect(evaded.join('')).not.toContain('暴击');
    expect(calls).toBe(2);
    expect(foe.hp).toBe(before);
    calls = 0;
    const landed = resolveSkill(blankFighter(user), blankFighter(foe), move, () => {
      calls += 1;
      if (calls === 3) return 0;
      return 0.5;
    });
    expect(calls).toBe(4);
    expect(landed.join('')).toContain('暴击，造成 33 点伤害');
    expect(landed.join('')).not.toMatch(/1\.5|0\.08|%|倍率/);
    expect(damageOf(user, foe, getMove('yangmu-basic-heal-0'), () => {
      throw new Error('不应掷随机');
    }).damage).toBe(0);
    const reserve = makeMon('lujiao', 8, 1, true, zero);
    const battle = prepareBattle([user, reserve], [makeMon('dianrong', 8, 1, true, zero)], 'wild', '');
    battle.runtime[user.uid].critRate = 0.16;
    battle.runtime[user.uid].critDamage = 0.5;
    playerSwitch(battle, 1, () => 0.99);
    expect(battle.runtime[user.uid].critRate).toBe(0);
    expect(battle.runtime[user.uid].critDamage).toBe(0);
    expect(battle.runtime[reserve.uid].critRate).toBe(0);
    const stuffed = JSON.stringify({
      version: 1,
      play: {
        name: '芽',
        x: 960,
        y: 864,
        dir: 'down',
        team: [{ uid: 'fox', speciesId: 'yanwei', level: 8, exp: 0, hp: 20, mp: 10, ivs: zero, critRate: 0.4, critDamage: 0.5 }],
        balls: 1,
        playMs: 0,
      },
    });
    const loaded = deserialize(stuffed);
    expect(loaded?.team[0]).not.toHaveProperty('critRate');
    expect(loaded?.team[0]).not.toHaveProperty('critDamage');
    expect(serialize(loaded as PlayState)).not.toContain('critRate');
    expect(serialize(loaded as PlayState)).not.toContain('critDamage');
    expect(saves).toContain('xingya-island-save-v1');
    expect(saves).toContain('1.10.0');
  });

  it('游戏界面不引用内部设定文档', () => {
    const ui = readFileSync(new URL('./ui.ts', import.meta.url), 'utf8');
    const game = readFileSync(new URL('./game.ts', import.meta.url), 'utf8');
    expect(ui).not.toContain('docs/design');
    expect(game).not.toContain('docs/design');
    expect(ui).not.toContain('种族基础值');
    expect(ui).not.toContain('个体值');
  });
});
