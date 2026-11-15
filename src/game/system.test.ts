import { describe, expect, it } from 'vitest';
import { effectiveness, TYPE_ORDER } from './elements';
import { blankFighter, cycleAspect, ensureLoadout, makeMon, maxHp, readDelay, resolveSkill } from './logic';
import { deserialize } from './save';
import { SKILL_LIST, getMove, skillStats } from './skills';
import { CAT_LABEL, TIER_LABEL, TIER_LEVEL } from './types';
import type { MoveCat, MoveTier, TypeId } from './types';

const fixed = () => 0.5;

describe('十二属性与技能目录', () => {
  it('恰好 12 属性，每属性 40 个技能且四级五类齐全', () => {
    const stats = skillStats();
    expect(stats.types).toBe(12);
    expect(TYPE_ORDER).toHaveLength(12);
    expect(stats.total).toBe(480);
    const names = new Set<string>();
    const ids = new Set<string>();
    for (const type of TYPE_ORDER) {
      const moves = SKILL_LIST.filter((move) => move.type === type);
      expect(stats.perType[type]).toBe(40);
      expect(moves).toHaveLength(40);
      for (const tier of ['basic', 'mid', 'high', 'divine'] as MoveTier[]) {
        for (const cat of ['attack', 'guard', 'heal', 'aid', 'status'] as MoveCat[]) {
          expect(moves.filter((move) => move.tier === tier && move.cat === cat)).toHaveLength(2);
        }
      }
    }
    for (const move of SKILL_LIST) {
      expect(ids.has(move.id)).toBe(false);
      expect(names.has(move.name)).toBe(false);
      ids.add(move.id);
      names.add(move.name);
      expect(move.desc.length).toBeGreaterThan(8);
      if (move.cat === 'attack') expect(move.desc).toContain(String(move.power));
      if (move.cooldown > 0) expect(move.desc).toContain(String(move.cooldown));
      expect(move.desc).toContain(TIER_LABEL[move.tier]);
      expect(move.desc).toContain(CAT_LABEL[move.cat]);
      expect(getMove(move.id).name).toBe(move.name);
    }
  });

  it('相克、治疗上限、护盾、控制和神级冷却都按规则结算', () => {
    const user = makeMon('luzhu', 20, 0.4, true);
    const foe = makeMon('yanwei', 20, 1, true);
    const attack = resolveSkill(blankFighter(user), blankFighter(foe), getMove('yinshui-basic-attack-0'), fixed);
    expect(attack.join('')).toContain('相克');
    expect(effectiveness('yinshui', 'yanghuo')).toBe(1.5);
    const hurt = user.hp;
    const heal = resolveSkill(blankFighter(user), blankFighter(foe), getMove('yinshui-divine-heal-0'), fixed);
    expect(user.hp).toBeGreaterThan(hurt);
    expect(user.hp - hurt).toBeLessThanOrEqual(Math.floor((user.hp + (user.hp - hurt)) * 0.4) + 1);
    expect(heal.join('')).toContain('恢复');
    const guard = blankFighter(user);
    resolveSkill(guard, blankFighter(foe), getMove('yinshui-basic-guard-0'), fixed);
    expect(guard.shield).toBeGreaterThan(0);
    expect(guard.shield).toBeLessThanOrEqual(Math.floor(maxHp(guard.mon) * 0.35));
    const rooted = blankFighter(foe);
    const rootMove = SKILL_LIST.find((move) => move.type === 'yinshui' && move.effect === 'root' && move.tier === 'divine');
    expect(rootMove).toBeTruthy();
    const first = resolveSkill(blankFighter(user), rooted, rootMove!, () => 0.2);
    expect(first.join('')).toContain('定住');
    const second = resolveSkill(blankFighter(user), rooted, rootMove!, () => 0.2);
    expect(second.join('')).toContain('连续');
    expect(rootMove!.cooldown).toBeGreaterThan(0);
    const divine = blankFighter(user);
    resolveSkill(divine, blankFighter(foe), getMove('yinshui-divine-attack-0'), fixed);
    expect(divine.cd['yinshui-divine-attack-0']).toBe(3);
  });

  it('旧存档补上属性和技能，重复读取不变', () => {
    const legacy = JSON.stringify({
      version: 1,
      play: {
        name: '旧档',
        x: 100,
        y: 200,
        dir: 'down',
        team: [{ uid: 'old', speciesId: 'yanwei', level: 24, exp: 3, hp: 20, stages: { atk: 1, def: 0 } }],
        dex: { yanwei: { seen: true, caught: true } },
        balls: 4,
        quest: { introduced: true, caughtWild: true, bossDefeated: true, completed: true },
        trainers: { qinghe: true, lanchuan: true },
        playMs: 5000,
      },
    });
    const once = deserialize(legacy);
    const twice = deserialize(JSON.stringify({ version: 1, play: once }));
    expect(once?.team[0].aspect).toBe('yanghuo');
    expect(once?.team[0].level).toBe(24);
    expect(once?.team[0].moves?.length).toBeGreaterThan(0);
    expect(once?.quest.completed).toBe(true);
    expect(twice?.team[0].moves).toEqual(once?.team[0].moves);
    expect(twice?.team[0].aspect).toBe(once?.team[0].aspect);
    const mon = makeMon('lujiao', 24, 1, true);
    expect(cycleAspect(mon)).toContain('阴木');
    expect(mon.level).toBe(24);
    ensureLoadout(mon);
    expect(learnableHasDivine(mon.aspect!)).toBe(true);
    expect(TIER_LEVEL.divine).toBe(24);
    expect(readDelay('短', true)).toBeLessThan(readDelay('这是一句比较长的说明文字', false));
  });
});

function learnableHasDivine(type: TypeId): boolean {
  return SKILL_LIST.some((move) => move.type === type && move.tier === 'divine');
}
