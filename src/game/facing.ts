import type { SpeciesId } from './types';

/** 我方槽位在画面左侧，敌方在右侧。只描述现有背面稿，不改像素。 */
export type BackGaze = 'left' | 'right' | 'rear';

export interface BackRead {
  gaze: BackGaze;
  why: string;
}

/**
 * left：头或胸朝画面左侧，我方槽位只做水平翻转，使它朝向右侧敌方。
 * right：背面稿已经朝画面右侧，不翻转。这一批是叶角鹿、翠枝鹿、森冕鹿。
 * rear：正后方，看不出面朝哪边。不翻转。不能当成已经面向敌方。
 * 正后方 23 张若换成已经朝右的新背面，要把对应 gaze 改成 right，避免和翻转叠在一起。
 */
export const BACK_READ: Record<SpeciesId, BackRead> = {
  lujiao: { gaze: 'right', why: '原稿头已经偏向画面右侧，尾巴也在右侧。再翻转会改成朝左。' },
  cuizhi: { gaze: 'right', why: '和叶角鹿同一朝向，原稿已经朝画面右侧。' },
  senmian: { gaze: 'right', why: '和叶角鹿同一朝向，原稿已经朝画面右侧。' },
  yanwei: { gaze: 'left', why: '头转向画面左侧，焰尾甩在右侧。' },
  huowen: { gaze: 'left', why: '和焰尾狐同一朝向，头偏左，尾巴在右。' },
  chiyan: { gaze: 'left', why: '和焰尾狐同一朝向，头偏左，尾巴在右。' },
  xiwen: { gaze: 'left', why: '身体斜向画面左侧，水纹尾在右侧。' },
  chaowen: { gaze: 'left', why: '和汐纹獭同一朝向，头偏左，尾巴在右。' },
  canglan: { gaze: 'left', why: '和汐纹獭同一朝向，头偏左，尾巴在右。' },
  luzhu: { gaze: 'rear', why: '正后方，左右对称，看不出面朝哪边。' },
  linlu: { gaze: 'rear', why: '正后方，头顶水滴左右对称。' },
  jinglu: { gaze: 'rear', why: '正后方，水滴和肩上的泡左右对称。' },
  dianrong: { gaze: 'rear', why: '正后方。卷起的小尾不是头的朝向。' },
  shanrong: { gaze: 'rear', why: '正后方。尾巴弯曲不是头的朝向。' },
  tingrong: { gaze: 'rear', why: '正后方，额上的闪电左右对称。' },
  yanke: { gaze: 'rear', why: '正后方的龟壳，头和尾都在中线。' },
  panjia: { gaze: 'rear', why: '正后方。壳上偏左的叶子是花纹，不是面朝左侧。' },
  fengling: { gaze: 'rear', why: '正后方，铃在背中线。' },
  lingyu: { gaze: 'rear', why: '正后方，双铃在背中线。' },
  yaoling: { gaze: 'rear', why: '正后方，双铃在背中线。' },
  taibei: { gaze: 'rear', why: '正后方，苔背和耳朵左右对称。' },
  senbei: { gaze: 'rear', why: '正后方，背上的花和果实不是朝向。' },
  wudeng: { gaze: 'rear', why: '正后方，翅膀和触角左右对称。' },
  wuhui: { gaze: 'rear', why: '正后方，四盏灯左右成对。' },
  landeng: { gaze: 'rear', why: '正后方，灯在尾端中线。' },
  yunyang: { gaze: 'rear', why: '正后方，双角左右对称。' },
  lanjiao: { gaze: 'rear', why: '正后方，双角左右对称。' },
  luoxing: { gaze: 'rear', why: '正后方，翼膜左右对称。' },
  xingyi: { gaze: 'rear', why: '正后方，尾巴居中下垂。' },
  liuxing: { gaze: 'rear', why: '正后方，翼膜和星尾左右对称。' },
  hanquan: { gaze: 'rear', why: '头和躯干是正后方。尾巴甩向画面右侧，翻转只会把尾巴换边，不能变成面向敌方。' },
  shuangquan: { gaze: 'rear', why: '和寒泉鲵一样，头是正后方，只有尾巴偏向一侧。' },
};

export function backGaze(id: SpeciesId): BackGaze {
  return BACK_READ[id].gaze;
}

/** 只在我方战斗槽位、并且背面稿朝画面左侧时水平翻转。 */
export function backMirror(id: SpeciesId): boolean {
  return BACK_READ[id].gaze === 'left';
}

export function rearSpecies(): SpeciesId[] {
  return (Object.keys(BACK_READ) as SpeciesId[]).filter((id) => BACK_READ[id].gaze === 'rear');
}

export function leftSpecies(): SpeciesId[] {
  return (Object.keys(BACK_READ) as SpeciesId[]).filter((id) => BACK_READ[id].gaze === 'left');
}
