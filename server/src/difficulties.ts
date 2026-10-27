/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
export const DIFFICULTY_LEVELS = [
  { key: 'normal', sortOrder: 20, isEnabled: true },
] as const;

const DIFFICULTY_KEYS = new Set<string>(DIFFICULTY_LEVELS.map((difficulty) => difficulty.key));

export function isKnownDifficultyKey(key: string): boolean {
  return DIFFICULTY_KEYS.has(key);
}
