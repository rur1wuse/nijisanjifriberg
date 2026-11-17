/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import { describe, expect, it } from 'vitest';
import {
  AVAILABLE_DIFFICULTIES,
  DAILY_DIFFICULTIES,
  DIFFICULTIES,
  MULTIPLAYER_DIFFICULTIES,
} from '../../src/config/difficulties';

describe('difficulty config', () => {
  it('exposes easy and normal for solo play', () => {
    expect(AVAILABLE_DIFFICULTIES.map((item) => item.key)).toEqual(['easy', 'normal']);
    expect(DIFFICULTIES.map((item) => item.key)).toEqual(['easy', 'normal']);
    expect(AVAILABLE_DIFFICULTIES.every((item) => item.enabled)).toBe(true);
  });

  it('keeps the solo-only easy tier out of multiplayer and daily play', () => {
    expect(AVAILABLE_DIFFICULTIES.find((item) => item.key === 'easy')?.unlimitedGuesses).toBe(true);
    expect(MULTIPLAYER_DIFFICULTIES.map((item) => item.key)).toEqual(['normal']);
    expect(DAILY_DIFFICULTIES.map((item) => item.key)).toEqual(['normal']);
  });
});
