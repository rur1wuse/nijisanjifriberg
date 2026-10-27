/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import { describe, expect, it } from 'vitest';
import { AVAILABLE_DIFFICULTIES, DIFFICULTIES } from '../../src/config/difficulties';

describe('difficulty config', () => {
  it('only exposes the single normal tier', () => {
    expect(AVAILABLE_DIFFICULTIES.map((item) => item.key)).toEqual(['normal']);
    expect(DIFFICULTIES.every((item) => item.key === 'normal')).toBe(true);
    expect(AVAILABLE_DIFFICULTIES[0]?.enabled).toBe(true);
  });
});
