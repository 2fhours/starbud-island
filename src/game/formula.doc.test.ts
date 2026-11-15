import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { playerMove, prepareBattle } from './battle';
import { effectiveness } from './elements';
import {
  catchProbability,
  combatStat,
  damageOf,
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
    const deer = makeMon('lujiao', 5, 1, true);
    expect(maxHp(deer)).toBe(29);
    expect(combatStat(deer, 'atk')).toBe(17);
    expect(expToNext(5)).toBe(93);
    expect(expGain(5, 62, false)).toBe(44);
    expect(expGain(5, 62, true)).toBe(64);
    expect(formulas).toContain('样例体力 29');
    expect(formulas).toContain('样例攻击 17');
    expect(formulas).toContain('样例经验 93、44、64');
    const stayed = makeMon('lujiao', 5, 1, true);
    grantExp(stayed, 40);
    expect(stayed.level).toBe(5);
    expect(stayed.exp).toBe(40);
    expect(formulas).toContain('样例经验结余 40');
    expect(effectiveness('yinshui', 'yanghuo')).toBe(1.5);
    expect(effectiveness('yanghuo', 'yinshui')).toBe(0.83);
    expect(effectiveness('yanghuo', 'yinjin')).toBe(1.6);
    expect(effectiveness('yangjin', 'yangjin')).toBe(0.9);
    expect(formulas).toContain('样例倍率 1.5、0.83、1.6、0.9');
  });

  it('伤害、治疗和护盾样例与代码相同', () => {
    const attacker = makeMon('luzhu', 8, 1, true);
    const move = getMove('yinshui-basic-attack-0');
    expect(damageOf(attacker, makeMon('yanwei', 8, 1, true), move, () => 0.5).damage).toBe(19);
    expect(damageOf(attacker, makeMon('yanwei', 8, 1, true), move, () => 0).damage).toBe(17);
    expect(damageOf(attacker, makeMon('yanwei', 8, 1, true), move, () => 1).damage).toBe(20);
    expect(damageOf(attacker, makeMon('lujiao', 8, 1, true), move, () => 0.5).damage).toBe(10);
    expect(formulas).toContain('样例伤害 19');
    expect(formulas).toContain('样例伤害低 17');
    expect(formulas).toContain('样例伤害高 20');
    expect(formulas).toContain('样例相生伤害 10');

    const hurt = makeMon('lujiao', 5, 0.4, true);
    expect(hurt.hp).toBe(12);
    resolveSkill(blankFighter(hurt), blankFighter(makeMon('dianrong', 5, 1, true)), getMove('yangmu-basic-heal-0'), () => 0);
    expect(hurt.hp).toBe(16);
    expect(formulas).toContain('样例回复 4');

    const full = makeMon('lujiao', 5, 1, true);
    const shielded = blankFighter(full);
    const guard = getMove('yangmu-basic-guard-0');
    for (let i = 0; i < 6; i += 1) resolveSkill(shielded, blankFighter(makeMon('dianrong', 5, 1, true)), guard, () => 0);
    expect(shielded.shield).toBe(10);
    expect(formulas).toContain('样例护盾 10');

    const elder = makeMon('lujiao', 24, 0.2, true);
    expect(maxHp(elder)).toBe(96);
    expect(elder.hp).toBe(19);
    resolveSkill(blankFighter(elder), blankFighter(makeMon('dianrong', 5, 1, true)), getMove('yangmu-divine-heal-0'), () => 0);
    expect(elder.hp).toBe(49);
    expect(formulas).toContain('样例神级回复 30');
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
    expect(combatStat(makeMon('yanke', 8, 1, true), 'spd')).toBe(14);
    expect(combatStat(makeMon('dianrong', 8, 1, true), 'spd')).toBe(31);
    const fastFoe = prepareBattle([makeMon('yanke', 8, 1, true)], [makeMon('dianrong', 8, 1, true)], 'wild', '');
    expect(playerMove(fastFoe, 0, () => 0.5)[0]).toContain('电绒鼠');
    const tiedPlayer = makeMon('lujiao', 8, 1, true);
    const tiedFoe = makeMon('lujiao', 8, 1, true);
    tiedFoe.aspect = 'yinmu';
    ensureLoadout(tiedFoe);
    const tied = prepareBattle([tiedPlayer], [tiedFoe], 'wild', '');
    expect(playerMove(tied, 0, () => 0.5)[0]).toContain('叶刃');
    expect(formulas).toContain('样例速度 31 对 14');
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
