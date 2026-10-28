/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
export interface User {
  id: number;
  username: string;
  display_id: string | null;
  password_hash: string;
  role: 'user' | 'admin';
  token_version: number;
  matchmaking_restricted: boolean | number;
  email: string | null;
  email_verified_at: string | null;
  banned_at: string | null;
  created_at: string;
}

export interface Player {
  id: number;
  nickname: string;
  name_zh: string;
  gender: string;
  debut_date: string;
  height_cm: string;
  age_text: string;
  collab_groups: string[];
  race: string;
  difficulties?: string[];
  is_enabled: boolean | number;
  created_at: string;
}

export type FeedbackLevel = 'correct' | 'close' | 'wrong' | 'gray' | 'unknown';

export interface AttributeFeedback {
  value: string | number | boolean;
  level: FeedbackLevel;
  /** 数值型属性的方向提示: higher = 目标比猜测大 */
  hint?: 'higher' | 'lower';
}

export interface GuessFeedback {
  playerId: number;
  nickname: string;
  correct: boolean;
  attributes: {
    gender: AttributeFeedback;
    debutDate: AttributeFeedback;
    height: AttributeFeedback;
    age: AttributeFeedback;
    collab: AttributeFeedback;
    race: AttributeFeedback;
  };
}
