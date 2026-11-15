import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { damageOf, makeMon } from './logic';
import { SKILL_LIST, basicStrike, getMove, skillForm, skillFormLabel, skillUseLine } from './skills';
import type { Five, MoveEffect } from './types';

const zero: Five = { con: 0, str: 0, int: 0, spi: 0, spd: 0 };

function bumped(key: keyof Five): Five {
  return { ...zero, [key]: 31 };
}

describe('技能的物理、魔法和辅助', () => {
  it('直接伤害技能都有明确分类，说明和分类一致', () => {
    const attacks = SKILL_LIST.filter((move) => move.cat === 'attack');
    expect(attacks).toHaveLength(96);
    const seen = new Set<MoveEffect>();
    for (const move of attacks) {
      seen.add(move.effect);
      expect(move.power).toBeGreaterThan(0);
      expect(move.kind === 'physical' || move.kind === 'magic').toBe(true);
      const form = skillForm(move);
      expect(form).toBe(move.kind);
      expect(move.desc).toContain(skillFormLabel(move));
      expect(move.desc).toContain(skillUseLine(move));
      if (form === 'physical') {
        expect(move.effect === 'strike' || move.effect === 'recoil').toBe(true);
        expect(move.desc).toContain('以物攻对抗物防');
        expect(move.desc).not.toContain('以魔攻对抗魔防');
        expect(move.desc).not.toContain('魔法');
      } else {
        expect(move.effect === 'pierce' || move.effect === 'dotstrike').toBe(true);
        expect(move.desc).toContain('以魔攻对抗魔防');
        expect(move.desc).not.toContain('以物攻对抗物防');
        expect(move.desc).not.toContain('物理');
      }
    }
    expect([...seen].sort()).toEqual(['dotstrike', 'pierce', 'recoil', 'strike']);
    const basic = basicStrike('yangmu');
    expect(skillForm(basic)).toBe('physical');
    expect(basic.kind).toBe('physical');
    expect(basic.desc).toContain('物理');
    expect(basic.desc).toContain('以物攻对抗物防');
    expect(basic.desc).toContain('法力不够时也能用');
    expect(getMove('basic-strike').desc).toContain('以物攻对抗物防');
  });

  it('治疗、防御、增益和状态标成辅助，不写成伤害对抗', () => {
    const support = SKILL_LIST.filter((move) => move.cat !== 'attack');
    expect(support).toHaveLength(384);
    for (const move of support) {
      expect(move.power).toBe(0);
      expect(move.kind).toBe('');
      expect(skillForm(move)).toBe('support');
      expect(skillFormLabel(move)).toBe('辅助');
      expect(skillUseLine(move)).toBe('');
      expect(move.desc).toContain('辅助');
      expect(move.desc).not.toContain('以物攻对抗物防');
      expect(move.desc).not.toContain('以魔攻对抗魔防');
      expect(move.desc).not.toContain('物理');
      expect(move.desc).not.toContain('魔法');
      expect(damageOf(makeMon('lujiao', 8, 1, true, zero), makeMon('yanwei', 8, 1, true, zero), move, () => 0.5).damage).toBe(0);
    }
  });

  it('物理取物攻物防，魔法取魔攻魔防', () => {
    const foe = makeMon('yanwei', 8, 1, true, zero);
    const plain = makeMon('luzhu', 8, 1, true, zero);
    const strong = makeMon('luzhu', 8, 1, true, bumped('str'));
    const mage = makeMon('luzhu', 8, 1, true, bumped('int'));
    const tough = makeMon('yanwei', 8, 1, true, bumped('con'));
    const warded = makeMon('yanwei', 8, 1, true, bumped('spi'));
    const roll = () => 0.5;
    const pairs = [
      ['yinshui-basic-attack-0', 'physical'],
      ['yinshui-basic-attack-1', 'magic'],
      ['yinshui-mid-attack-0', 'physical'],
      ['yinshui-mid-attack-1', 'magic'],
    ] as const;
    for (const [id, form] of pairs) {
      const move = getMove(id);
      expect(skillForm(move)).toBe(form);
      const plainHit = damageOf(plain, foe, move, roll).damage;
      const strengthHit = damageOf(strong, foe, move, roll).damage;
      const mindHit = damageOf(mage, foe, move, roll).damage;
      if (form === 'physical') {
        expect(strengthHit).toBeGreaterThan(plainHit);
        expect(mindHit).toBe(plainHit);
        expect(damageOf(plain, tough, move, roll).damage).toBeLessThan(plainHit);
        expect(damageOf(plain, warded, move, roll).damage).toBe(plainHit);
      } else {
        expect(mindHit).toBeGreaterThan(plainHit);
        expect(strengthHit).toBe(plainHit);
        expect(damageOf(plain, warded, move, roll).damage).toBeLessThan(plainHit);
        expect(damageOf(plain, tough, move, roll).damage).toBe(plainHit);
      }
    }
  });

  it('界面和文档使用同一套类别说明', () => {
    const ui = readFileSync(new URL('./ui.ts', import.meta.url), 'utf8');
    expect(ui).toContain('skillFormLabel');
    expect(ui).toContain('move-form');
    expect(ui).not.toContain('以物攻对抗物防');
    expect(ui).not.toContain('种族值');
    const setting = readFileSync(new URL('../../docs/design/setting.md', import.meta.url), 'utf8');
    const formulas = readFileSync(new URL('../../docs/design/formulas.md', import.meta.url), 'utf8');
    const saves = readFileSync(new URL('../../docs/design/saves.md', import.meta.url), 'utf8');
    expect(setting).toContain('以物攻对抗物防');
    expect(setting).toContain('以魔攻对抗魔防');
    expect(formulas).toContain('以物攻对抗物防');
    expect(formulas).toContain('不另写一套倍率');
    expect(saves).toContain('1.7.3');
    expect(saves).toContain('xingya-island-save-v1');
  });
});
