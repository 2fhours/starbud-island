import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../version';
import { SPECIES_LIST } from './data';
import { actorFor, actorPortraitHtml, PORTRAIT_FILES, portraitSrc, speciesPortraitHtml } from './portraits';
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

  it('八种芽灵和三位居民都有对应文件', () => {
    for (const species of SPECIES_LIST) {
      expect(PORTRAIT_FILES[species.id]).toBe(`${species.id}.jpg`);
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
    expect(html).toContain('portraits/yanwei.jpg');
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

describe('版本号', () => {
  it('读取 package.json 的版本，不随刷新变化', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toBe('1.7.0');
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
