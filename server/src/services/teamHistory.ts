/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
const MAX_COLLAB_GROUPS = 300;

export function normalizeCollabGroups(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((group): group is string => typeof group === 'string')
    .map((group) => group.trim())
    .filter(Boolean)
    .slice(0, MAX_COLLAB_GROUPS);
}

export function serializeCollabGroups(value: unknown): string {
  return JSON.stringify(normalizeCollabGroups(value));
}
