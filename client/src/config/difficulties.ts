/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
export interface DifficultyOption {
  key: string;
  sortOrder: number;
  enabled: boolean;
  unlimitedGuesses?: boolean;
  singleOnly?: boolean;
}

export const DIFFICULTIES: DifficultyOption[] = [
  { key: 'easy', sortOrder: 10, enabled: true, unlimitedGuesses: true, singleOnly: true },
  { key: 'normal', sortOrder: 20, enabled: true },
];

export const AVAILABLE_DIFFICULTIES = DIFFICULTIES
  .filter((difficulty) => difficulty.enabled)
  .sort((a, b) => a.sortOrder - b.sortOrder);

export const MULTIPLAYER_DIFFICULTIES = AVAILABLE_DIFFICULTIES
  .filter((difficulty) => !difficulty.singleOnly);

export const DAILY_DIFFICULTIES = AVAILABLE_DIFFICULTIES
  .filter((difficulty) => !difficulty.singleOnly);

export const ADMIN_DIFFICULTIES = AVAILABLE_DIFFICULTIES
  .filter((difficulty) => !difficulty.singleOnly);

export function difficultyHasUnlimitedGuesses(key: string): boolean {
  return DIFFICULTIES.find((difficulty) => difficulty.key === key)?.unlimitedGuesses === true;
}
