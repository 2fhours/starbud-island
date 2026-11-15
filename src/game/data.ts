import { effectiveness, TYPE_META } from './elements';
import { CATCH_FLOOR, CATCH_STEP, EXP_STEP, EVOLUTION_LINES, raceAtStage } from './evolution';
import { getMove } from './skills';
import type { SpeciesDef, SpeciesId, TypeId } from './types';

export { effectiveness, getMove, TYPE_META };

const SPECIES_LIST_RAW: SpeciesDef[] = [
  {
    id: 'lujiao',
    name: '叶角鹿',
    type: 'yangmu',
    catchRate: 170,
    baseExp: 58,
    race: { con: 58, str: 54, int: 56, spi: 56, spd: 52 },
    moves: ['yangmu-basic-attack-0', 'yangmu-basic-heal-0'],
    blurb: '角上顶着嫩叶，走路很轻。',
    dex: '星芽岛草坡上常见的伙伴。角尖会跟着季节抽出新叶，愿意把光合分给受伤的同伴。',
  },
  {
    id: 'yanwei',
    name: '焰尾狐',
    type: 'yanghuo',
    catchRate: 155,
    baseExp: 60,
    race: { con: 46, str: 66, int: 48, spi: 50, spd: 72 },
    moves: ['yanghuo-basic-attack-0', 'yanghuo-basic-heal-0'],
    blurb: '尾巴像一小簇营火，靠近是暖的。',
    dex: '黄昏时尾巴最亮。它不喜欢把火弄大，只在高兴或比试时甩出一尾火焰。',
  },
  {
    id: 'luzhu',
    name: '露珠蛙',
    type: 'yinshui',
    catchRate: 170,
    baseExp: 58,
    race: { con: 56, str: 44, int: 68, spi: 64, spd: 48 },
    moves: ['yinshui-basic-attack-0', 'yinshui-basic-heal-0'],
    blurb: '头顶始终沾着一颗不会掉的露珠。',
    dex: '住在星湖浅滩。露珠会在它紧张时晃动，战斗里则变成水弹。',
  },
  {
    id: 'dianrong',
    name: '电绒鼠',
    type: 'yangjin',
    catchRate: 145,
    baseExp: 62,
    race: { con: 42, str: 54, int: 52, spi: 58, spd: 78 },
    moves: ['yangjin-basic-attack-0', 'yangjin-basic-heal-0'],
    blurb: '毛燥燥的，跑起来会噼啪响。',
    dex: '南边草坡最活泼的芽灵。脸颊的电光更接近阳金，下雨天会把自己团成球。',
  },
  {
    id: 'yanke',
    name: '岩壳龟',
    type: 'yintu',
    catchRate: 120,
    baseExp: 64,
    race: { con: 72, str: 58, int: 48, spi: 54, spd: 42 },
    moves: ['yintu-basic-attack-0', 'yintu-basic-guard-0'],
    blurb: '壳上嵌着温热的小石子。',
    dex: '北林石径上慢慢走。壳很硬，缩进去以后几乎不想出来。',
  },
  {
    id: 'fengling',
    name: '风铃鸟',
    type: 'yinjin',
    catchRate: 140,
    baseExp: 60,
    race: { con: 46, str: 50, int: 54, spi: 62, spd: 70 },
    moves: ['yinjin-basic-attack-0', 'yinjin-basic-status-0'],
    blurb: '尾羽像一只小铃，落地会轻响。',
    dex: '喜欢停在苔木林边缘。铃音属于阴金，清越，但会让对手晃神。',
  },
  {
    id: 'taibei',
    name: '苔背熊',
    type: 'yinmu',
    catchRate: 110,
    baseExp: 72,
    race: { con: 74, str: 66, int: 46, spi: 52, spd: 36 },
    moves: ['yinmu-basic-attack-0', 'yinmu-basic-heal-0'],
    blurb: '背上长着一块软软的青苔。',
    dex: '苔木林的大体型芽灵。看着沉，拥抱起来却很小心。',
  },
  {
    id: 'xiwen',
    name: '汐纹獭',
    type: 'yangshui',
    catchRate: 130,
    baseExp: 66,
    race: { con: 54, str: 52, int: 66, spi: 60, spd: 54 },
    moves: ['yangshui-basic-attack-0', 'yangshui-basic-heal-0'],
    blurb: '尾巴上有一圈潮水一样的纹。',
    dex: '沿着星湖岸边滑行。纹路会在涨潮的日子变得更亮。',
  },
  {
    id: 'wudeng',
    name: '雾灯蛾',
    type: 'yinhuo',
    catchRate: 140,
    baseExp: 64,
    race: { con: 44, str: 48, int: 62, spi: 66, spd: 64 },
    moves: ['yinhuo-basic-attack-0', 'yinhuo-basic-heal-0'],
    blurb: '翅膀像一盏雾里的小灯。',
    dex: '星雾岭黄昏才亮起。翅膀外层是冷雾，里面藏着一点阴火，靠近是暖的。',
  },
  {
    id: 'yunyang',
    name: '云岩羊',
    type: 'yangtu',
    catchRate: 125,
    baseExp: 68,
    race: { con: 70, str: 64, int: 46, spi: 52, spd: 44 },
    moves: ['yangtu-basic-attack-0', 'yangtu-basic-guard-0'],
    blurb: '毛团得像一小朵云。',
    dex: '走在石阶上的芽灵。角上沾着浅浅的地衣，步伐很稳，不爱乱跑。',
  },
  {
    id: 'luoxing',
    name: '落星鼯',
    type: 'yinmu',
    catchRate: 150,
    baseExp: 62,
    race: { con: 46, str: 50, int: 58, spi: 56, spd: 74 },
    moves: ['yinmu-basic-attack-0', 'yinmu-basic-heal-0'],
    blurb: '尾巴上有一颗浅色星斑。',
    dex: '在松枝间滑行。膜翼收起来像一件绿斗篷，星斑只在停下来时看得清。',
  },
  {
    id: 'hanquan',
    name: '寒泉鲵',
    type: 'yangshui',
    catchRate: 135,
    baseExp: 66,
    race: { con: 56, str: 48, int: 68, spi: 62, spd: 50 },
    moves: ['yangshui-basic-attack-0', 'yangshui-basic-heal-0'],
    blurb: '尾巴上有一道泉纹。',
    dex: '住在岭上冷泉边。腮羽像两根软绸，喷出的水是凉的。',
  },
];

