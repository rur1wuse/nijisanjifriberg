/**
 * 新增文件：nijisanjifriberg 题库分部（JP / KR / ID）的前端选项。
 * Copyright (C) 2026 rur1wuse。以 AGPL-3.0 发布，详见 LICENSE / COPYRIGHT.md。
 */

export const REGION_OPTIONS = ['jp', 'kr', 'id'] as const;
export type RegionKey = (typeof REGION_OPTIONS)[number];

export const ALL_REGIONS: readonly RegionKey[] = REGION_OPTIONS;

const REGION_ORDER = new Map<RegionKey, number>(REGION_OPTIONS.map((key, index) => [key, index]));

export function isKnownRegion(value: unknown): value is RegionKey {
  return typeof value === 'string' && (REGION_OPTIONS as readonly string[]).includes(value);
}

function canonical(selected: Iterable<RegionKey>): RegionKey[] {
  return [...new Set(selected)].sort(
    (a, b) => (REGION_ORDER.get(a) ?? 0) - (REGION_ORDER.get(b) ?? 0)
  );
}

export function normalizeRegionSelection(input: unknown): RegionKey[] {
  if (!Array.isArray(input)) return [...ALL_REGIONS];
  const selected = input.filter(isKnownRegion);
  return selected.length ? canonical(selected) : [...ALL_REGIONS];
}

export function parseRegionQuery(value: string | null | undefined): RegionKey[] {
  if (!value) return [...ALL_REGIONS];
  return normalizeRegionSelection(value.split(','));
}

export function serializeRegionQuery(regions: readonly RegionKey[]): string {
  return canonical(regions).join(',');
}
