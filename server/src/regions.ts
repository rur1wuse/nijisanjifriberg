/**
 * 新增文件：nijisanjifriberg 题库分部（JP / KR / ID）。
 * Copyright (C) 2026 rur1wuse。以 AGPL-3.0 发布，详见 LICENSE / COPYRIGHT.md。
 */

export const REGION_KEYS = ['jp', 'kr', 'id'] as const;
export type RegionKey = (typeof REGION_KEYS)[number];

export const ALL_REGIONS: readonly RegionKey[] = REGION_KEYS;

const REGION_ORDER = new Map<RegionKey, number>(REGION_KEYS.map((key, index) => [key, index]));

export function isKnownRegion(value: unknown): value is RegionKey {
  return typeof value === 'string' && (REGION_KEYS as readonly string[]).includes(value);
}

export type RegionParseResult =
  | { regions: RegionKey[] }
  | { error: 'INVALID_REGION' | 'REGION_REQUIRED' };

/**
 * 规范化请求里的题库选择：
 * - 缺省（undefined / null）表示完整题库，旧客户端与随机匹配都走这条路；
 * - 去重并固定为 jp, kr, id 的顺序；
 * - 含未知值 → INVALID_REGION，显式空数组 → REGION_REQUIRED。
 */
export function parseRegions(input: unknown): RegionParseResult {
  if (input === undefined || input === null) return { regions: [...ALL_REGIONS] };
  if (!Array.isArray(input)) return { error: 'INVALID_REGION' };
  const selected = new Set<RegionKey>();
  for (const value of input) {
    if (!isKnownRegion(value)) return { error: 'INVALID_REGION' };
    selected.add(value);
  }
  if (!selected.size) return { error: 'REGION_REQUIRED' };
  return { regions: canonicalRegions(selected) };
}

/** 读取 Redis 里的旧房间快照：未知值丢弃，缺失或全非法时回退为完整题库。 */
export function normalizeStoredRegions(input: unknown): RegionKey[] {
  if (!Array.isArray(input)) return [...ALL_REGIONS];
  const selected = new Set<RegionKey>();
  for (const value of input) {
    if (isKnownRegion(value)) selected.add(value);
  }
  return selected.size ? canonicalRegions(selected) : [...ALL_REGIONS];
}

/** 用于活动对局 key 与 database 列的稳定指纹，例如 "jp,kr"。 */
export function serializeRegions(regions: readonly RegionKey[]): string {
  return canonicalRegions(new Set(regions)).join(',');
}

function canonicalRegions(selected: ReadonlySet<RegionKey>): RegionKey[] {
  return [...selected].sort((a, b) => (REGION_ORDER.get(a) ?? 0) - (REGION_ORDER.get(b) ?? 0));
}
