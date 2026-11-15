import { getSpecies } from './data';
import { effectiveness } from './elements';
import { basicStrike } from './skills';
import {
  actionOrder,
  aspectOf,
  blankFighter,
  expGain,
  grantExp,
  maxHp,
  moveByIndex,
  opening,
  resolveSkill,
  tickStatus,
} from './logic';
import type { Fighter, Mon } from './types';

export interface Battle {
  kind: 'wild' | 'trainer';
  trainerName: string;
  player: Mon[];
  pIndex: number;
  foes: Mon[];
  fIndex: number;
  phase: 'input' | 'switch' | 'end';
  result?: 'win' | 'lose' | 'run' | 'catch';
  runtime: Record<string, Fighter>;
}

export function prepareBattle(player: Mon[], foes: Mon[], kind: Battle['kind'], trainerName: string): Battle {
  const runtime: Record<string, Fighter> = {};
  for (const mon of [...player, ...foes]) {
    mon.stages = { atk: 0, def: 0, spd: 0 };
    runtime[mon.uid] = blankFighter(mon);
  }
  const pIndex = Math.max(0, player.findIndex((mon) => mon.hp > 0));
  return {
    kind,
    trainerName,
    player,
    pIndex,
    foes,
    fIndex: 0,
    phase: player.some((mon) => mon.hp > 0) ? 'input' : 'end',
    result: player.some((mon) => mon.hp > 0) ? undefined : 'lose',
    runtime,
  };
}

function side(battle: Battle, mon: Mon): Fighter {
  return battle.runtime[mon.uid] ?? (battle.runtime[mon.uid] = blankFighter(mon));
}

function clearBody(battle: Battle, mon: Mon): void {
  mon.stages = { atk: 0, def: 0, spd: 0 };
  const fighter = side(battle, mon);
  fighter.shield = 0;
  fighter.dotTurns = 0;
  fighter.hotTurns = 0;
  fighter.rootTurns = 0;
  fighter.dotRatio = 0;
  fighter.hotRatio = 0;
}

function foe(battle: Battle): Mon {
  return battle.foes[battle.fIndex];
}

function me(battle: Battle): Mon {
  return battle.player[battle.pIndex];
}

function checkPlayerDown(battle: Battle): string[] {
  if (me(battle).hp > 0 || battle.phase === 'switch' || battle.phase === 'end') return [];
  if (battle.player.some((mon) => mon.hp > 0)) {
    battle.phase = 'switch';
    return ['要换一位还有体力的伙伴上场'];
  }
  battle.phase = 'end';
  battle.result = 'lose';
  return ['所有伙伴都没有体力了'];
}

function checkFoeDown(battle: Battle): string[] {
  if (battle.phase === 'end') return [];
  const current = foe(battle);
  if (current.hp > 0) return [];
  const species = getSpecies(current.speciesId);
  const logs = grantExp(me(battle), expGain(current.level, species.baseExp, battle.kind === 'trainer'));
  const next = battle.foes.findIndex((mon, index) => index > battle.fIndex && mon.hp > 0);
  if (next >= 0) {
    battle.fIndex = next;
    clearBody(battle, battle.foes[next]);
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
  const defType = aspectOf(defender);
  const cd = side(battle, attacker).cd;
  let best = 0;
  let bestScore = -1;
  (attacker.moves ?? []).forEach((_, index) => {
    const move = moveByIndex(attacker, index);
    if ((cd[move.id] ?? 0) > 0 || move.cost > (attacker.mp ?? 0)) return;
    let score = 1;
    if (move.cat === 'heal') score = attacker.hp <= Math.ceil(maxHp(attacker) * 0.45) ? 80 : 6;
    else if (move.cat === 'guard') score = side(battle, attacker).shield > maxHp(attacker) * 0.2 ? 4 : 36;
    else if (move.cat === 'aid') score = 28;
    else if (move.cat === 'status') score = side(battle, defender).rootTurns > 0 && move.effect === 'root' ? 2 : 34;
    else score = Math.max(1, move.power) * effectiveness(move.type, defType);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return bestScore < 0 ? -1 : best;
}

function act(battle: Battle, actor: Mon, target: Mon, moveIndex: number, rng: () => number): string[] {
  const user = side(battle, actor);
  const other = side(battle, target);
  const open = opening(user);
  if (open.skip) return open.logs;
  const move = moveIndex < 0 ? basicStrike(aspectOf(actor)) : moveByIndex(actor, moveIndex);
  return resolveSkill(user, other, move, rng);
}

function enemyActs(battle: Battle, rng: () => number): string[] {
  if (battle.phase !== 'input' || me(battle).hp <= 0 || foe(battle).hp <= 0) return [];
  const logs = act(battle, foe(battle), me(battle), chooseEnemyMove(battle), rng);
  logs.push(...checkPlayerDown(battle));
  return logs;
}

export function playerMove(battle: Battle, moveIndex: number, rng: () => number = Math.random): string[] {
  if (battle.phase !== 'input') return [];
  const attacker = me(battle);
  const defender = foe(battle);
  if (attacker.hp <= 0 || defender.hp <= 0) return [];
  const logs: string[] = [];
  const playerFirst = actionOrder(attacker) >= actionOrder(defender);
  const foeIndex = battle.fIndex;
  const doPlayer = () => {
    if (battle.phase !== 'input' || attacker.hp <= 0 || foe(battle).hp <= 0) return;
    logs.push(...act(battle, attacker, foe(battle), moveIndex, rng));
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
  if (battle.phase === 'input') {
    logs.push(...tickStatus(side(battle, attacker)));
    logs.push(...tickStatus(side(battle, foe(battle))));
    logs.push(...checkFoeDown(battle));
    logs.push(...checkPlayerDown(battle));
  }
  return logs;
}

export function playerSwitch(battle: Battle, index: number, rng: () => number = Math.random): string[] {
  if (battle.phase !== 'input' && battle.phase !== 'switch') return [];
  const next = battle.player[index];
  if (!next) return ['没有这位伙伴'];
  if (index === battle.pIndex && battle.phase === 'input') return ['它已经在场上了'];
  if (next.hp <= 0) return ['它已经没有体力了'];
  clearBody(battle, me(battle));
  battle.pIndex = index;
  clearBody(battle, next);
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
