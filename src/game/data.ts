import type { MoveDef, MoveId, SpeciesDef, SpeciesId, TypeId } from './types';

export const TYPE_META: Record<TypeId, { label: string; color: string; soft: string }> = {
  grass: { label: '草', color: '#2f9a5a', soft: '#e5f7ea' },
  fire: { label: '火', color: '#ef6844', soft: '#ffe8e1' },
  water: { label: '水', color: '#2f95d0', soft: '#e3f4fc' },
  electric: { label: '电', color: '#d59a12', soft: '#fff4d4' },
  rock: { label: '岩', color: '#a57a45', soft: '#f6ecdf' },
  wind: { label: '风', color: '#3d98c9', soft: '#e7f5fc' },
};

const CHART: Record<TypeId, Partial<Record<TypeId, number>>> = {
  grass: { fire: 0.5, water: 2, rock: 2, wind: 0.5 },
  fire: { grass: 2, fire: 0.5, water: 0.5, rock: 0.5 },
  water: { grass: 0.5, fire: 2, water: 0.5, rock: 2 },
  electric: { grass: 0.5, water: 2, electric: 0.5, rock: 0.5, wind: 2 },
  rock: { fire: 2, electric: 2, wind: 0.5 },
  wind: { grass: 2, electric: 0.5, rock: 0.5 },
};

export function effectiveness(attack: TypeId, defense: TypeId): number {
  return CHART[attack][defense] ?? 1;
}

export const MOVES: Record<MoveId, MoveDef> = {
  yeren: { id: 'yeren', name: '叶刃', type: 'grass', power: 44, kind: 'damage', desc: '用叶边切开对方。' },
  guanghe: { id: 'guanghe', name: '光合', type: 'grass', power: 0, kind: 'heal', desc: '晒一会儿太阳，恢复体力。' },
  huohua: { id: 'huohua', name: '火花', type: 'fire', power: 42, kind: 'damage', desc: '吐出一小团暖和的火。' },
  weiyan: { id: 'weiyan', name: '尾焰', type: 'fire', power: 60, kind: 'damage', desc: '甩动发亮的尾巴撞击。' },
  shuidan: { id: 'shuidan', name: '水弹', type: 'water', power: 42, kind: 'damage', desc: '把露珠弹向对方。' },
  paomo: { id: 'paomo', name: '泡沫罩', type: 'water', power: 0, kind: 'buff', desc: '用泡沫裹住自己，防御上升。' },
  jingdian: { id: 'jingdian', name: '静电', type: 'electric', power: 40, kind: 'damage', desc: '毛尖迸出细小电光。' },
  dianchong: { id: 'dianchong', name: '电冲', type: 'electric', power: 58, kind: 'damage', desc: '带着电光冲过去。' },
  luoshi: { id: 'luoshi', name: '落石', type: 'rock', power: 48, kind: 'damage', desc: '晃下身上的小石子。' },
  suoke: { id: 'suoke', name: '缩壳', type: 'rock', power: 0, kind: 'buff', desc: '缩进壳里，防御上升。' },
  jifeng: { id: 'jifeng', name: '疾风', type: 'wind', power: 44, kind: 'damage', desc: '扇起一阵干脆的风。' },
  lingyin: { id: 'lingyin', name: '铃音', type: 'wind', power: 30, kind: 'debuff', desc: '清铃作响，并降低对方攻击。' },
  tengda: { id: 'tengda', name: '藤打', type: 'grass', power: 46, kind: 'damage', desc: '用软藤拍打。' },
  mengbao: { id: 'mengbao', name: '猛抱', type: 'grass', power: 64, kind: 'damage', desc: '张开手臂用力一抱。' },
  langda: { id: 'langda', name: '浪打', type: 'water', power: 46, kind: 'damage', desc: '拍出一朵小浪。' },
  chaopai: { id: 'chaopai', name: '潮拍', type: 'water', power: 62, kind: 'damage', desc: '把潮水拍到对方面前。' },
};

export function getMove(id: MoveId): MoveDef {
  return MOVES[id];
}

