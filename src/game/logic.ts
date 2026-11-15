import { TYPE_META, relate } from './elements';
import { getMove, skillForm, skillsOf } from './skills';
import { getSpecies, SPECIES_LIST } from './data';
import { evolutionStatus } from './evolution';
import { derive, evasionChance, hitChance, rollIvs, validIvs, ivFromUid } from './stats';
import type { Fighter, Five, Mon, MoveCat, MoveDef, PlayState, QuestFlags, RidgeQuest, SpeciesId, Timing, TypeId } from './types';
import { BALL_TOP_UP, LOADOUT_LIMIT, MAX_LEVEL, TEAM_LIMIT, TIER_LEVEL } from './types';

let uidSeq = 1;

export function newUid(): string {
  uidSeq += 1;
  return `m${uidSeq.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function monIvs(mon: Mon): Five {
  return validIvs(mon.ivs) ? mon.ivs : ivFromUid(mon.uid);
}

export function profile(mon: Mon) {
  return derive(getSpecies(mon.speciesId).race, monIvs(mon), mon.level);
}

export function maxHp(mon: Mon): number {
  return profile(mon).maxHp;
}

export function maxMp(mon: Mon): number {
  return profile(mon).maxMp;
}

export function speedPoint(mon: Mon): number {
  return Math.max(1, Math.floor(profile(mon).core.spd * stageMul(mon.stages.spd)));
}

export function actionOrder(mon: Mon): number {
  return Math.max(1, Math.floor(profile(mon).action * stageMul(mon.stages.spd)));
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

export function makeMon(speciesId: SpeciesId, level: number, hpRatio = 1, lockAspect = false, ivs?: Five): Mon {
  const mon: Mon = {
    uid: newUid(),
    speciesId,
    level,
    exp: 0,
    hp: 1,
    mp: 0,
    ivs: ivs ? { ...ivs } : rollIvs(),
    stages: { atk: 0, def: 0, spd: 0 },
    aspect: getSpecies(speciesId).type,
  };
  if (!lockAspect) mon.aspect = flipAspect(getSpecies(speciesId).type, mon.uid);
  mon.hp = clamp(Math.round(maxHp(mon) * hpRatio), 1, maxHp(mon));
  mon.mp = maxMp(mon);
  ensureLoadout(mon);
  return mon;
}

export function cloneMon(mon: Mon): Mon {
  const copy: Mon = {
    ...mon,
    uid: newUid(),
    stages: { atk: 0, def: 0, spd: 0 },
    ivs: { ...monIvs(mon) },
    hp: clamp(mon.hp, 0, maxHp(mon)),
    mp: clamp(mon.mp ?? 0, 0, maxMp(mon)),
    moves: [...(mon.moves ?? [])],
  };
  ensureLoadout(copy);
  return copy;
}

export function healTeam(team: Mon[]): void {
  for (const mon of team) {
    mon.hp = maxHp(mon);
    mon.mp = maxMp(mon);
    mon.stages = { atk: 0, def: 0, spd: 0 };
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
    const beforeMp = maxMp(mon);
    mon.level += 1;
    const after = maxHp(mon);
    const afterMp = maxMp(mon);
    const floorHp = mon.hp > 0 ? 1 : 0;
    mon.hp = clamp(mon.hp + (after - before), floorHp, after);
    mon.mp = clamp((mon.mp ?? 0) + (afterMp - beforeMp), 0, afterMp);
    logs.push(`${name}升到了 ${mon.level} 级，变得更结实了`);
  }
  if (mon.level >= MAX_LEVEL) mon.exp = 0;
  return logs;
}

export interface DamageResult {
  damage: number;
  mult: number;
  stab: boolean;
  attackBonus: number;
  defenseCut: number;
  stopped: boolean;
}

export interface StrikeMods {
  bonusFlat?: number;
  bonusPercent?: number;
  cutFlat?: number;
  cutPercent?: number;
}

export const BONUS_PERCENT_MAX = 0.5;
export const CUT_PERCENT_MAX = 0.6;

export function settleDamage(attackBase: number, defenseFlat: number, mods: StrikeMods = {}): { damage: number; stopped: boolean; attackBonus: number; defenseCut: number } {
  const bonusPercent = clamp(mods.bonusPercent ?? 0, 0, BONUS_PERCENT_MAX);
  const cutPercent = clamp(mods.cutPercent ?? 0, 0, CUT_PERCENT_MAX);
  const bonusFlat = Math.max(0, mods.bonusFlat ?? 0);
  const extraCut = Math.max(0, mods.cutFlat ?? 0);
  const attackBonus = attackBase * (1 + bonusPercent) + bonusFlat;
  const defenseCut = defenseFlat + extraCut;
  const raw = attackBonus * (1 - cutPercent) - defenseCut;
  if (raw < 1) return { damage: 1, stopped: true, attackBonus, defenseCut };
  return { damage: Math.floor(raw), stopped: false, attackBonus, defenseCut };
}

export function blankFighter(mon: Mon): Fighter {
  return { mon, shield: 0, dotTurns: 0, dotRatio: 0, hotTurns: 0, hotRatio: 0, rootTurns: 0, bonusFlat: 0, bonusPercent: 0, cutFlat: 0, cutPercent: 0, cd: {} };
}

export function aspectOf(mon: Mon): TypeId {
  const aspect = mon.aspect;
  if (aspect && aspect in TYPE_META) return aspect;
  return getSpecies(mon.speciesId).type;
}

function flipAspect(type: TypeId, uid: string): TypeId {
  const meta = TYPE_META[type];
  if (meta.element === 'pure') return type;
  const yin = `yin${meta.element}` as TypeId;
  const yang = `yang${meta.element}` as TypeId;
  const hash = [...uid].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return hash % 2 === 0 ? yang : yin;
}

export function learnableMoves(mon: Mon): MoveDef[] {
  return skillsOf(aspectOf(mon)).filter((move) => mon.level >= TIER_LEVEL[move.tier]);
}

export function defaultLoadout(mon: Mon): string[] {
  const known = learnableMoves(mon);
  const pick = (cat: MoveCat) => known.find((move) => move.cat === cat)?.id;
  return [pick('attack'), pick('guard'), pick('heal'), pick('aid')].filter((id): id is string => !!id).slice(0, LOADOUT_LIMIT);
}

export function ensureLoadout(mon: Mon): void {
  mon.aspect = aspectOf(mon);
  const known = new Set(learnableMoves(mon).map((move) => move.id));
  const kept = (mon.moves ?? []).filter((id) => known.has(id)).slice(0, LOADOUT_LIMIT);
  mon.moves = kept.length ? kept : defaultLoadout(mon);
}

export function toggleEquip(mon: Mon, id: string): string {
  ensureLoadout(mon);
  const known = new Set(learnableMoves(mon).map((move) => move.id));
  if (!known.has(id)) return '还没学会这一招';
  const moves = mon.moves ?? [];
  if (moves.includes(id)) {
    if (moves.length <= 1) return '至少保留一个技能';
    mon.moves = moves.filter((item) => item !== id);
    return '已卸下';
  }
  if (moves.length >= LOADOUT_LIMIT) return '最多装备 4 个技能';
  mon.moves = [...moves, id];
  return '已装备';
}

export function cycleAspect(mon: Mon): string {
  const element = TYPE_META[getSpecies(mon.speciesId).type].element;
  const current = aspectOf(mon);
  let next: TypeId = getSpecies(mon.speciesId).type;
  if (element === 'pure') next = current === 'chunyang' ? 'chunyin' : 'chunyang';
  else {
    const yin = `yin${element}` as TypeId;
    const yang = `yang${element}` as TypeId;
    if (current === yang) next = yin;
    else if (current === yin && mon.level >= 16) next = 'chunyang';
    else if (current === 'chunyang') next = 'chunyin';
    else if (current === 'chunyin') next = yang;
    else next = yang;
  }
  mon.aspect = next;
  mon.moves = defaultLoadout(mon);
  return `属性变为${TYPE_META[next].label}`;
}

export function damageOf(attacker: Mon, defender: Mon, move: MoveDef, rng: () => number = Math.random, mods: StrikeMods = {}): DamageResult {
  if (move.power <= 0) return { damage: 0, mult: 1, stab: false, attackBonus: 0, defenseCut: 0, stopped: false };
  const mult = relate(move.type, aspectOf(defender)).mult;
  const stab = move.type === aspectOf(attacker);
  const stabMul = stab ? 1.2 : 1;
  const form = skillForm(move);
  const atkProfile = profile(attacker);
  const defProfile = profile(defender);
  const atk = form === 'magic' ? atkProfile.magAtk : atkProfile.physAtk * stageMul(attacker.stages.atk);
  const defStat = form === 'magic' ? defProfile.magDef : defProfile.physDef * stageMul(defender.stages.def);
  const pierce = move.effect === 'pierce' ? 0.7 : 1;
  const spread = move.effect === 'strike' && move.tier === 'basic' ? 0.08 : 0.05;
  const roll = 1 - spread + rng() * spread * 2;
  const attackBase = (move.power * atk / 60) * stabMul * mult * roll;
  const defenseFlat = defStat * pierce;
  const settled = settleDamage(attackBase, defenseFlat, {
    bonusFlat: (mods.bonusFlat ?? 0) + (move.bonusFlat ?? 0),
    bonusPercent: (mods.bonusPercent ?? 0) + (move.bonusPercent ?? 0),
    cutFlat: mods.cutFlat ?? 0,
    cutPercent: mods.cutPercent ?? 0,
  });
  return { damage: settled.damage, mult, stab, attackBonus: settled.attackBonus, defenseCut: settled.defenseCut, stopped: settled.stopped };
}

export function readDelay(text: string, fast = false): number {
  if (fast) return 45;
  const length = Array.from(text).length;
  return Math.min(4800, Math.max(1500, 800 + length * 70));
}

function monName(mon: Mon): string {
  return getSpecies(mon.speciesId).name;
}

function addShield(fighter: Fighter, ratio: number): number {
  const cap = Math.floor(maxHp(fighter.mon) * 0.35);
  const gain = Math.max(1, Math.floor(maxHp(fighter.mon) * ratio));
  const before = fighter.shield;
  fighter.shield = Math.min(cap, fighter.shield + gain);
  return fighter.shield - before;
}

function cleanse(fighter: Fighter): boolean {
  const mon = fighter.mon;
  const had = fighter.dotTurns > 0 || fighter.rootTurns > 0 || mon.stages.atk < 0 || mon.stages.def < 0 || mon.stages.spd < 0;
  fighter.dotTurns = 0;
  fighter.rootTurns = 0;
  if (mon.stages.atk < 0) mon.stages.atk = 0;
  if (mon.stages.def < 0) mon.stages.def = 0;
  if (mon.stages.spd < 0) mon.stages.spd = 0;
  return had;
}

export function opening(fighter: Fighter): { skip: boolean; logs: string[] } {
  for (const id of Object.keys(fighter.cd)) {
    fighter.cd[id] -= 1;
    if (fighter.cd[id] <= 0) delete fighter.cd[id];
  }
  if (fighter.rootTurns > 0) {
    fighter.rootTurns = 0;
    return { skip: true, logs: [`${monName(fighter.mon)}被定住，这回合无法行动`] };
  }
  return { skip: false, logs: [] };
}

export function resolveSkill(user: Fighter, foe: Fighter, move: MoveDef, rng: () => number = Math.random): string[] {
  const an = monName(user.mon);
  const dn = monName(foe.mon);
  const logs = [`${an}使用了${move.name}`];
  if ((user.cd[move.id] ?? 0) > 0) {
    logs.push(`${move.name}还在冷却`);
    return logs;
  }
  if ((user.mon.mp ?? 0) < move.cost) {
    logs.push(`${an}的法力不足`);
    return logs;
  }
  user.mon.mp = Math.max(0, (user.mon.mp ?? 0) - move.cost);
  if (move.cat === 'attack' || move.cat === 'status') {
    const hit = hitChance(profile(user.mon).core.spi, speedPoint(user.mon));
    if (rng() >= hit) {
      logs.push(`${an}没有命中`);
      if (move.cooldown > 0) user.cd[move.id] = move.cooldown;
      return logs;
    }
    if (rng() < evasionChance(speedPoint(foe.mon))) {
      logs.push(`${dn}闪避了攻击`);
      if (move.cooldown > 0) user.cd[move.id] = move.cooldown;
      return logs;
    }
  }
  if (move.cat === 'attack') {
    const result = damageOf(user.mon, foe.mon, move, rng, {
      bonusFlat: user.bonusFlat,
      bonusPercent: user.bonusPercent,
      cutFlat: foe.cutFlat,
      cutPercent: foe.cutPercent,
    });
    const absorbed = Math.min(foe.shield, result.damage);
    foe.shield -= absorbed;
    const hpLoss = result.damage - absorbed;
    foe.mon.hp = Math.max(0, foe.mon.hp - hpLoss);
    const hitLine = result.stopped ? `没能破开防御，造成 ${result.damage} 点伤害` : `造成 ${result.damage} 点伤害`;
    logs.push(absorbed ? `${hitLine}，护盾挡下 ${absorbed}` : hitLine);
    for (const note of relate(move.type, aspectOf(foe.mon)).notes) logs.push(note);
    if (move.effect === 'recoil' && user.mon.hp > 1) {
      const recoil = Math.max(1, Math.floor(result.damage * 0.1));
      user.mon.hp = Math.max(1, user.mon.hp - recoil);
      logs.push(`${an}受到反震 ${recoil}`);
    }
    if (move.effect === 'dotstrike') {
      foe.dotTurns = Math.max(foe.dotTurns, move.turns);
      foe.dotRatio = Math.max(foe.dotRatio, 0.06);
      logs.push(`${dn}被附上持续伤害`);
    }
  } else if (move.cat === 'guard') {
    const gained = addShield(user, move.ratio);
    logs.push(`${an}获得 ${gained} 点护盾`);
    if (move.effect === 'ward') {
      user.mon.stages.def = clamp(user.mon.stages.def + 1, -3, 3);
      user.cutFlat += move.cutFlat;
      user.cutPercent = clamp(user.cutPercent + move.cutPercent, 0, CUT_PERCENT_MAX);
      logs.push(`${an}的防御上升了`);
    }
    if (move.effect === 'cleanse') logs.push(cleanse(user) ? `${an}净化了减益` : `${an}没有需要净化的状态`);
  } else if (move.cat === 'heal') {
    if (move.effect === 'hot') {
      user.hotTurns = move.turns;
      user.hotRatio = Math.min(0.08, move.ratio);
      logs.push(`${an}会在 ${move.turns} 回合内持续恢复`);
    } else {
      const cap = Math.floor(maxHp(user.mon) * Math.min(0.4, move.ratio));
      const gain = Math.min(cap, maxHp(user.mon) - user.mon.hp);
      user.mon.hp += gain;
      logs.push(gain > 0 ? `${an}恢复了 ${gain} 点体力` : `${an}的体力已经满了`);
    }
    if (move.effect === 'cleanse') logs.push(cleanse(user) ? `${an}净化了减益` : `${an}没有需要净化的状态`);
  } else if (move.cat === 'aid') {
    const stat = move.stat || 'atk';
    user.mon.stages[stat] = clamp(user.mon.stages[stat] + 1, -3, 3);
    user.bonusFlat += move.bonusFlat;
    user.bonusPercent = clamp(user.bonusPercent + move.bonusPercent, 0, BONUS_PERCENT_MAX);
    logs.push(`${an}的${stat === 'spd' ? '速度' : stat === 'def' ? '防御' : '攻击'}上升了`);
    if (move.effect === 'cleanse') logs.push(cleanse(user) ? `${an}净化了减益` : `${an}没有需要净化的状态`);
  } else if (move.effect === 'root') {
    if (foe.rootTurns > 0) logs.push(`${dn}正在摆脱控制，没有被连续定住`);
    else if (rng() < move.chance) {
      foe.rootTurns = 1;
      logs.push(`${dn}被定住了`);
    } else logs.push(`${dn}挣开了控制`);
  } else {
    foe.dotTurns = Math.max(foe.dotTurns, move.turns || 2);
    foe.dotRatio = Math.max(foe.dotRatio, 0.06);
    const stat = move.stat || 'atk';
    foe.mon.stages[stat] = clamp(foe.mon.stages[stat] - 1, -3, 3);
    logs.push(`${dn}陷入持续伤害，${stat === 'spd' ? '速度' : stat === 'def' ? '防御' : '攻击'}下降了`);
  }
  if (foe.mon.hp <= 0) logs.push(`${dn}失去了战斗能力`);
  if (move.cooldown > 0) user.cd[move.id] = move.cooldown;
  return logs;
}

export function tickStatus(fighter: Fighter): string[] {
  const mon = fighter.mon;
  if (mon.hp <= 0) return [];
  const logs: string[] = [];
  const name = monName(mon);
  const mpMax = maxMp(mon);
  if (typeof mon.mp !== 'number') mon.mp = 0;
  if (mon.mp < mpMax) {
    const before = mon.mp ?? 0;
    mon.mp = Math.min(mpMax, before + Math.max(1, Math.floor(mpMax * 0.05)));
    if (mon.mp > before) logs.push(`${name}恢复了 ${mon.mp - before} 点法力`);
  }
  if (fighter.hotTurns > 0) {
    const cap = Math.floor(maxHp(mon) * 0.08);
    const gain = Math.min(cap, maxHp(mon) - mon.hp, Math.max(0, Math.floor(maxHp(mon) * fighter.hotRatio)));
    mon.hp += gain;
    fighter.hotTurns -= 1;
    if (gain > 0) logs.push(`${name}持续恢复了 ${gain} 点体力`);
  }
  if (fighter.dotTurns > 0) {
    const loss = Math.max(1, Math.min(Math.floor(maxHp(mon) * 0.08), Math.floor(maxHp(mon) * Math.max(0.04, fighter.dotRatio))));
    mon.hp = Math.max(0, mon.hp - loss);
    fighter.dotTurns -= 1;
    logs.push(`${name}受到持续伤害 ${loss}`);
    if (mon.hp <= 0) logs.push(`${name}失去了战斗能力`);
  }
  return logs;
}

export function performMove(attacker: Mon, defender: Mon, move: MoveDef, rng: () => number = Math.random): string[] {
  return resolveSkill(blankFighter(attacker), blankFighter(defender), move, rng);
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
  if (quest.completed) return ['最初的委托已经完成了。岛北的路口现在通往星雾岭。', '再往南仍是海，更远的地方还没开放。'];
  if (quest.caughtWild && quest.bossDefeated) {
    return ['你做到了。图鉴上有了新名字，北林的试炼也通过了。', '复命之后，岛北的路口会通往星雾岭。南边的海还过不去。'];
  }
  const missing: string[] = [];
  if (!quest.caughtWild) missing.push('还差一只愿意同行的野生芽灵');
  if (!quest.bossDefeated) missing.push('北林的岚川还在等你');
  return [`我在驿站看着你。${missing.join('，')}。`, '体力不够就在门前休息。星芽球若少于八个，我会帮你补上。'];
}

export function emptyDex(): Record<SpeciesId, { seen: boolean; caught: boolean }> {
  const dex = {} as Record<SpeciesId, { seen: boolean; caught: boolean }>;
  for (const species of SPECIES_LIST) dex[species.id] = { seen: false, caught: false };
  return dex;
}

export function commitEvolution(mon: Mon, play: PlayState): { ok: boolean; text: string } {
  const before = getSpecies(mon.speciesId);
  const status = evolutionStatus(mon, play, (id) => getSpecies(id).name);
  if (!status.ready || !status.to) return { ok: false, text: status.line };
  if (status.item && (play.items[status.item] ?? 0) < 1) return { ok: false, text: status.line };
  const oldHp = maxHp(mon);
  const oldMp = maxMp(mon);
  const hp = mon.hp;
  const mp = mon.mp ?? 0;
  const fainted = hp <= 0;
  if (status.item) play.items[status.item] -= 1;
  mon.speciesId = status.to;
  ensureLoadout(mon);
  const newHp = maxHp(mon);
  const newMp = maxMp(mon);
  if (fainted) mon.hp = 0;
  else mon.hp = clamp(oldHp > 0 ? Math.round((hp * newHp) / oldHp) : hp, 1, newHp);
  mon.mp = clamp(oldMp > 0 ? Math.round((mp * newMp) / oldMp) : mp, 0, newMp);
  play.dex[status.to] = { seen: true, caught: true };
  return { ok: true, text: `${before.name}进化成了${getSpecies(status.to).name}` };
}

export function ridgeObjectives(quest: RidgeQuest): Array<{ title: string; done: boolean }> {
  return [
    { title: '听雾守说明岭上的路', done: quest.introduced },
    { title: '在星雾岭收服一只芽灵', done: quest.caught },
    { title: '通过石岭的试炼', done: quest.trial },
    { title: '回岭南向雾守复命', done: quest.completed },
  ];
}

export function moveByIndex(mon: Mon, index: number): MoveDef {
  ensureLoadout(mon);
  const id = mon.moves?.[index] ?? mon.moves?.[0] ?? getSpecies(mon.speciesId).moves[0];
  return getMove(id);
}
