import { describe, expect, it } from 'vitest';
import { blankCueMemory, elementColor, readBattleCue, type CueMemory, type CueNames } from './fx';

const names: CueNames = { player: '叶角鹿', foe: '电绒鼠', playerType: 'yangmu', foeType: 'yangjin' };

function step(line: string, memory: CueMemory = blankCueMemory()) {
  return readBattleCue(line, names, memory);
}

describe('战斗反馈不改结算', () => {
  it('物理和魔法出手分成两种效果，法力在出手那一句扣', () => {
    const physical = step('叶角鹿使用了叶刃');
    expect(physical.cue.kind).toBe('physical');
    expect(physical.cue.actor).toBe('player');
    expect(physical.cue.target).toBe('foe');
    expect(physical.cue.element).toBe('yangmu');
    expect(physical.cue.mpDelta).toBe(0);
    const magic = step('电绒鼠使用了新枝');
    expect(magic.cue.kind).toBe('magic');
    expect(magic.cue.mpDelta).toBeLessThan(0);
    expect(magic.cue.actor).toBe('foe');
    expect(magic.cue.target).toBe('player');
    const basic = step('叶角鹿使用了普通攻击');
    expect(basic.cue.kind).toBe('physical');
    expect(basic.cue.mpDelta).toBe(0);
    expect(basic.cue.element).toBe('yangmu');
  });

  it('伤害数字跟着体力变化，护盾挡住的部分不重复扣血', () => {
    const memory = step('叶角鹿使用了叶刃').memory;
    const hit = step('造成 12 点伤害', memory);
    expect(hit.cue.kind).toBe('hurt');
    expect(hit.cue.text).toBe('-12');
    expect(hit.cue.hpSide).toBe('foe');
    expect(hit.cue.hpDelta).toBe(-12);
    const crit = step('暴击，造成 18 点伤害，护盾挡下 5', memory);
    expect(crit.cue.kind).toBe('crit');
    expect(crit.cue.text).toBe('暴击 18');
    expect(crit.cue.hpDelta).toBe(-13);
    const blocked = step('没能破开防御，造成 1 点伤害', memory);
    expect(blocked.cue.hpDelta).toBe(-1);
  });

  it('治疗、护盾、强化、异常和未命中各有标记，文字不带公式', () => {
    expect(step('叶角鹿恢复了 10 点体力').cue).toMatchObject({ kind: 'heal', text: '+10', hpDelta: 10, hpSide: 'player' });
    expect(step('电绒鼠持续恢复了 4 点体力').cue.hpSide).toBe('foe');
    expect(step('叶角鹿获得 8 点护盾').cue).toMatchObject({ kind: 'shield', text: '护盾 +8', hpDelta: 0 });
    expect(step('叶角鹿的攻击上升了').cue.kind).toBe('buff');
    expect(step('电绒鼠灼伤了，攻击下降，还要持续 2 回合', { actor: 'player', form: 'support', element: '' }).cue.text).toBe('灼伤');
    expect(step('叶角鹿没有命中', { actor: 'player', form: 'physical', element: 'yangmu' }).cue).toMatchObject({ kind: 'miss', target: 'foe' });
    expect(step('叶角鹿受到反震 2').cue).toMatchObject({ hpSide: 'player', hpDelta: -2 });
    expect(step('电绒鼠受到灼伤伤害 3').cue.hpDelta).toBe(-3);
    expect(step('叶角鹿恢复了 2 点法力').cue.mpDelta).toBe(2);
    const joined = ['暴击 18', '护盾 +8', '+10', '灼伤'].join('');
    expect(joined).not.toMatch(/种族|个体|倍率|0\.85/);
    expect(elementColor('yanghuo')).toBe('#ef6844');
    expect(elementColor('没有')).toBe('#fff6ec');
  });
});
