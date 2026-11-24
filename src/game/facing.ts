import type { SpeciesId } from './types';

/** 我方槽位在画面左侧，敌方在右侧。只描述现有背面稿，不改像素。 */
export type BackGaze = 'left' | 'right' | 'rear';

export interface BackRead {
  gaze: BackGaze;
  why: string;
}

/**
 * left：头或胸朝画面左侧，我方槽位只做水平翻转，使它朝向右侧敌方。
 * right：背面稿已经朝画面右侧，不翻转。包括叶角鹿三体，以及 23 张新画的朝右背面。
 * rear：正后方，看不出面朝哪边。不翻转。这一批已经没有。
 * 这 23 张新背面不得再水平翻转，否则会和朝右稿叠成朝左。
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
  luzhu: { gaze: 'right', why: '新背面身体和远侧眼睛朝右，头的转幅较小，不再是正后方。不翻转。' },
  linlu: { gaze: 'right', why: '同露珠蛙，远侧眼在右，头转幅较小。不翻转。' },
  jinglu: { gaze: 'right', why: '同露珠蛙，远侧眼在右，头转幅较小。不翻转。' },
  dianrong: { gaze: 'right', why: '新背面朝画面右侧。不翻转。' },
  shanrong: { gaze: 'right', why: '同电绒鼠，朝右。不翻转。' },
  tingrong: { gaze: 'right', why: '同电绒鼠，朝右。不翻转。' },
  yanke: { gaze: 'right', why: '新背面朝画面右侧。不翻转。' },
  panjia: { gaze: 'right', why: '新背面朝画面右侧。不翻转。' },
  fengling: { gaze: 'right', why: '新背面朝画面右侧。不翻转。' },
  lingyu: { gaze: 'right', why: '同风铃鸟，朝右。不翻转。' },
  yaoling: { gaze: 'right', why: '同风铃鸟，朝右。不翻转。' },
  taibei: { gaze: 'right', why: '新背面朝右。生成稿曾朝左，已在素材里纠正，代码不再翻转。' },
  senbei: { gaze: 'right', why: '同苔背熊，朝右。生成稿曾朝左，已在素材里纠正，代码不再翻转。' },
  wudeng: { gaze: 'right', why: '新背面朝右，头转幅很小，只看得到右侧一点眼睛。不翻转。' },
  wuhui: { gaze: 'right', why: '朝右，头转幅比雾灯蛾稍明显。不翻转。' },
  landeng: { gaze: 'right', why: '朝右，头转幅中等偏小。不翻转。' },
  yunyang: { gaze: 'right', why: '新背面朝画面右侧。不翻转。' },
  lanjiao: { gaze: 'right', why: '同云岩羊，朝右。不翻转。' },
  luoxing: { gaze: 'right', why: '新背面朝画面右侧。不翻转。' },
  xingyi: { gaze: 'right', why: '同落星鼯，朝右。不翻转。' },
  liuxing: { gaze: 'right', why: '同落星鼯，朝右。不翻转。' },
  hanquan: { gaze: 'right', why: '身体朝右，头几乎不转，后脑仍占主要位置。不翻转。' },
  shuangquan: { gaze: 'right', why: '同寒泉鲵，身体朝右，头转幅很小。不翻转。' },
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

export function rightSpecies(): SpeciesId[] {
  return (Object.keys(BACK_READ) as SpeciesId[]).filter((id) => BACK_READ[id].gaze === 'right');
}
