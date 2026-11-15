import { TYPE_META } from './elements';
import type { AttackKind, MoveCat, MoveDef, MoveEffect, MoveTier, TypeId } from './types';
import { CAT_LABEL, TIER_LABEL } from './types';

const TIERS: MoveTier[] = ['basic', 'mid', 'high', 'divine'];
const CATS: MoveCat[] = ['attack', 'guard', 'heal', 'aid', 'status'];

const NAMES: Record<TypeId, Record<MoveCat, string[]>> = {
  yinjin: {
    attack: ['冷刃', '霜锥', '夜锋', '沉钟', '玄刺', '暮戟', '阴芒', '寂斩'],
    guard: ['铁幕', '冷壁', '沉盾', '霜甲', '玄障', '暮铠', '阴垣', '寂壁'],
    heal: ['冷露', '霜息', '回钟', '沉愈', '玄沐', '暮温', '阴润', '寂疗'],
    aid: ['砺锋', '凝钟', '提气', '沉步', '玄助', '暮催', '阴振', '寂跃'],
    status: ['冻痕', '钟鸣', '冷缚', '沉滞', '玄印', '暮锁', '阴禁', '寂定'],
  },
  yangjin: {
    attack: ['金芒', '锐羽', '昼刃', '亮戟', '鸣刺', '耀锥', '阳锋', '金斩'],
    guard: ['金壁', '亮甲', '昼盾', '鸣障', '耀铠', '阳垣', '金幕', '锐壁'],
    heal: ['金露', '亮息', '昼愈', '鸣沐', '耀润', '阳暖', '晖疗', '锐愈'],
    aid: ['开锋', '振鸣', '昼步', '耀势', '阳催', '晖跃', '锐助', '金振'],
    status: ['金痕', '鸣印', '昼缚', '亮滞', '耀锁', '阳禁', '晖定', '锐禁'],
  },
  yinmu: {
    attack: ['苔刺', '暗藤', '夜叶', '沉枝', '荫打', '暮根', '阴蔓', '寂缠'],
    guard: ['苔壁', '藤障', '夜甲', '沉幕', '荫盾', '苔铠', '阴垣木', '寂篱'],
    heal: ['苔露', '藤息', '夜愈', '沉沐', '荫润', '暮疗', '阴芽', '寂生'],
    aid: ['抽枝', '催藤', '夜步', '沉势', '荫助', '暮跃', '阴振木', '寂长'],
    status: ['苔痕', '藤缚', '夜印', '沉滞木', '荫锁', '暮禁', '阴困', '寂缠印'],
  },
  yangmu: {
    attack: ['叶刃', '新枝', '晴打', '芽击', '青刺', '朝藤', '阳叶', '晖缠'],
    guard: ['叶障', '青壁', '芽甲', '晴盾', '朝幕', '阳篱', '晖铠', '新垣'],
    heal: ['光合', '芽息', '朝露', '青愈', '晴沐', '阳生', '青疗', '新润'],
    aid: ['抽芽', '催青', '朝步', '晴势', '阳跃木', '晖助', '新振', '叶催'],
    status: ['叶痕', '青印', '芽缚', '晴滞', '朝锁', '阳困', '晖禁木', '新缠'],
  },
  yinshui: {
    attack: ['露弹', '夜潮', '沉波', '暗涟', '暮涌', '阴沫', '寂澜', '冷潮'],
    guard: ['露罩', '夜壁', '沉幕水', '暗甲', '暮盾', '阴垣水', '寂障', '露壁'],
    heal: ['露息', '夜愈水', '沉润', '暗沐', '暮疗水', '阴露', '寂回', '冷愈'],
    aid: ['催潮', '夜步水', '沉势水', '暗跃', '暮助', '阴振水', '寂流', '冷催'],
    status: ['露痕', '夜缚水', '沉印', '暗滞', '暮锁水', '阴禁水', '寂定水', '冷困'],
  },
  yangshui: {
    attack: ['晴澜', '朝浪', '明波', '汐打', '亮潮', '阳涌', '晖沫', '新涟'],
    guard: ['晴罩', '朝壁', '明甲', '汐盾', '亮幕', '阳垣水', '晖障', '新壁'],
    heal: ['晴露', '朝息', '明愈', '汐沐', '亮润', '阳疗水', '汐回', '新愈'],
    aid: ['催汐', '朝趋', '明势', '亮跃', '阳助水', '晖流', '新振水', '晴催'],
    status: ['晴痕', '朝缚', '明印', '汐滞', '亮锁', '阳困水', '晖禁', '新定'],
  },
  yinhuo: {
    attack: ['幽焰', '夜烬', '暗灼', '沉火星', '暮燎', '阴烛', '寂炎', '冷焰'],
    guard: ['烬幕', '夜壁火', '暗甲火', '沉盾火', '暮障', '阴垣火', '寂铠', '冷壁火'],
    heal: ['余烬息', '夜暖', '暗愈', '沉沐火', '暮疗火', '阴温', '寂回火', '冷暖'],
    aid: ['拨烬', '夜步火', '暗势', '沉跃', '暮催火', '阴振火', '寂燃', '冷催火'],
    status: ['灼痕阴', '夜缚火', '暗印', '沉滞火', '暮锁火', '阴禁火', '寂定火', '冷灼'],
  },
  yanghuo: {
    attack: ['炎芽', '赤芒', '焰矢', '燎羽', '日灼', '赤轮', '阳炎', '晖啸'],
    guard: ['炎障', '赤壁', '焰幕', '暖甲', '日盾', '赤垣', '阳铠', '晖壁'],
    heal: ['余温', '暖息', '回焰', '煦愈', '日沐', '赤露', '阳疗', '晖燃'],
    aid: ['催焰', '振锋', '日步', '赤势', '阳跃火', '晖助火', '炎催', '暖振'],
    status: ['灼痕', '焦印', '炎缚', '日滞', '赤锁', '阳困火', '晖禁火', '焰定'],
  },
  yintu: {
    attack: ['沉石', '夜壤', '暗击', '暮砸', '阴砾', '寂坠', '冷岩', '苔石'],
    guard: ['岩壳', '沉壁', '夜甲土', '暗盾', '暮垣', '阴障土', '寂铠土', '冷壳'],
    heal: ['壤息', '夜愈土', '沉润土', '暗沐土', '暮疗土', '阴露土', '寂回土', '冷愈土'],
    aid: ['夯土', '夜步土', '沉势土', '暗跃土', '暮助土', '阴振土', '寂稳', '冷催土'],
    status: ['尘痕', '夜缚土', '沉印土', '暗滞土', '暮锁土', '阴困土', '寂定土', '冷陷'],
  },
  yangtu: {
    attack: ['晴石', '朝壤', '明砸', '暖砾', '阳坠', '晖岩', '新夯', '日垒'],
    guard: ['晴壁土', '朝甲', '明盾土', '暖垣', '阳障土', '晖壳', '新壁土', '日铠'],
    heal: ['晴息土', '朝愈土', '明润', '暖沐', '阳疗土', '晖回土', '新愈土', '日露'],
    aid: ['催壤', '朝步土', '明势土', '暖跃', '阳助土', '晖稳', '新振土', '日催'],
    status: ['晴痕土', '朝缚土', '明印土', '暖滞', '阳锁土', '晖困', '新定土', '日陷'],
  },
  chunyin: {
    attack: ['玄息斩', '夜无', '沉寂打', '幽压', '阴蚀', '寂灭击', '冷空', '冥刺'],
    guard: ['玄幕', '夜障阴', '沉壁阴', '幽甲', '阴罩', '寂垣', '冷幕', '冥盾'],
    heal: ['玄回', '夜润阴', '沉息阴', '幽愈', '阴沐', '寂疗阴', '冷回', '冥露'],
    aid: ['玄催', '夜步阴', '沉势阴', '幽跃', '玄振', '寂助', '冷势', '冥跃'],
    status: ['玄痕', '夜缚阴', '沉印阴', '幽滞', '阴锁', '寂定阴', '冷禁', '冥困'],
  },
  chunyang: {
    attack: ['晖斩', '昼芒', '明空击', '耀压', '阳蚀', '晴寂打', '暖空', '日刺'],
    guard: ['晖幕', '昼障', '明壁阳', '耀甲', '阳罩', '晴垣', '暖幕', '日盾阳'],
    heal: ['晖回', '昼润', '明息', '耀愈', '阳沐阳', '晴疗', '暖回', '日露阳'],
    aid: ['晖催', '昼趋', '明势阳', '耀跃', '阳振阳', '晴助', '暖势', '日跃'],
    status: ['晖痕', '昼困', '明印阳', '耀滞', '阳锁阳', '晴困', '暖禁', '日定'],
  },
};