const EVO_COPY: Partial<Record<SpeciesId, { name: string; blurb: string; dex: string }>> = {
  cuizhi: { name: '翠枝鹿', blurb: '尾尖多了一小簇叶子。', dex: '叶角鹿长大后的样子。叶片更密，走在草坡上时尾巴会轻轻摇。' },
  senmian: { name: '森冕鹿', blurb: '角枝连成一圈小叶冠。', dex: '翠枝鹿的最终形态。叶冠上点着细小的白花蕾，仍然温顺。' },
  huowen: { name: '火纹狐', blurb: '尾巴是内黄外橙的两层火焰。', dex: '焰尾狐长高之后的样子。腿更长，颈上还没有焰鬣。' },
  chiyan: { name: '炽焰狐', blurb: '颈到肩披着一圈柔和焰鬣。', dex: '火纹狐的最终形态。焰鬣是它和前一形态的差别，笑起来仍然温和。' },
  linlu: { name: '霖露蛙', blurb: '头顶顶着三颗露珠。', dex: '露珠蛙长大后的样子。头上是一大两小的露珠，和基础形态的单珠不同。' },
  jinglu: { name: '晶露蛙', blurb: '肩背上结着一簇晶露。', dex: '霖露蛙的最终形态。身体更壮，蹼足更宽，头上仍是三珠小冠。' },
  shanrong: { name: '闪绒鼠', blurb: '头顶的闪电撮又高了一截。', dex: '电绒鼠长大后的样子。尾巴略长，带着细细的电光锯齿。' },
  tingrong: { name: '霆绒鼠', blurb: '头顶是一顶三叉闪电冠。', dex: '闪绒鼠的最终形态。仍是圆绒鼠，闪电冠在正背都能看见。' },
  panjia: { name: '磐甲龟', blurb: '壳更厚，缝里长着小蕨芽。', dex: '岩壳龟的最终形态。甲壳分层，四肢更粗，脸上还是笑的。' },
  lingyu: { name: '铃羽鸟', blurb: '尾上挂着一大一小两枚金铃。', dex: '风铃鸟长大后的样子。粉冠更丰，两枚金铃正背都能数到。' },
  yaoling: { name: '瑶铃鸟', blurb: '粉冠更高，金铃成串。', dex: '铃羽鸟的最终形态。仍是小鸟，金铃是两枚成串，不是凤凰。' },
  senbei: { name: '森背熊', blurb: '背上的青苔开出了小白花。', dex: '苔背熊的最终形态。更大，仍然圆滚站着，背上有小叶和小花。' },
  chaowen: { name: '潮纹獭', blurb: '身侧的蓝纹多了好几道。', dex: '汐纹獭长大后的样子。尾巴更长，蓝色的范围也更大。' },
  canglan: { name: '沧澜獭', blurb: '尾巴像一道带碎光的浪。', dex: '潮纹獭的最终形态。浪形尾巴上有水光，不是海怪。' },
  wuhui: { name: '雾辉蛾', blurb: '四翅伸长，里面亮着小灯笼。', dex: '雾灯蛾长大后的样子。翅内的暖黄灯笼正背都能看见。' },
  landeng: { name: '岚灯蛾', blurb: '层叠的灯纱翅又宽又透。', dex: '雾辉蛾的最终形态。翅上不再嵌灯笼，腹前的灯芯正背都亮着。' },
  lanjiao: { name: '岚角羊', blurb: '弯角更长，角上沾着细石。', dex: '云岩羊的最终形态。卷毛更厚，四肢略高，仍然是山羊。' },
  xingyi: { name: '星翼鼯', blurb: '翼膜半垂，尾巴又长又软。', dex: '落星鼯长大后的样子。落地站着，尾上仍是一颗星。' },
  liuxing: { name: '流星鼯', blurb: '膜翼腹面画着星图。', dex: '星翼鼯的最终形态。星图在翼的腹面，尾上仍是一颗星。' },
  shuangquan: { name: '霜泉鲵', blurb: '尾鳍带一圈霜白边。', dex: '寒泉鲵的最终形态。鳃羽更软，背上有淡淡霜斑。' },
};

