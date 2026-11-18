import { describe, expect, it } from 'vitest';
import { BATTLE_SCORE, RIDGE_SCORE, clampVolume, EXPLORE_SCORE, midiToFreq, musicBusTargets, scoreFor, trackForMode, type Score } from './music';

function assertScore(score: Score): void {
  expect(score.beats).toBeGreaterThan(0);
  expect(score.bpm).toBeGreaterThan(40);
  for (const note of [...score.melody, ...score.harmony]) {
    expect(note.beat).toBeGreaterThanOrEqual(0);
    expect(note.beat).toBeLessThan(score.beats);
    expect(note.dur).toBeGreaterThan(0);
    expect(note.vel).toBeGreaterThan(0);
    expect(note.vel).toBeLessThanOrEqual(1);
    expect(midiToFreq(note.midi)).toBeGreaterThan(40);
    expect(midiToFreq(note.midi)).toBeLessThan(2000);
  }
}

describe('背景音乐乐谱', () => {
  it('探索和战斗是两套不同的可循环乐句', () => {
    assertScore(EXPLORE_SCORE);
    assertScore(BATTLE_SCORE);
    expect(EXPLORE_SCORE.bpm).toBeLessThan(BATTLE_SCORE.bpm);
    expect(EXPLORE_SCORE.melody.map((note) => note.midi).join(',')).not.toBe(
      BATTLE_SCORE.melody.map((note) => note.midi).join(','),
    );
  });

  it('只有对战模式切到战斗音乐', () => {
    expect(trackForMode('battle')).toBe('battle');
    expect(trackForMode('battle', 'ridge')).toBe('battle');
    expect(trackForMode('explore')).toBe('explore');
    expect(trackForMode('explore', 'ridge')).toBe('ridge');
    expect(trackForMode('encounter')).toBe('explore');
    expect(trackForMode('title')).toBe('explore');
    expect(scoreFor('ridge').melody[0].midi).not.toBe(EXPLORE_SCORE.melody[0].midi);
    expect(scoreFor('ridge').melody[0].midi).not.toBe(BATTLE_SCORE.melody[0].midi);
    expect(RIDGE_SCORE.melody.every((note) => note.vel <= 0.62)).toBe(true);
    expect(Math.max(...RIDGE_SCORE.melody.map((note) => note.vel))).toBeLessThanOrEqual(Math.max(...EXPLORE_SCORE.melody.map((note) => note.vel)));
  });

  it('探索、战斗和星雾岭不会同时把两条音量线都打开', () => {
    const sequence = [
      musicBusTargets('explore', 70),
      musicBusTargets('battle', 70),
      musicBusTargets('ridge', 70),
      musicBusTargets('explore', 70),
      musicBusTargets('idle', 70),
      musicBusTargets('battle', 0),
    ];
    expect(sequence[0].explore).toBeCloseTo(0.126, 10);
    expect(sequence[0].battle).toBe(0);
    expect(sequence[1].explore).toBe(0);
    expect(sequence[1].battle).toBeCloseTo(0.14, 10);
    expect(sequence[2].battle).toBe(0);
    expect(sequence[2].explore).toBeGreaterThan(0);
    expect(sequence[3].battle).toBe(0);
    expect(sequence[4]).toEqual({ explore: 0, battle: 0 });
    expect(sequence[5]).toEqual({ explore: 0, battle: 0 });
    for (const targets of sequence) expect(targets.explore > 0 && targets.battle > 0).toBe(false);
  });

  it('音量被限制在 0 到 100', () => {
    expect(clampVolume(35.2)).toBe(35);
    expect(clampVolume(-4)).toBe(0);
    expect(clampVolume(180)).toBe(100);
    expect(clampVolume(Number.NaN)).toBe(70);
  });
});
