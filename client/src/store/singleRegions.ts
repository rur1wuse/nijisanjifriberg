/**
 * 新增文件：nijisanjifriberg 单人题库选择的本地持久化。
 * Copyright (C) 2026 rur1wuse。以 AGPL-3.0 发布，详见 LICENSE / COPYRIGHT.md。
 */
import { RegionKey, normalizeRegionSelection } from '../config/regions';

const STORAGE_KEY = 'nijisanjifriberg.single-regions';

export function getStoredSingleRegions(): RegionKey[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeRegionSelection(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function setStoredSingleRegions(regions: readonly RegionKey[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(regions));
  } catch {
    // Storage can be unavailable in strict privacy modes.
  }
}