const EFFECTS: Record<MoveCat, MoveEffect[]> = {
  attack: ['strike', 'pierce', 'recoil', 'dotstrike', 'strike', 'pierce', 'recoil', 'dotstrike'],
  guard: ['shield', 'ward', 'cleanse', 'shield', 'ward', 'cleanse', 'shield', 'ward'],
  heal: ['mend', 'cleanse', 'hot', 'mend', 'hot', 'cleanse', 'mend', 'hot'],
  aid: ['buff', 'buff', 'buff', 'cleanse', 'buff', 'buff', 'buff', 'cleanse'],
  status: ['blight', 'blight', 'blight', 'root', 'blight', 'root', 'blight', 'root'],
};

const STATS: Array<'atk' | 'def' | 'spd'> = ['atk', 'spd', 'def', 'atk', 'spd', 'def', 'atk', 'spd'];

function pct(ratio: number): number {
  return Math.round(ratio * 100);
}

function skillCost(tier: MoveTier, cat: MoveCat, effect: MoveEffect): number {
  if (cat === 'attack' && tier === 'basic' && effect === 'strike') return 0;
  if (tier === 'mid') return 8;
  if (tier === 'high') return 12;
  if (tier === 'divine') return 18;
  return 4;
}

function attackKind(cat: MoveCat, effect: MoveEffect): AttackKind | '' {
  if (cat !== 'attack') return '';
  return effect === 'pierce' || effect === 'dotstrike' ? 'magic' : 'physical';
}

