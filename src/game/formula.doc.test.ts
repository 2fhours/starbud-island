import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { playerMove, prepareBattle } from './battle';
import { effectiveness } from './elements';
import {
  catchProbability,
  actionOrder,
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
  readDelay,
  resolveSkill,
  blankFighter,
} from './logic';
import { getMove, skillStats } from './skills';

const formulas = readFileSync(new URL('../../docs/design/formulas.md', import.meta.url), 'utf8');
const setting = readFileSync(new URL('../../docs/design/setting.md', import.meta.url), 'utf8');
const saves = readFileSync(new URL('../../docs/design/saves.md', import.meta.url), 'utf8');
const index = readFileSync(new URL('../../docs/design/README.md', import.meta.url), 'utf8');

describe('设定文档和公式一致', () => {
  it('索引能找到三份文档', () => {
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
    expect(formulas).toContain('样例体质 37');
    expect(formulas).toContain('样例生命 76');
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
    expect(superHit.attackBonus).toBeGreaterThan(superHit.defenseCut);
    expect(superHit.damage).toBe(21);
    expect(damageOf(attacker, fox, move, () => 0).damage).toBe(17);
    expect(damageOf(attacker, fox, move, () => 1).damage).toBe(25);
    const plainAttacker = makeMon('yanwei', 8, 1, true, zero);
    plainAttacker.aspect = 'chunyang';
    const plain = damageOf(plainAttacker, makeMon('dianrong', 8, 1, true, zero), getMove('chunyang-basic-attack-0'), () => 0.5);
    expect(plain.mult).toBe(1);
    expect(plain.damage).toBe(9);
    const yin = makeMon('fengling', 8, 1, true, zero);
    yin.aspect = 'yinjin';
    const yang = makeMon('dianrong', 8, 1, true, zero);
    yang.aspect = 'yangjin';
    const clash = damageOf(yin, yang, getMove('yinjin-basic-attack-0'), () => 0.5);
    expect(clash.mult).toBe(1.5);
    expect(clash.damage).toBe(16);
    expect(settleDamage((46 * 27 / 60) * 1.2 * 2 * 1.5, 28)).toMatchObject({ damage: 46, stopped: false });
    expect(damageOf(plainAttacker, makeMon('dianrong', 8, 1, true, zero), getMove('chunyang-basic-attack-0'), () => 0.5, { bonusFlat: 4 }).damage).toBe(13);
    expect(damageOf(plainAttacker, makeMon('dianrong', 8, 1, true, zero), getMove('chunyang-basic-attack-0'), () => 0.5, { bonusPercent: 0.1 }).damage).toBe(12);
    expect(damageOf(plainAttacker, makeMon('dianrong', 8, 1, true, zero), getMove('chunyang-basic-attack-0'), () => 0.5, {
      bonusFlat: 4,
      bonusPercent: 0.1,
      cutFlat: 4,
      cutPercent: 0.1,
    }).damage).toBe(8);
    const aided = blankFighter(makeMon('lujiao', 8, 1, true, zero));
    resolveSkill(aided, blankFighter(makeMon('dianrong', 8, 1, true, zero)), getMove('yangmu-basic-aid-0'), () => 0.5);
    expect(aided.bonusFlat).toBe(4);
    expect(aided.bonusPercent).toBe(0.08);
    expect(getMove('yangmu-mid-attack-0').bonusFlat).toBe(6);
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
    expect(formulas).toContain('样例普通 9');
    expect(formulas).toContain('样例固定 13');
    expect(formulas).toContain('样例百分比 12');
    expect(formulas).toContain('样例两边 8');
    expect(formulas).toContain('样例伤害 21');
    expect(formulas).toContain('样例伤害低 17');
    expect(formulas).toContain('样例伤害高 25');
    expect(formulas).toContain('样例阴阳 16');
    expect(formulas).toContain('样例同时 46');
    expect(formulas).toContain('样例未破防 1');
    expect(formulas).toContain('样例相生伤害 1');
    const strong = makeMon('luzhu', 8, 1, true, { ...zero, str: 31 });
    const mage = makeMon('luzhu', 8, 1, true, { ...zero, int: 31 });
    const magic = getMove('yinshui-basic-attack-1');
    expect(damageOf(attacker, fox, move, () => 0.5).damage).toBe(21);
    expect(damageOf(strong, fox, move, () => 0.5).damage).toBe(49);
    expect(damageOf(attacker, fox, magic, () => 0.5).damage).toBe(60);
    expect(damageOf(mage, fox, magic, () => 0.5).damage).toBe(91);
    expect(formulas).toContain('样例物理 49');
    expect(formulas).toContain('样例魔法 91');

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

  it('游戏界面不引用内部设定文档', () => {
    const ui = readFileSync(new URL('./ui.ts', import.meta.url), 'utf8');
    const game = readFileSync(new URL('./game.ts', import.meta.url), 'utf8');
    expect(ui).not.toContain('docs/design');
    expect(game).not.toContain('docs/design');
    expect(ui).not.toContain('种族基础值');
    expect(ui).not.toContain('个体值');
  });
});
