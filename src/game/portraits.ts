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
  player: 'player.jpg',
  grandma: 'grandma.jpg',
  qinghe: 'qinghe.jpg',
  lanchuan: 'lanchuan.jpg',
} as const;

export type PortraitId = keyof typeof PORTRAIT_FILES;
export type ActorId = 'player' | 'grandma' | 'qinghe' | 'lanchuan';
export type SpeciesPortraitFit = 'stage' | 'card' | 'detail';

const ACTOR_LABELS: Record<string, ActorId> = {
  player: 'player',
  grandma: 'grandma',
  芽婆婆: 'grandma',
  qinghe: 'qinghe',
  青禾: 'qinghe',
  lanchuan: 'lanchuan',
  岚川: 'lanchuan',
};

export function portraitSrc(id: PortraitId): string {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}portraits/${PORTRAIT_FILES[id]}`;
}

export function actorFor(label: string): ActorId | null {
  return ACTOR_LABELS[label] ?? null;
}

export function speciesPortraitHtml(id: SpeciesId, fit: SpeciesPortraitFit, faint = false): string {
  const src = portraitSrc(id);
  const fallbackFit = fit === 'stage' ? 'stage' : 'card';
  return `<span class="portrait-frame portrait-${fit}${faint ? ' is-faint' : ''}"><img class="standing" alt="" draggable="false" src="${src}" data-species="${id}" data-fit="${fallbackFit}" data-faint="${faint ? '1' : '0'}" /></span>`;
}

export function actorPortraitHtml(id: ActorId, compact = false): string {
  const src = portraitSrc(id);
  return `<span class="portrait-frame portrait-actor${compact ? ' compact' : ''}"><img class="standing" alt="" draggable="false" src="${src}" data-actor="${id}" data-fit="card" /></span>`;
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
