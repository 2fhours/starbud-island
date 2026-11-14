import { getMove, getSpecies, effectiveness } from './data';
import type { Mon, MoveDef, QuestFlags, SpeciesId, Timing } from './types';
import { BALL_TOP_UP, MAX_LEVEL, TEAM_LIMIT } from './types';

let uidSeq = 1;

export function newUid(): string {
  uidSeq += 1;
  return `m${uidSeq.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function maxHp(mon: Mon): number {
  const base = getSpecies(mon.speciesId).bases.hp;
  return Math.floor((base * 2 * mon.level) / 40) + mon.level + 12;
}

export function combatStat(mon: Mon, key: 'atk' | 'def' | 'spd'): number {
  const base = getSpecies(mon.speciesId).bases[key];
  return Math.floor((base * 2 * mon.level) / 45) + 6;
}

export function stageMul(stage: number): number {
  const s = clamp(Math.round(stage), -3, 3);
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

export function expToNext(level: number): number {
  return 18 + level * level * 3;
}

export function expGain(foeLevel: number, baseExp: number, trainer: boolean): number {
  return Math.max(8, Math.floor((foeLevel * baseExp * (trainer ? 1.45 : 1)) / 7));
}

export function makeMon(speciesId: SpeciesId, level: number, hpRatio = 1): Mon {
  const mon: Mon = {
    uid: newUid(),
    speciesId,
    level,
    exp: 0,
    hp: 1,
    stages: { atk: 0, def: 0 },
  };
  mon.hp = clamp(Math.round(maxHp(mon) * hpRatio), 1, maxHp(mon));
  return mon;
}

export function cloneMon(mon: Mon): Mon {
  return {
    ...mon,
    uid: newUid(),
    stages: { atk: 0, def: 0 },
    hp: clamp(mon.hp, 0, maxHp(mon)),
  };
}

export function healTeam(team: Mon[]): void {
  for (const mon of team) {
    mon.hp = maxHp(mon);
    mon.stages = { atk: 0, def: 0 };
  }
}

export function topUpBalls(balls: number, min = BALL_TOP_UP): number {
  return Math.max(0, balls) < min ? min : balls;
}

export function grantExp(mon: Mon, amount: number): string[] {
  const name = getSpecies(mon.speciesId).name;
  const logs = [`${name}获得了 ${amount} 点经验`];
  if (mon.level >= MAX_LEVEL) {
    logs.push(`${name}已到目前的成长上限`);
    return logs;
  }
  mon.exp += amount;
  while (mon.level < MAX_LEVEL && mon.exp >= expToNext(mon.level)) {
    mon.exp -= expToNext(mon.level);
    const before = maxHp(mon);
    mon.level += 1;
    const after = maxHp(mon);
    mon.hp = clamp(mon.hp + (after - before), 1, after);
    logs.push(`${name}升到了 ${mon.level} 级，变得更结实了`);
  }
  if (mon.level >= MAX_LEVEL) mon.exp = 0;
  return logs;
}

export interface DamageResult {
  damage: number;
  mult: number;
  stab: boolean;
}

export function damageOf(attacker: Mon, defender: Mon, move: MoveDef, rng: () => number = Math.random): DamageResult {
  if (move.power <= 0) return { damage: 0, mult: 1, stab: false };
  const mult = effectiveness(move.type, getSpecies(defender.speciesId).type);
  const stab = move.type === getSpecies(attacker.speciesId).type;
  const atk = combatStat(attacker, 'atk') * stageMul(attacker.stages.atk);
  const def = Math.max(1, combatStat(defender, 'def') * stageMul(defender.stages.def));
  const roll = 0.9 + rng() * 0.1;
  const raw = (((2 * attacker.level) / 5 + 2) * move.power * atk) / def / 32 + 2;
  const damage = Math.max(1, Math.floor(raw * (stab ? 1.25 : 1) * mult * roll));
  return { damage, mult, stab };
}

export function performMove(attacker: Mon, defender: Mon, move: MoveDef, rng: () => number = Math.random): string[] {
  const an = getSpecies(attacker.speciesId).name;
  const dn = getSpecies(defender.speciesId).name;
  if (move.kind === 'heal') {
    const amt = Math.max(4, Math.floor(maxHp(attacker) * 0.35));
    const before = attacker.hp;
    attacker.hp = Math.min(maxHp(attacker), attacker.hp + amt);
    return [`${an}使用了${move.name}`, `${an}恢复了 ${attacker.hp - before} 点体力`];
  }
  if (move.kind === 'buff') {
    attacker.stages.def = clamp(attacker.stages.def + 1, -3, 3);
    return [`${an}使用了${move.name}`, `${an}的防御上升了`];
  }
  const result = damageOf(attacker, defender, move, rng);
  defender.hp = Math.max(0, defender.hp - result.damage);
  const logs = [`${an}使用了${move.name}`, `造成 ${result.damage} 点伤害`];
  if (result.mult >= 2) logs.push('效果拔群');
  else if (result.mult <= 0.5) logs.push('效果不太好');
  if (move.kind === 'debuff' && defender.hp > 0) {
    defender.stages.atk = clamp(defender.stages.atk - 1, -3, 3);
    logs.push(`${dn}的攻击下降了`);
  }
  if (defender.hp <= 0) logs.push(`${dn}失去了战斗能力`);
  return logs;
}

export function catchProbability(catchRate: number, hpRatio: number, timing: Timing): number {
  const hpFactor = 0.22 + (1 - clamp(hpRatio, 0, 1)) * 0.55;
  const timingMul = { perfect: 1.55, good: 1.18, close: 0.88, miss: 0.42 }[timing];
  return clamp((catchRate / 255) * hpFactor * timingMul * 1.85, 0.06, 0.92);
}

export function judgeTiming(scale: number): Timing {
  const d = Math.abs(scale - 1);
  if (d <= 0.07) return 'perfect';
  if (d <= 0.15) return 'good';
  if (d <= 0.26) return 'close';
  return 'miss';
}

export function timingLabel(timing: Timing): string {
  return { perfect: '时机完美', good: '时机不错', close: '差一点', miss: '错过了节奏' }[timing];
}

export function fleeChance(fails: number): number {
  return clamp(0.12 + fails * 0.16, 0.12, 0.72);
}

export function receiveMon(team: Mon[], box: Mon[], mon: Mon): 'team' | 'box' {
  if (team.length < TEAM_LIMIT) {
    team.push(mon);
    return 'team';
  }
  box.push(mon);
  return 'box';
}

export function setLead(team: Mon[], index: number): void {
  if (index <= 0 || index >= team.length) return;
  const [mon] = team.splice(index, 1);
  team.unshift(mon);
}

export function formatPlay(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}小时${m % 60}分`;
  return `${m}分${total % 60}秒`;
}