function build(type: TypeId, cat: MoveCat, tierIndex: number, slot: number, name: string): MoveDef {
  const tier = TIERS[tierIndex];
  const index = tierIndex * 2 + slot;
  const effect = EFFECTS[cat][index];
  const power = [46, 52, 62, 68, 78, 84, 94, 100][index];
  const ratio = [0.14, 0.16, 0.2, 0.22, 0.26, 0.28, 0.32, 0.36][index];
  const turns = [2, 2, 2, 1, 3, 1, 3, 1][index];
  const chance = [0.7, 0.75, 0.8, 0.55, 0.85, 0.6, 0.9, 0.65][index];
  const cooldown = tier === 'divine' ? 3 : tier === 'high' && (cat === 'heal' || cat === 'status') ? 2 : 0;
  const kind = attackKind(cat, effect);
  const cost = skillCost(tier, cat, effect);
  const stat = cat === 'aid' ? STATS[index] : cat === 'guard' && effect === 'ward' ? 'def' : cat === 'status' && effect === 'blight' ? (['atk', 'def', 'spd', 'atk', 'atk', 'atk', 'def', 'atk'] as const)[index] : '';
  const cleanse = effect === 'cleanse';
  const move: MoveDef = {
    id: `${type}-${tier}-${cat}-${slot}`,
    name,
    type,
    tier,
    cat,
    effect,
    target: cat === 'attack' || cat === 'status' ? 'foe' : 'self',
    power: cat === 'attack' ? power : 0,
    ratio: cat === 'attack' ? (effect === 'dotstrike' ? 0.06 : 0) : ratio,
    chance: cat === 'status' && effect === 'root' ? chance : 1,
    turns: effect === 'dotstrike' || effect === 'hot' || effect === 'blight' ? turns : effect === 'root' ? 1 : 0,
    cooldown,
    cost,
    kind,
    stat,
    cleanse,
    desc: '',
  };
  move.desc = describe(move);
  return move;
}

