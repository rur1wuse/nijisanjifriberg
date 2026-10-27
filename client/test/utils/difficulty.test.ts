/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import { describe, expect, it } from 'vitest';
import { Flame } from 'lucide-react';
import i18n from '../../src/i18n';
import {
  difficultyColor,
  difficultyDescription,
  difficultyIcon,
  difficultyLabel,
} from '../../src/utils/difficulty';

describe('difficulty helpers', () => {
  it('maps the single normal tier to a stable icon and colour', () => {
    expect(difficultyIcon('normal')).toBe(Flame);
    expect(difficultyIcon('unknown')).toBe(Flame);
    expect(difficultyColor('normal')).toBe('var(--accent)');
    expect(difficultyColor('unknown')).toBe('var(--accent)');
  });

  it('resolves the localized label and description', () => {
    const t = i18n.t.bind(i18n);
    expect(difficultyLabel(t, 'normal')).toBe('\u5b8c\u6574\u7248');
    expect(difficultyDescription(t, 'normal')).not.toBe('');
    expect(difficultyDescription(t, 'missing')).toBe('');
    expect(difficultyLabel(t, 'missing')).toBe('missing');
  });
});
