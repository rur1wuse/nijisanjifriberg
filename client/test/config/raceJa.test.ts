import { describe, expect, it } from 'vitest';
import { localizedRace } from '../../src/config/raceJa';

describe('localizedRace', () => {
  it('uses the Japanese race labels in Japanese', () => {
    expect(localizedRace('人类', 'ja')).toBe('人間');
    expect(localizedRace('外星人', 'ja-JP')).toBe('宇宙人');
    expect(localizedRace('龙巫女', 'ja')).toBe('「龍」と対話できる一族の巫女');
  });

  it('keeps the raw race for other languages', () => {
    expect(localizedRace('人类', 'zh')).toBe('人类');
    expect(localizedRace('人类', 'en')).toBe('人类');
  });

  it('falls back to the raw value for unknown races', () => {
    expect(localizedRace('未知', 'ja')).toBe('未知');
    expect(localizedRace('', 'ja')).toBe('');
  });
});