function describe(move: MoveDef): string {
  const tier = TIER_LABEL[move.tier];
  const cat = CAT_LABEL[move.cat];
  const cool = move.cooldown ? `使用后冷却 ${move.cooldown} 回合。` : '';
  const mana = move.cost > 0 ? `消耗 ${move.cost} 点法力。` : '不消耗法力。';
  const form = move.kind === 'magic' ? '魔法' : '物理';
  if (move.effect === 'strike') return `${tier}${cat}。${form}伤害，威力 ${move.power}。${mana}${cool}`;
  if (move.effect === 'pierce') return `${tier}${cat}。${form}伤害，忽视一部分防御，威力 ${move.power}。${mana}${cool}`;
  if (move.effect === 'recoil') return `${tier}${cat}。${form}伤害，威力 ${move.power}，自己受到少量反震，但不会因此倒下。${mana}${cool}`;
  if (move.effect === 'dotstrike') return `${tier}${cat}。${form}伤害，威力 ${move.power}，并在 ${move.turns} 回合内附加持续伤害。${mana}${cool}`;
  if (move.effect === 'shield') return `${tier}${cat}。获得最大体力 ${pct(move.ratio)}% 的护盾，护盾总量不超过 35%。${mana}${cool}`;
  if (move.effect === 'ward') return `${tier}${cat}。获得最大体力 ${pct(move.ratio)}% 的护盾，并让防御上升。${mana}${cool}`;
  if (move.effect === 'mend') return `${tier}${cat}。恢复最大体力的 ${pct(Math.min(0.4, move.ratio))}%，单次不超过 40%。${mana}${cool}`;
  if (move.effect === 'hot') return `${tier}${cat}。在 ${move.turns} 回合内每回合恢复少量体力，每跳不超过 8%。${mana}${cool}`;
  if (move.effect === 'cleanse' && move.cat === 'heal') return `${tier}${cat}。恢复最大体力的 ${pct(Math.min(0.4, move.ratio))}% ，并净化一个减益。${mana}${cool}`;
  if (move.effect === 'cleanse') return `${tier}${cat}。净化一个减益，并提升${move.stat === 'spd' ? '速度' : move.stat === 'def' ? '防御' : '攻击'}。${mana}${cool}`;
  if (move.effect === 'buff') return `${tier}${cat}。提升自己的${move.stat === 'spd' ? '速度' : move.stat === 'def' ? '防御' : '攻击'}一阶。${mana}${cool}`;
  if (move.effect === 'blight') return `${tier}${cat}。在 ${move.turns} 回合内造成持续伤害，并降低对方${move.stat === 'spd' ? '速度' : move.stat === 'def' ? '防御' : '攻击'}。${mana}${cool}`;
  return `${tier}${cat}。有 ${pct(move.chance)}% 概率让对方下回合无法行动，不能连续定住。${mana}${cool}`;
}

function compile(): MoveDef[] {
  const list: MoveDef[] = [];
  for (const type of Object.keys(NAMES) as TypeId[]) {
    for (const cat of CATS) {
      NAMES[type][cat].forEach((name, index) => {
        list.push(build(type, cat, Math.floor(index / 2), index % 2, name));
      });
    }
  }
  return list;
}

export const SKILL_LIST: MoveDef[] = compile();
export const SKILLS: Record<string, MoveDef> = Object.fromEntries(SKILL_LIST.map((move) => [move.id, move]));

const LEGACY: Record<string, string> = {
  yeren: 'yangmu-basic-attack-0',
  guanghe: 'yangmu-basic-heal-0',
  huohua: 'yanghuo-basic-attack-0',
  weiyan: 'yanghuo-basic-attack-1',
  shuidan: 'yinshui-basic-attack-0',
  paomo: 'yinshui-basic-guard-0',
  jingdian: 'yangjin-basic-attack-0',
  dianchong: 'yangjin-basic-attack-1',
  luoshi: 'yintu-basic-attack-0',
  suoke: 'yintu-basic-guard-0',
  jifeng: 'yinjin-basic-attack-0',
  lingyin: 'yinjin-basic-status-0',
  tengda: 'yinmu-basic-attack-0',
  mengbao: 'yinmu-basic-attack-1',
  langda: 'yangshui-basic-attack-0',
  chaopai: 'yangshui-basic-attack-1',
};

export function basicStrike(type: TypeId): MoveDef {
  return {
    id: 'basic-strike',
    name: '普通攻击',
    type,
    tier: 'basic',
    cat: 'attack',
    effect: 'strike',
    target: 'foe',
    power: 32,
    ratio: 0,
    chance: 1,
    turns: 0,
    cooldown: 0,
    cost: 0,
    kind: 'physical',
    stat: '',
    cleanse: false,
    desc: '不消耗法力的物理攻击。法力不够时也能用。',
  };
}

export function getMove(id: string): MoveDef {
  if (id === 'basic-strike') return basicStrike('yangmu');
  return SKILLS[LEGACY[id] ?? id] ?? SKILLS['yangmu-basic-attack-0'];
}

export function skillsOf(type: TypeId): MoveDef[] {
  return SKILL_LIST.filter((move) => move.type === type);
}

export function skillStats(): { total: number; types: number; perType: Record<string, number> } {
  const perType: Record<string, number> = {};
  for (const type of Object.keys(TYPE_META) as TypeId[]) perType[type] = skillsOf(type).length;
  return { total: SKILL_LIST.length, types: Object.keys(perType).length, perType };
}
