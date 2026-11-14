import { effectiveness, getSpecies } from './data';
import {
  combatStat,
  expGain,
  grantExp,
  maxHp,
  moveByIndex,
  performMove,
} from './logic';
import type { Mon } from './types';

export interface Battle {
  kind: 'wild' | 'trainer';
  trainerName: string;
  player: Mon[];
  pIndex: number;
  foes: Mon[];
  fIndex: number;
  phase: 'input' | 'switch' | 'end';
  result?: 'win' | 'lose' | 'run' | 'catch';
}

export function prepareBattle(player: Mon[], foes: Mon[], kind: Battle['kind'], trainerName: string): Battle {
  for (const mon of [...player, ...foes]) mon.stages = { atk: 0, def: 0 };
  const pIndex = Math.max(0, player.findIndex((mon) => mon.hp > 0));
  return { kind, trainerName, player, pIndex, foes, fIndex: 0, phase: player.some((mon) => mon.hp > 0) ? 'input' : 'end', result: player.some((mon) => mon.hp > 0) ? undefined : 'lose' };
}

function foe(battle: Battle): Mon {
  return battle.foes[battle.fIndex];
}

function me(battle: Battle): Mon {
  return battle.player[battle.pIndex];
}

function checkPlayerDown(battle: Battle): string[] {
  if (me(battle).hp > 0) return [];
  if (battle.player.some((mon) => mon.hp > 0)) {
    battle.phase = 'switch';
    return ['要换一位还有体力的伙伴上场'];
  }
  battle.phase = 'end';
  battle.result = 'lose';
  return ['所有伙伴都没有体力了'];
}

function checkFoeDown(battle: Battle): string[] {
  const current = foe(battle);
  if (current.hp > 0) return [];
  const species = getSpecies(current.speciesId);
  const logs = grantExp(me(battle), expGain(current.level, species.baseExp, battle.kind === 'trainer'));
  const next = battle.foes.findIndex((mon, index) => index > battle.fIndex && mon.hp > 0);
  if (next >= 0) {
    battle.fIndex = next;
    battle.foes[next].stages = { atk: 0, def: 0 };
    logs.push(`${battle.trainerName}派出了${getSpecies(battle.foes[next].speciesId).name}`);
    return logs;
  }
  battle.phase = 'end';
  battle.result = 'win';
  logs.push(battle.kind === 'trainer' ? `${battle.trainerName}收回了伙伴` : '野生芽灵退开了');
  return logs;
}

function chooseEnemyMove(battle: Battle): number {
  const attacker = foe(battle);
  const defender = me(battle);
  const defType = getSpecies(defender.speciesId).type;
  let best = 0;
  let bestScore = -1;
  getSpecies(attacker.speciesId).moves.forEach((_, index) => {
    const move = moveByIndex(attacker, index);
    let score: number;
    if (move.kind === 'heal') score = attacker.hp <= Math.ceil(maxHp(attacker) * 0.45) ? 78 : 6;
    else if (move.kind === 'buff') score = attacker.stages.def >= 2 ? 4 : 34;
    else score = Math.max(1, move.power) * effectiveness(move.type, defType);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

function enemyActs(battle: Battle, rng: () => number): string[] {
  if (battle.phase !== 'input' || me(battle).hp <= 0 || foe(battle).hp <= 0) return [];
  const move = moveByIndex(foe(battle), chooseEnemyMove(battle));
  const logs = performMove(foe(battle), me(battle), move, rng);
  logs.push(...checkPlayerDown(battle));
  return logs;
}

export function playerMove(battle: Battle, moveIndex: number, rng: () => number = Math.random): string[] {
  if (battle.phase !== 'input') return [];
  const attacker = me(battle);
  const defender = foe(battle);
  if (attacker.hp <= 0 || defender.hp <= 0) return [];
  const move = moveByIndex(attacker, moveIndex);
  const logs: string[] = [];
  const playerFirst = combatStat(attacker, 'spd') >= combatStat(defender, 'spd');
  const foeIndex = battle.fIndex;
  const doPlayer = () => {
    if (battle.phase !== 'input' || attacker.hp <= 0 || foe(battle).hp <= 0) return;
    logs.push(...performMove(attacker, foe(battle), move, rng));
    logs.push(...checkFoeDown(battle));
  };
  const doEnemy = () => {
    if (battle.phase !== 'input' || battle.fIndex !== foeIndex) return;
    logs.push(...enemyActs(battle, rng));
  };
  if (playerFirst) {
    doPlayer();
    doEnemy();
  } else {
    doEnemy();
    doPlayer();
  }
  return logs;
}

export function playerSwitch(battle: Battle, index: number, rng: () => number = Math.random): string[] {
  if (battle.phase !== 'input' && battle.phase !== 'switch') return [];
  const next = battle.player[index];
  if (!next) return ['没有这位伙伴'];
  if (index === battle.pIndex && battle.phase === 'input') return ['它已经在场上了'];
  if (next.hp <= 0) return ['它已经没有体力了'];
  battle.pIndex = index;
  next.stages = { atk: 0, def: 0 };
  const logs = [`上场吧，${getSpecies(next.speciesId).name}`];
  if (battle.phase === 'switch') {
    battle.phase = 'input';
    return logs;
  }
  logs.push(...enemyActs(battle, rng));
  return logs;
}

export function playerRun(battle: Battle): string[] {
  if (battle.phase !== 'input') return [];
  if (battle.kind === 'trainer') return [`${battle.trainerName || '对方'}挡住了退路`];
  battle.phase = 'end';
  battle.result = 'run';
  return ['你和伙伴先退开了'];
}

export function resolveCatch(battle: Battle, success: boolean, rng: () => number = Math.random): string[] {
  if (battle.phase !== 'input') return [];
  if (battle.kind === 'trainer') return ['训练师的伙伴不能收服'];
  if (success) {
    const current = foe(battle);
    const species = getSpecies(current.speciesId);
    battle.phase = 'end';
    battle.result = 'catch';
    const logs = [`收服成功，${species.name}愿意同行`];
    logs.push(...grantExp(me(battle), expGain(current.level, species.baseExp, false)));
    return logs;
  }
  const logs = ['它跳出了星芽球'];
  logs.push(...enemyActs(battle, rng));
  return logs;
}
