import { describe, expect, it } from 'vitest';
import { BURN_FRACTION, BURN_PHYS_MUL, PARALYZE_SKIP, POISON_FRACTION, ailmentOf, statusLoss } from './ailments';
import { playerMove, prepareBattle } from './battle';
import { blankFighter, damageOf, makeMon, maxHp, opening, resolveSkill, tickStatus } from './logic';
import { SKILL_LIST, getMove } from './skills';
import type { Five } from './types';

const zero: Five = { con: 0, str: 0, int: 0, spi: 0, spd: 0 };

describe('异常状态', () => {
  it('状态招分别对应灼伤、中毒、麻痹和睡眠，相同异常不叠加', () => {
    const burns = SKILL_LIST.filter((move) => move.effect === 'blight' && move.stat === 'atk');
    const poisons = SKILL_LIST.filter((move) => move.effect === 'blight' && move.stat === 'def');
    const paras = SKILL_LIST.filter((move) => move.effect === 'blight' && move.stat === 'spd');
    const sleeps = SKILL_LIST.filter((move) => move.effect === 'root');
    expect(burns.length).toBeGreaterThan(0);
    expect(poisons.length).toBeGreaterThan(0);
    expect(paras.length).toBeGreaterThan(0);
    expect(sleeps.length).toBeGreaterThan(0);
    expect(ailmentOf(burns[0])).toBe('burn');
    expect(ailmentOf(poisons[0])).toBe('poison');
    expect(ailmentOf(paras[0])).toBe('paralyze');
    expect(ailmentOf(sleeps[0])).toBe('sleep');
    const user = blankFighter(makeMon('lujiao', 12, 1, true, zero));
    const foe = blankFighter(makeMon('yanwei', 12, 1, true, zero));
    const burn = burns.find((move) => move.type === 'yangmu' && move.tier === 'basic') ?? burns[0];
    resolveSkill(user, foe, burn, () => 0.5);
    expect(foe.ailment).toBe('burn');
    const turns = foe.ailmentTurns;
    resolveSkill(user, foe, burn, () => 0.5);
    expect(foe.ailmentTurns).toBe(turns);
    expect(resolveSkill(user, foe, burn, () => 0.5).join('')).toContain('没有叠加');
  });

  it('灼伤按上限的十六分之一扣血并降低物理伤害，魔法不受这层修正', () => {
    const mon = makeMon('lujiao', 16, 1, true, zero);
    const cap = maxHp(mon);
    expect(statusLoss(cap, BURN_FRACTION)).toBe(Math.max(1, Math.min(Math.floor(cap * 0.08), Math.floor(cap * BURN_FRACTION))));
    expect(statusLoss(cap, POISON_FRACTION)).toBeGreaterThan(statusLoss(cap, BURN_FRACTION));
    const fighter = blankFighter(mon);
    fighter.ailment = 'burn';
    fighter.ailmentTurns = 2;
    const before = mon.hp;
    expect(tickStatus(fighter).join('')).toContain('灼伤伤害');
    expect(before - mon.hp).toBe(statusLoss(cap, BURN_FRACTION));
    expect(fighter.ailmentTurns).toBe(1);
    const foe = makeMon('yanke', 16, 1, true, zero);
    const move = getMove('yangmu-basic-attack-0');
    const plain = damageOf(mon, foe, move, () => 0.5).damage;
    const burned = damageOf(mon, foe, move, () => 0.5, { burned: true }).damage;
    expect(burned).toBeLessThanOrEqual(plain);
    expect(BURN_PHYS_MUL).toBe(0.85);
    const magic = getMove('yangmu-basic-attack-1');
    expect(damageOf(mon, foe, magic, () => 0.5, { burned: true }).damage).toBe(damageOf(mon, foe, magic, () => 0.5).damage);
  });

  it('睡眠只跳过一次，麻痹按四分之一概率停手，敌方不会重复上同一异常', () => {
    const asleep = blankFighter(makeMon('luzhu', 10, 1, true, zero));
    asleep.ailment = 'sleep';
    asleep.ailmentTurns = 1;
    expect(opening(asleep, () => 0).skip).toBe(true);
    expect(asleep.ailment).toBe('');
    const numb = blankFighter(makeMon('luzhu', 10, 1, true, zero));
    numb.ailment = 'paralyze';
    numb.ailmentTurns = 2;
    expect(PARALYZE_SKIP).toBe(0.25);
    expect(opening(numb, () => 0).skip).toBe(true);
    expect(opening(numb, () => 0.9).skip).toBe(false);
    const foeMon = makeMon('dianrong', 20, 1, true, zero);
    const player = makeMon('lujiao', 20, 1, true, zero);
    const status = SKILL_LIST.find((move) => move.type === foeMon.aspect && move.effect === 'blight');
    expect(status).toBeTruthy();
    foeMon.moves = [status!.id, 'yangjin-basic-attack-0'];
    const battle = prepareBattle([player], [foeMon], 'wild', '');
    battle.runtime[player.uid].ailment = ailmentOf(status!);
    battle.runtime[player.uid].ailmentTurns = 2;
    const logs = playerMove(battle, 0, () => 0.5);
    expect(logs.join('')).not.toContain('没有叠加');
  });
});
