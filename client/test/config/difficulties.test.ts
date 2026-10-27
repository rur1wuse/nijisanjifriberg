import { describe, expect, it } from 'vitest';
import { AVAILABLE_DIFFICULTIES, DIFFICULTIES } from '../../src/config/difficulties';

describe('difficulty config', () => {
  it('only exposes the single normal tier', () => {
    expect(AVAILABLE_DIFFICULTIES.map((item) => item.key)).toEqual(['normal']);
    expect(DIFFICULTIES.every((item) => item.key === 'normal')).toBe(true);
    expect(AVAILABLE_DIFFICULTIES[0]?.enabled).toBe(true);
  });
});
