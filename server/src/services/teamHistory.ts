/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import legacyNoteData from '../db/seeds/collabLegacyNotes.json';
import type { CollabGroup } from '../types';

const MAX_COLLAB_GROUPS = 300;
const FOOTNOTE_MARKER = /\*\d+/g;
const LEGACY_NOTES = legacyNoteData as Record<string, string>;

function stripMarker(name: string): string {
  return name.replace(FOOTNOTE_MARKER, '').trim();
}

function normalizeGroup(value: unknown): CollabGroup | null {
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;
    const note = LEGACY_NOTES[raw];
    return note ? { name: stripMarker(raw), note } : { name: stripMarker(raw) };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.name !== 'string') return null;
  const raw = record.name.trim();
  if (!raw) return null;
  const explicitNote = typeof record.note === 'string' ? record.note.trim() : '';
  const note = explicitNote || LEGACY_NOTES[raw] || '';
  const group: CollabGroup = { name: stripMarker(raw) };
  if (note) group.note = note;
  return group;
}

export function collabGroupKey(group: CollabGroup): string {
  return `${group.name}\u0000${group.note ?? ''}`;
}

export function normalizeCollabGroups(value: unknown): CollabGroup[] {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const groups: CollabGroup[] = [];
  for (const entry of parsed) {
    const group = normalizeGroup(entry);
    if (!group) continue;
    const key = collabGroupKey(group);
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push(group);
    if (groups.length >= MAX_COLLAB_GROUPS) break;
  }
  return groups;
}

export function serializeCollabGroups(value: unknown): string {
  return JSON.stringify(normalizeCollabGroups(value));
}