export const SPECIES_LIST: SpeciesDef[] = [
  {
    id: 'lujiao',
    name: '叶角鹿',
    type: 'grass',
    catchRate: 170,
    baseExp: 58,
    bases: { hp: 50, atk: 52, def: 46, spd: 48 },
    moves: ['yeren', 'guanghe'],
    blurb: '角上顶着嫩叶，走路很轻。',
    dex: '星芽岛草坡上常见的伙伴。角尖会跟着季节抽出新叶，愿意把光合分给受伤的同伴。',
  },
  {
    id: 'yanwei',
    name: '焰尾狐',
    type: 'fire',
    catchRate: 155,
    baseExp: 60,
    bases: { hp: 44, atk: 58, def: 40, spd: 64 },
    moves: ['huohua', 'weiyan'],
    blurb: '尾巴像一小簇营火，靠近是暖的。',
    dex: '黄昏时尾巴最亮。它不喜欢把火弄大，只在高兴或比试时甩出一尾火焰。',
  },
  {
    id: 'luzhu',
    name: '露珠蛙',
    type: 'water',
    catchRate: 170,
    baseExp: 58,
    bases: { hp: 52, atk: 48, def: 52, spd: 44 },
    moves: ['shuidan', 'paomo'],
    blurb: '头顶始终沾着一颗不会掉的露珠。',
    dex: '住在星湖浅滩。露珠会在它紧张时晃动，战斗里则变成水弹。',
  },
  {
    id: 'dianrong',
    name: '电绒鼠',
    type: 'electric',
    catchRate: 145,
    baseExp: 62,
    bases: { hp: 40, atk: 54, def: 36, spd: 72 },
    moves: ['jingdian', 'dianchong'],
    blurb: '毛燥燥的，跑起来会噼啪响。',
    dex: '南边草坡最活泼的芽灵。脸颊存着细小的电，下雨天会把自己团成球。',
  },
  {
    id: 'yanke',
    name: '岩壳龟',
    type: 'rock',
    catchRate: 120,
    baseExp: 64,
    bases: { hp: 64, atk: 46, def: 72, spd: 24 },
    moves: ['luoshi', 'suoke'],
    blurb: '壳上嵌着温热的小石子。',
    dex: '北林石径上慢慢走。壳很硬，缩进去以后几乎不想出来。',
  },
  {
    id: 'fengling',
    name: '风铃鸟',
    type: 'wind',
    catchRate: 140,
    baseExp: 60,
    bases: { hp: 42, atk: 52, def: 38, spd: 70 },
    moves: ['jifeng', 'lingyin'],
    blurb: '尾羽像一只小铃，落地会轻响。',
    dex: '喜欢停在苔木林边缘。铃音并不刺耳，但会让对手晃神。',
  },
  {
    id: 'taibei',
    name: '苔背熊',
    type: 'grass',
    catchRate: 110,
    baseExp: 72,
    bases: { hp: 70, atk: 60, def: 54, spd: 32 },
    moves: ['tengda', 'mengbao'],
    blurb: '背上长着一块软软的青苔。',
    dex: '苔木林的大体型芽灵。看着沉，拥抱起来却很小心，青苔里偶尔冒出小菇。',
  },
  {
    id: 'xiwen',
    name: '汐纹獭',
    type: 'water',
    catchRate: 130,
    baseExp: 66,
    bases: { hp: 54, atk: 56, def: 48, spd: 52 },
    moves: ['langda', 'chaopai'],
    blurb: '尾巴上有一圈潮水一样的纹。',
    dex: '沿着星湖岸边滑行。纹路会在涨潮的日子变得更蓝。',
  },
];

const SPECIES_MAP: Record<SpeciesId, SpeciesDef> = Object.fromEntries(
  SPECIES_LIST.map((species) => [species.id, species]),
) as Record<SpeciesId, SpeciesDef>;

export function getSpecies(id: SpeciesId): SpeciesDef {
  return SPECIES_MAP[id];
}

export const STARTERS: SpeciesId[] = ['lujiao', 'yanwei', 'luzhu'];

export const NAME_PRESETS = ['小芽', '星旅', '阿露'] as const;

export function introScript(name: string): { speaker: string; text: string }[] {
  return [
    { speaker: '芽婆婆', text: `${name}，你来啦。星芽岛上的芽灵会自己在草地、林间和湖边散步。` },
    { speaker: '芽婆婆', text: '走近它们就能遇见。星芽球可以邀请愿意同行的芽灵，也可以先友好地比试一场。' },
    {
      speaker: '芽婆婆',
      text: '电脑用 WASD 或方向键移动，按 E 交谈，Esc 打开菜单。手机用左下角摇杆或方向钮，右下角是交谈和菜单。',
    },
    { speaker: '芽婆婆', text: '先去岛上收服至少一只野生芽灵，再往北走进试炼林，和试炼官岚川比试。做完了回来告诉我。' },
    { speaker: '芽婆婆', text: '受伤了就回星芽驿。球如果见底，我也会帮你补到能继续出发。' },
  ];
}

export function practiceScript(done: boolean): { speaker: string; text: string }[] {
  if (done) {
    return [
      { speaker: '青禾', text: '你已经和我练过啦。湖边有汐纹獭，苔木林里有苔背熊，北面的岩壳龟很能挨打。' },
      { speaker: '青禾', text: '属性不用背整张表：草克水，水克火，火克草。电擅长对付水和风，岩则又硬又慢。' },
    ];
  }
  return [
    { speaker: '青禾', text: '我是向导青禾。第一次对战可以找我，点到为止，输了也能回驿站休息。' },
    { speaker: '青禾', text: '记住几个克制就够出发：草克水，水克火，火克草。电打水和风很疼，岩壳龟则特别耐打。' },
  ];
}

export function bossScript(done: boolean): { speaker: string; text: string }[] {
  if (done) {
    return [
      { speaker: '岚川', text: '试炼已经通过了。想再练一次也可以，这次不再发放补给。' },
      { speaker: '岚川', text: '芽婆婆还在驿站等你复命。' },
    ];
  }
  return [
    { speaker: '岚川', text: '我是试炼官岚川。想确认你们是不是真正的伙伴，就在这片北林里让我看看。' },
    { speaker: '岚川', text: '准备好再开始。如果撑不住，回星芽驿治好再来，试炼不会因此关闭。' },
  ];
}

export const SIGN_TEXT: Record<string, { title: string; text: string }> = {
  shrine: { title: '星芽驿', text: '治疗与补给都在这里。站到门前按交谈，就能让伙伴休息。' },
  north: { title: '指路牌', text: '往北是试炼林，岚川在林间空地等着。' },
  west: { title: '指路牌', text: '往西是苔木林，路比较窄，苔背熊喜欢待在空地里。' },
  east: { title: '指路牌', text: '往东是星湖。水边走得近一些，就能遇见露珠蛙和汐纹獭。' },
};
