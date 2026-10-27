/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import type { TFunction } from 'i18next';
import type { LucideIcon } from 'lucide-react';
import { Flame } from 'lucide-react';

export function difficultyLabel(t: TFunction, key: string): string {
  return t(`difficulty.${key}`, { defaultValue: key });
}

export function difficultyDescription(t: TFunction, key: string): string {
  return t(`difficulty.${key}Description`, { defaultValue: '' });
}

const DIFFICULTY_ICONS: Record<string, LucideIcon> = {
  normal: Flame,
};

export function difficultyIcon(key: string): LucideIcon {
  return DIFFICULTY_ICONS[key] ?? Flame;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  normal: 'var(--accent)',
};

export function difficultyColor(key: string): string {
  return DIFFICULTY_COLORS[key] ?? 'var(--accent)';
}