export function questObjectives(quest: QuestFlags): { title: string; done: boolean }[] {
  return [
    { title: '听芽婆婆讲完出发的委托', done: quest.introduced },
    { title: '收服至少一只野生芽灵', done: quest.caughtWild },
    { title: '在北林通过岚川的试炼', done: quest.bossDefeated },
    { title: '回到星芽驿向芽婆婆复命', done: quest.completed },
  ];
}

export function grandmaFollowup(quest: QuestFlags): string[] {
  if (quest.completed) return ['最初的委托已经完成了。岛还很大，芽灵也还在散步。'];
  if (quest.caughtWild && quest.bossDefeated) {
    return ['你做到了。图鉴上有了新名字，北林的试炼也通过了。', '星芽岛没有终点。想继续走的话，湖岸和林子都还空着。'];
  }
  const missing: string[] = [];
  if (!quest.caughtWild) missing.push('还差一只愿意同行的野生芽灵');
  if (!quest.bossDefeated) missing.push('北林的岚川还在等你');
  return [`我在驿站看着你。${missing.join('，')}。`, '体力不够就在门前休息。星芽球若少于八个，我会帮你补上。'];
}

export function emptyDex(): Record<SpeciesId, { seen: boolean; caught: boolean }> {
  return {
    lujiao: { seen: false, caught: false },
    yanwei: { seen: false, caught: false },
    luzhu: { seen: false, caught: false },
    dianrong: { seen: false, caught: false },
    yanke: { seen: false, caught: false },
    fengling: { seen: false, caught: false },
    taibei: { seen: false, caught: false },
    xiwen: { seen: false, caught: false },
  };
}

export function moveByIndex(mon: Mon, index: number): MoveDef {
  return getMove(getSpecies(mon.speciesId).moves[index] ?? getSpecies(mon.speciesId).moves[0]);
}
