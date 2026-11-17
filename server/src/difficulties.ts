/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
export interface DifficultyLevel {
  key: string;
  sortOrder: number;
  isEnabled: boolean;
  poolKey?: string;
  unlimitedGuesses?: boolean;
  singleOnly?: boolean;
}

export const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = [
  {
    key: 'easy',
    sortOrder: 10,
    isEnabled: true,
    poolKey: 'normal',
    unlimitedGuesses: true,
    singleOnly: true,
  },
  { key: 'normal', sortOrder: 20, isEnabled: true },
];

const DIFFICULTY_BY_KEY = new Map(DIFFICULTY_LEVELS.map((difficulty) => [difficulty.key, difficulty]));

export function isKnownDifficultyKey(key: string): boolean {
  return DIFFICULTY_BY_KEY.has(key);
}

export function getDifficultyLevel(key: string): DifficultyLevel | undefined {
  return DIFFICULTY_BY_KEY.get(key);
}

export function difficultyPoolKey(key: string): string {
  return DIFFICULTY_BY_KEY.get(key)?.poolKey ?? key;
}

export function isSingleOnlyDifficulty(key: string): boolean {
  return DIFFICULTY_BY_KEY.get(key)?.singleOnly === true;
}

export function difficultyHasUnlimitedGuesses(key: string): boolean {
  return DIFFICULTY_BY_KEY.get(key)?.unlimitedGuesses === true;
}
