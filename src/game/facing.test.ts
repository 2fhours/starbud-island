import { describe, expect, it } from 'vitest';
import { BACK_READ, backGaze, backMirror, leftSpecies, rearSpecies } from './facing';
import { SPECIES_PORTRAIT_IDS, speciesPortraitHtml } from './portraits';
import type { SpeciesId } from './types';

describe('背面朝向', () => {
  it('三十二种都有判定，朝左才翻转，正后方和朝右都不翻', () => {
    expect(Object.keys(BACK_READ)).toHaveLength(32);
    expect(new Set(Object.keys(BACK_READ))).toEqual(new Set(SPECIES_PORTRAIT_IDS));
    const gazes = new Set(Object.values(BACK_READ).map((row) => row.gaze));
    expect(gazes.has('left')).toBe(true);
    expect(gazes.has('rear')).toBe(true);
    expect(gazes.has('right')).toBe(true);
    expect(leftSpecies()).toEqual(['yanwei', 'huowen', 'chiyan', 'xiwen', 'chaowen', 'canglan']);
    expect(backGaze('lujiao')).toBe('right');
    expect(backMirror('lujiao')).toBe(false);
    expect(rearSpecies()).toHaveLength(23);
    for (const id of Object.keys(BACK_READ) as SpeciesId[]) {
      expect(backMirror(id)).toBe(backGaze(id) === 'left');
      expect(BACK_READ[id].why.length).toBeGreaterThan(4);
    }
  });

  it('翻转只出现在我方背面槽位，图鉴和敌方正面不翻，也不拿正面冒充背面', () => {
    for (const id of SPECIES_PORTRAIT_IDS) {
      const dex = speciesPortraitHtml(id, 'detail');
      expect(dex).toContain(`${id}-front.jpg`);
      expect(dex).not.toContain('data-mirror');
      expect(dex).not.toContain('scaleX');
      const foe = speciesPortraitHtml(id, 'stage', false, 'front', 'foe');
      expect(foe).toContain(`${id}-front.jpg`);
      expect(foe).toContain('data-side="foe"');
      expect(foe).toContain('data-mirror="0"');
      expect(foe).not.toContain(`${id}-back.jpg`);
      const mine = speciesPortraitHtml(id, 'stage', false, 'back', 'player');
      expect(mine).toContain(`${id}-back.jpg`);
      expect(mine).toContain('data-facing="back"');
      expect(mine).toContain('data-side="player"');
      expect(mine).toContain('battle-motion');
      expect(mine).toContain('battle-fx');
      expect(mine).toContain('portrait-facing');
      expect(mine.indexOf('portrait-facing')).toBeGreaterThan(mine.indexOf('battle-motion'));
      expect(mine.indexOf('battle-fx')).toBeGreaterThan(mine.indexOf('portrait-facing'));
      expect(mine).not.toContain(`${id}-front.jpg`);
      expect(mine).not.toContain('scaleX');
      expect(mine).not.toContain('种族');
      if (backGaze(id) === 'left') {
        expect(mine).toContain('data-mirror="1"');
        expect(mine).toContain('data-gaze="left"');
      } else {
        expect(mine).toContain('data-mirror="0"');
        expect(mine).toContain(`data-gaze="${backGaze(id)}"`);
      }
      const foeBack = speciesPortraitHtml(id, 'stage', false, 'back', 'foe');
      expect(foeBack).toContain('data-mirror="0"');
    }
  });
});
