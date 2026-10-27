/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import { Player, GuessFeedback, AttributeFeedback } from '../types';
import {
  AGE_CLOSE_YEARS,
  DEBUT_CLOSE_DAYS,
  HEIGHT_CLOSE_CM,
  isUnknownAge,
  parseAge,
  parseDateToDay,
  parseHeightCm,
} from './attributeParsing';

function textAttr(guess: string, target: string): AttributeFeedback {
  return { value: guess, level: guess === target ? 'correct' : 'wrong' };
}

function numericAttr(
  guessLabel: string,
  guessValue: number | null,
  targetValue: number | null,
  closeRange: number
): AttributeFeedback {
  if (guessValue === null || targetValue === null) {
    return { value: guessLabel, level: 'gray' };
  }
  if (guessValue === targetValue) return { value: guessLabel, level: 'correct' };
  return {
    value: guessLabel,
    level: Math.abs(guessValue - targetValue) <= closeRange ? 'close' : 'gray',
    hint: targetValue > guessValue ? 'higher' : 'lower',
  };
}

function debutAttr(guess: Player, target: Player): AttributeFeedback {
  const guessDay = parseDateToDay(guess.debut_date);
  const targetDay = parseDateToDay(target.debut_date);
  if (guessDay === null || targetDay === null) {
    return { value: guess.debut_date, level: 'gray' };
  }
  if (guessDay === targetDay) return { value: guess.debut_date, level: 'correct' };
  return {
    value: guess.debut_date,
    level: Math.abs(guessDay - targetDay) <= DEBUT_CLOSE_DAYS ? 'close' : 'gray',
    hint: targetDay > guessDay ? 'higher' : 'lower',
  };
}

function ageAttr(guess: Player, target: Player): AttributeFeedback {
  if (isUnknownAge(guess.age_text) || isUnknownAge(target.age_text)) {
    return { value: guess.age_text, level: 'unknown' };
  }
  return numericAttr(guess.age_text, parseAge(guess.age_text), parseAge(target.age_text), AGE_CLOSE_YEARS);
}

function heightAttr(guess: Player, target: Player): AttributeFeedback {
  return numericAttr(
    guess.height_cm,
    parseHeightCm(guess.height_cm),
    parseHeightCm(target.height_cm),
    HEIGHT_CLOSE_CM
  );
}

function collabAttr(guess: Player, target: Player): AttributeFeedback {
  const guessGroups = guess.collab_groups ?? [];
  const targetGroups = new Set(target.collab_groups ?? []);
  const shared = guessGroups.filter((group) => targetGroups.has(group));
  // 猜中目标时整行必须是绿的,即使该角色没有任何组合(如語部紡)。
  const matched = shared.length > 0 || guess.id === target.id;
  return {
    value: shared.join(', '),
    level: matched ? 'correct' : 'wrong',
  };
}

/** 逐属性对比猜测角色与目标角色,产出反馈 */
export function compareGuess(guess: Player, target: Player): GuessFeedback {
  const correct = guess.id === target.id;
  return {
    playerId: guess.id,
    nickname: guess.nickname,
    correct,
    attributes: {
      gender: textAttr(guess.gender, target.gender),
      debutDate: debutAttr(guess, target),
      height: heightAttr(guess, target),
      age: ageAttr(guess, target),
      collab: collabAttr(guess, target),
      race: textAttr(guess.race, target.race),
    },
  };
}

/**
 * 玩家数据可能在上次判定后被管理员修改,重放历史时按当前数据重算。
 * 新判定是纯函数,重算即为最新结果。
 */
export function refreshGuessFeedback(
  feedback: GuessFeedback,
  guess?: Player,
  target?: Player
): GuessFeedback {
  if (!guess || !target) return feedback;
  return compareGuess(guess, target);
}

export const MAX_GUESSES = 8;