import { BACK_READ, backMirror } from './facing';
import type { SpeciesId } from './types';

/** Static standing illustrations in public/portraits. Not stats and not formulas. */
export const PORTRAIT_FILES = {
  lujiao: 'lujiao.jpg',
  yanwei: 'yanwei.jpg',
  luzhu: 'luzhu.jpg',
  dianrong: 'dianrong.jpg',
  yanke: 'yanke.jpg',
  fengling: 'fengling.jpg',
  taibei: 'taibei.jpg',
  xiwen: 'xiwen.jpg',
  wudeng: 'wudeng.jpg',
  yunyang: 'yunyang.jpg',
  luoxing: 'luoxing.jpg',
  hanquan: 'hanquan.jpg',
  player: 'player.jpg',
  grandma: 'grandma.jpg',
  qinghe: 'qinghe.jpg',
  lanchuan: 'lanchuan.jpg',
} as const;

export type PortraitId = keyof typeof PORTRAIT_FILES;
export type ActorId = 'player' | 'grandma' | 'qinghe' | 'lanchuan' | 'wushou' | 'shiling';
export type SpeciesPortraitFit = 'stage' | 'card' | 'detail';
export type PortraitFacing = 'front' | 'back';

export const FULL_BODY_SPECIES = [
  'lujiao',
  'yanwei',
  'luzhu',
  'dianrong',
  'yanke',
  'fengling',
  'taibei',
  'xiwen',
  'wudeng',
  'yunyang',
  'luoxing',
  'hanquan',
] as const satisfies readonly SpeciesId[];

export const SPECIES_PORTRAIT_IDS = [
  ...FULL_BODY_SPECIES,
  'cuizhi',
  'senmian',
  'huowen',
  'chiyan',
  'linlu',
  'jinglu',
  'shanrong',
  'tingrong',
  'panjia',
  'lingyu',
  'yaoling',
  'senbei',
  'chaowen',
  'canglan',
  'wuhui',
  'landeng',
  'lanjiao',
  'xingyi',
  'liuxing',
  'shuangquan',
] as const satisfies readonly SpeciesId[];

const FACINGS = ['front', 'back'] as const satisfies readonly PortraitFacing[];

export function speciesFacingFile(id: SpeciesId, facing: PortraitFacing): string {
  return `${id}-${facing}.jpg`;
}

export function battleFacing(side: 'player' | 'foe'): PortraitFacing {
  return side === 'player' ? 'back' : 'front';
}

const ACTOR_LABELS: Record<string, ActorId> = {
  player: 'player',
  grandma: 'grandma',
  芽婆婆: 'grandma',
  qinghe: 'qinghe',
  青禾: 'qinghe',
  lanchuan: 'lanchuan',
  岚川: 'lanchuan',
  wushou: 'wushou',
  雾守: 'wushou',
  shiling: 'shiling',
  石岭: 'shiling',
};

function portraitBase(): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

export function portraitSrc(id: PortraitId): string {
  return `${portraitBase()}portraits/${PORTRAIT_FILES[id]}`;
}

export function speciesFacingSrc(id: SpeciesId, facing: PortraitFacing = 'front'): string {
  return `${portraitBase()}portraits/${speciesFacingFile(id, facing)}`;
}

export function speciesFacingFiles(): string[] {
  return SPECIES_PORTRAIT_IDS.flatMap((id) => FACINGS.map((facing) => speciesFacingFile(id, facing)));
}

export function actorFor(label: string): ActorId | null {
  return ACTOR_LABELS[label] ?? null;
}

export function speciesPortraitHtml(id: SpeciesId, fit: SpeciesPortraitFit, faint = false, facing: PortraitFacing = 'front', slot?: 'player' | 'foe'): string {
  const src = speciesFacingSrc(id, facing);
  const fallbackFit = fit === 'stage' ? 'stage' : 'card';
  const img = `<img class="standing" alt="" draggable="false" src="${src}" data-species="${id}" data-facing="${facing}" data-fit="${fallbackFit}" data-faint="${faint ? '1' : '0'}" />`;
  if (!slot) {
    return `<span class="portrait-frame portrait-${fit}${faint ? ' is-faint' : ''}">${img}</span>`;
  }
  const mirror = slot === 'player' && facing === 'back' && backMirror(id) ? '1' : '0';
  const gaze = slot === 'player' && facing === 'back' ? BACK_READ[id].gaze : 'front';
  return `<span class="portrait-frame portrait-${fit}${faint ? ' is-faint' : ''} battle-actor" data-side="${slot}" data-gaze="${gaze}"><span class="battle-motion"><span class="portrait-facing" data-mirror="${mirror}">${img}</span></span><span class="battle-fx" data-fx=""></span></span>`;
}

export function actorPortraitHtml(id: ActorId, compact = false): string {
  const frame = `portrait-frame portrait-actor${compact ? ' compact' : ''}`;
  if (id === 'wushou' || id === 'shiling') {
    return `<span class="${frame}"><canvas class="portrait" data-actor="${id}" data-fit="card" width="84" height="112" aria-hidden="true"></canvas></span>`;
  }
  const src = portraitSrc(id);
  return `<span class="${frame}"><img class="standing" alt="" draggable="false" src="${src}" data-actor="${id}" data-fit="card" /></span>`;
}

function swapStanding(img: HTMLImageElement): void {
  if (img.dataset.swapped === '1') return;
  img.dataset.swapped = '1';
  const canvas = document.createElement('canvas');
  canvas.className = 'portrait';
  const species = img.dataset.species;
  const actor = img.dataset.actor;
  if (species) {
    canvas.dataset.species = species;
    canvas.dataset.fit = img.dataset.fit === 'stage' ? 'stage' : img.dataset.fit === 'hud' ? 'hud' : 'card';
    canvas.dataset.faint = img.dataset.faint === '1' ? '1' : '0';
  } else if (actor) {
    canvas.dataset.actor = actor;
    canvas.dataset.fit = 'card';
  } else {
    return;
  }
  img.replaceWith(canvas);
}

/** If a standing image fails, swap in the procedural canvas the paint loop already draws. */
export function bindStandingPortraits(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>('img.standing').forEach((img) => {
    if (img.dataset.bound === '1') return;
    img.dataset.bound = '1';
    const fail = () => swapStanding(img);
    img.addEventListener('error', fail);
    if (img.complete && img.naturalWidth === 0) fail();
  });
}
