import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../version';
import { canvasBitmapSize, MAX_CANVAS_EDGE, PORTRAIT_CSS } from './sprites';

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

describe('版本号', () => {
  it('读取 package.json 的版本，不随刷新变化', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toBe('1.3.3');
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
