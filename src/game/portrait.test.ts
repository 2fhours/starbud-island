import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../version';
import { actorFor, actorPortraitHtml, battleFacing, FULL_BODY_SPECIES, PORTRAIT_FILES, portraitSrc, SPECIES_PORTRAIT_IDS, speciesFacingFile, speciesFacingSrc, speciesPortraitHtml } from './portraits';
import { canvasBitmapSize, MAX_CANVAS_EDGE, PORTRAIT_CSS } from './sprites';
import { createWorld } from './world';

describe('遭遇肖像不会变成空白坏图', () => {
  it('位图尺寸由固定版心决定，不会把上一帧的位图再乘一遍', () => {
    const first = canvasBitmapSize(PORTRAIT_CSS.w, PORTRAIT_CSS.h, 2);
    expect(canvasBitmapSize(PORTRAIT_CSS.w, PORTRAIT_CSS.h, 2)).toEqual(first);
    expect(first.w).toBe(PORTRAIT_CSS.w * 2);
    expect(first.h).toBe(PORTRAIT_CSS.h * 2);
    expect(first.w).toBeLessThanOrEqual(MAX_CANVAS_EDGE);
    const fedBack = canvasBitmapSize(first.w, first.h, 2);
    expect(fedBack.w).toBeGreaterThan(first.w);
  });

  it('设备像素比再高也不会超过画布上限', () => {
    const size = canvasBitmapSize(PORTRAIT_CSS.w, PORTRAIT_CSS.h, 8);
    expect(size.w).toBeLessThanOrEqual(MAX_CANVAS_EDGE);
    expect(size.h).toBeLessThanOrEqual(MAX_CANVAS_EDGE);
    expect(size.w).toBeGreaterThan(0);
  });
});

describe('静态立绘', () => {
  it('地址带上站点前缀，并且十二张图都在 public/portraits', () => {
    expect(portraitSrc('lujiao')).toBe(`${import.meta.env.BASE_URL}portraits/lujiao.jpg`);
    expect(portraitSrc('player')).toContain('/portraits/player.jpg');
    expect(portraitSrc('grandma').startsWith('/')).toBe(true);
    expect(portraitSrc('lujiao')).not.toMatch(/^\/portraits\//);
    for (const file of Object.values(PORTRAIT_FILES)) {
      expect(existsSync(new URL(`../../public/portraits/${file}`, import.meta.url)), file).toBe(true);
    }
  });

  it('基础形态和三位居民都有全身图', () => {
    for (const id of FULL_BODY_SPECIES) {
      expect(PORTRAIT_FILES[id]).toBe(`${id}.jpg`);
    }
    for (const npc of createWorld().npcs) {
      if (npc.id === 'grandma' || npc.id === 'qinghe' || npc.id === 'lanchuan') {
        expect(PORTRAIT_FILES[npc.id]).toBe(`${npc.id}.jpg`);
      }
    }
    expect(PORTRAIT_FILES.player).toBe('player.jpg');
  });

  it('详情主图是图片，失败时仍带着物种 id 以便回到程序肖像', () => {
    const html = speciesPortraitHtml('yanwei', 'detail', true);
    expect(html).toContain('portrait-detail');
    expect(html).toContain('is-faint');
    expect(html).toContain('data-species="yanwei"');
    expect(html).toContain('data-facing="front"');
    expect(html).toContain('portraits/yanwei-front.jpg');
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('种族');
    expect(html).not.toContain('个体');
  });

  it('人物按名字对上立绘，没有立绘的说话人不留空图', () => {
    expect(actorFor('芽婆婆')).toBe('grandma');
    expect(actorFor('青禾')).toBe('qinghe');
    expect(actorFor('岚川')).toBe('lanchuan');
    expect(actorFor('grandma')).toBe('grandma');
    expect(actorFor('捕捉')).toBeNull();
    expect(actorFor('星芽驿')).toBeNull();
    expect(actorFor('小芽')).toBeNull();
    const html = actorPortraitHtml('player', true);
    expect(html).toContain('portraits/player.jpg');
    expect(html).toContain('data-actor="player"');
    expect(html).toContain('compact');
  });
});

describe('战斗朝向', () => {
  it('三十二种形态都有正面和背面，比例是 2:3', () => {
    expect(SPECIES_PORTRAIT_IDS).toHaveLength(32);
    for (const id of SPECIES_PORTRAIT_IDS) {
      for (const facing of ['front', 'back'] as const) {
        const name = speciesFacingFile(id, facing);
        const file = new URL(`../../public/portraits/${name}`, import.meta.url);
        expect(existsSync(file), name).toBe(true);
        const size = jpegSize(readFileSync(file));
        expect(size, name).toEqual({ w: 384, h: 576 });
        expect(size.w * 3, name).toBe(size.h * 2);
      }
      expect(speciesFacingSrc(id, 'front')).toBe(`${import.meta.env.BASE_URL}portraits/${id}-front.jpg`);
      expect(speciesFacingSrc(id, 'back')).toContain(`/portraits/${id}-back.jpg`);
      expect(speciesFacingSrc(id, 'back')).not.toContain(`${id}-front.jpg`);
    }
  });

  it('全身立绘是 432×576，宽比高 3:4', () => {
    const files = [
      ...FULL_BODY_SPECIES.map((id) => `${id}.jpg`),
      'player.jpg',
      'grandma.jpg',
      'qinghe.jpg',
      'lanchuan.jpg',
    ];
    expect(files).toHaveLength(16);
    for (const name of files) {
      const size = jpegSize(readFileSync(new URL(`../../public/portraits/${name}`, import.meta.url)));
      expect(size, name).toEqual({ w: 432, h: 576 });
      expect(size.w * 4, name).toBe(size.h * 3);
    }
  });

  it('我方用背面，敌方用正面，换人后朝向不变', () => {
    expect(battleFacing('player')).toBe('back');
    expect(battleFacing('foe')).toBe('front');
    const mine = speciesPortraitHtml('lujiao', 'card', false, battleFacing('player'));
    const foe = speciesPortraitHtml('luzhu', 'stage', true, battleFacing('foe'));
    expect(mine).toContain('lujiao-back.jpg');
    expect(mine).toContain('data-facing="back"');
    expect(foe).toContain('luzhu-front.jpg');
    expect(foe).toContain('data-facing="front"');
    expect(foe).toContain('is-faint');
    const switched = speciesPortraitHtml('wudeng', 'card', false, battleFacing('player'));
    const newFoe = speciesPortraitHtml('lujiao', 'stage', false, battleFacing('foe'));
    expect(switched).toContain('wudeng-back.jpg');
    expect(newFoe).toContain('lujiao-front.jpg');
    expect(switched).not.toContain('scaleX');
    expect(mine).not.toContain(`${'lujiao'}-front.jpg`);
  });
});

function jpegSize(data: Buffer): { w: number; h: number } {
  let i = 2;
  while (i < data.length - 8) {
    if (data[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = data[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { h: data.readUInt16BE(i + 5), w: data.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    i += 2 + data.readUInt16BE(i + 2);
  }
  throw new Error('不是可识别的 JPEG');
}

describe('版本号', () => {
  it('读取 package.json 的版本，不随刷新变化', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toBe('1.10.6');
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
