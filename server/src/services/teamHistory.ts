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