function evolvedSpecies(): SpeciesDef[] {
  const bases = Object.fromEntries(SPECIES_LIST_RAW.map((species) => [species.id, species])) as Record<SpeciesId, SpeciesDef>;
  const list: SpeciesDef[] = [];
  for (const line of EVOLUTION_LINES) {
    const base = bases[line[0].id];
    for (const step of line) {
      if (step.stage === 1) continue;
      const copy = EVO_COPY[step.id];
      if (!copy) throw new Error(`缺少进化文案 ${step.id}`);
      const steps = step.stage - 1;
      list.push({
        id: step.id,
        name: copy.name,
        type: base.type,
        catchRate: Math.max(CATCH_FLOOR, base.catchRate - steps * CATCH_STEP),
        baseExp: base.baseExp + steps * EXP_STEP,
        race: raceAtStage(base.race, step.stage),
        moves: base.moves,
        blurb: copy.blurb,
        dex: copy.dex,
      });
    }
  }
  return list;
}

export const BASE_SPECIES: SpeciesId[] = SPECIES_LIST_RAW.map((species) => species.id);
export const RIDGE_SPECIES: SpeciesId[] = ['wudeng', 'yunyang', 'luoxing', 'hanquan'];
export const RIDGE_TRIAL: Array<{ speciesId: SpeciesId; level: number }> = [
  { speciesId: 'wudeng', level: 13 },
  { speciesId: 'yunyang', level: 14 },
  { speciesId: 'luoxing', level: 13 },
];

export const SPECIES_LIST = [...SPECIES_LIST_RAW, ...evolvedSpecies()];

const SPECIES_MAP = Object.fromEntries(SPECIES_LIST.map((species) => [species.id, species])) as Record<SpeciesId, SpeciesDef>;

export function getSpecies(id: SpeciesId): SpeciesDef {
  return SPECIES_MAP[id];
}

export const STARTERS: SpeciesId[] = ['lujiao', 'yanwei', 'luzhu'];
export const NAME_PRESETS = ['小芽', '星旅', '阿露'] as const;

export function introScript(name: string): { speaker: string; text: string }[] {
  return [
    { speaker: '芽婆婆', text: `${name}，你来啦。星芽岛上的芽灵会自己在草地、林间和湖边散步。` },
    { speaker: '芽婆婆', text: '走近它们就能遇见。星芽球可以邀请愿意同行的芽灵，也可以先友好地比试一场。' },
    { speaker: '芽婆婆', text: '菜单里可以看五行阴阳，也能按属性检索技能。每只芽灵最多装备 4 个技能。' },
    { speaker: '芽婆婆', text: '先去岛上收服至少一只野生芽灵，再往北走进试炼林，和试炼官岚川比试。做完了回来告诉我。' },
    { speaker: '芽婆婆', text: '受伤了就回星芽驿。球如果见底，我也会帮你补到能继续出发。' },
  ];
}

export function practiceScript(done: boolean): { speaker: string; text: string }[] {
  if (done) {
    return [
      { speaker: '青禾', text: '你已经和我练过啦。湖边有汐纹獭，苔木林里有苔背熊，北面的岩壳龟很能挨打。' },
      { speaker: '青禾', text: '五行相克是金克木、木克土、土克水、水克火、火克金。想换阴阳，去队伍里试试炼。' },
    ];
  }
  return [
    { speaker: '青禾', text: '我是向导青禾。第一次对战可以找我，点到为止，输了也能回驿站休息。' },
    { speaker: '青禾', text: '先记住相克：金克木，木克土，土克水，水克火，火克金。详细说明在菜单的五行阴阳里。' },
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

export function stageElement(type: TypeId): string {
  return TYPE_META[type].element === 'pure' ? type : TYPE_META[type].element;
}
