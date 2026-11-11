import { describe, expect, it } from 'vitest';
import { normalizeCollabGroups } from '../../src/services/teamHistory';
import NOTES from '../../src/db/seeds/collabLegacyNotes.json';

describe('normalizeCollabGroups', () => {
  it('strips wiki footnote markers and dedupes names', () => {
    expect(
      normalizeCollabGroups(
        JSON.stringify(['内股ガニ股*16 / やしチャイ*17', 'Aチーム*22', 'Aチーム*23', '（雑*59）', 'JK組', ' JK組 '])
      )
    ).toEqual([
      { name: '内股ガニ股 / やしチャイ', note: NOTES['内股ガニ股*16 / やしチャイ*17'] },
      { name: 'Aチーム', note: NOTES['Aチーム*22'] },
      { name: 'Aチーム', note: NOTES['Aチーム*23'] },
      { name: '（雑）', note: NOTES['（雑*59）'] },
      { name: 'JK組' },
    ]);
  });

  it('keeps literal asterisks that are not footnote markers', () => {
    expect(normalizeCollabGroups(JSON.stringify(['レッドブルー ໒꒱·̩͙⋆.*']))).toEqual([
      { name: 'レッドブルー ໒꒱·̩͙⋆.*' },
    ]);
  });

  it('keeps same-name groups distinct by note and dedupes identical pairs', () => {
    expect(
      normalizeCollabGroups([
        { name: 'Aチーム', note: 'first' },
        { name: 'Aチーム', note: 'second' },
        { name: 'Aチーム', note: 'first' },
        { name: 'Aチーム' },
      ])
    ).toEqual([
      { name: 'Aチーム', note: 'first' },
      { name: 'Aチーム', note: 'second' },
      { name: 'Aチーム' },
    ]);
  });

  it('returns an empty list for invalid JSON', () => {
    expect(normalizeCollabGroups('not json')).toEqual([]);
  });
});
