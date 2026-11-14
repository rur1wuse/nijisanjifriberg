import { describe, expect, it } from 'vitest';
import {
  ALL_REGIONS,
  normalizeStoredRegions,
  parseRegions,
  serializeRegions,
} from '../src/regions';

describe('region selection', () => {
  it('treats an omitted selection as the full bank', () => {
    expect(parseRegions(undefined)).toEqual({ regions: [...ALL_REGIONS] });
    expect(parseRegions(null)).toEqual({ regions: [...ALL_REGIONS] });
  });

  it('deduplicates and canonicalises the order', () => {
    expect(parseRegions(['id', 'jp', 'id', 'kr'])).toEqual({ regions: ['jp', 'kr', 'id'] });
  });

  it('rejects unknown regions', () => {
    expect(parseRegions(['jp', 'en'])).toEqual({ error: 'INVALID_REGION' });
    expect(parseRegions('jp')).toEqual({ error: 'INVALID_REGION' });
  });

  it('rejects an explicit empty selection', () => {
    expect(parseRegions([])).toEqual({ error: 'REGION_REQUIRED' });
  });

  it('serializes a stable fingerprint', () => {
    expect(serializeRegions(['id', 'jp'])).toBe('jp,id');
    expect(serializeRegions([...ALL_REGIONS])).toBe('jp,kr,id');
  });

  it('normalizes legacy room snapshots to the full bank', () => {
    expect(normalizeStoredRegions(undefined)).toEqual([...ALL_REGIONS]);
    expect(normalizeStoredRegions([])).toEqual([...ALL_REGIONS]);
    expect(normalizeStoredRegions(['xx'])).toEqual([...ALL_REGIONS]);
    expect(normalizeStoredRegions(['kr', 'kr'])).toEqual(['kr']);
  });
});
