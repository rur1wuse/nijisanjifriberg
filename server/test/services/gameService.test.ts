/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import { describe, it, expect } from 'vitest';
import { compareGuess } from '../../src/services/gameService';
import { Player } from '../../src/types';
import {
  isUnknownAge,
  parseAge,
  parseHeightCm,
  parseScaledNumber,
} from '../../src/services/attributeParsing';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    nickname: 'test',
    gender: '女',
    debut_date: '2018-02-08',
    height_cm: '151cm',
    age_text: '16歳',
    collab_groups: [],
    race: '人类',
    is_enabled: true,
    created_at: '',
    ...overrides,
  };
}

describe('parseScaledNumber', () => {
  it('把億换算成真实数值，而不是截成 142', () => {
    expect(parseScaledNumber('142億歳')).toBe(142_000_000_00);
  });

  it('支持 万 / 千', () => {
    expect(parseScaledNumber('3万歳')).toBe(30_000);
    expect(parseScaledNumber('2千歳')).toBe(2_000);
  });

  it('取第一个数值并保留小数', () => {
    expect(parseScaledNumber('20.4歳')).toBe(20.4);
    expect(parseScaledNumber('777.00001歳')).toBe(777.00001);
    expect(parseScaledNumber('20代（按20算）')).toBe(20);
    expect(parseScaledNumber('23歳？')).toBe(23);
  });

  it('无法解析时返回 null', () => {
    expect(parseScaledNumber('')).toBeNull();
    expect(parseScaledNumber('非公開')).toBeNull();
  });
});

describe('age helpers', () => {
  it('识别年龄不详', () => {
    for (const value of ['不明', '不詳', '不详', '非公開', '秘密', '年齢不詳']) {
      expect(isUnknownAge(value)).toBe(true);
    }
    expect(isUnknownAge('20代（按20算）')).toBe(false);
  });

  it('年龄不详不参与数值解析', () => {
    expect(parseAge('不明')).toBeNull();
    expect(parseAge('16歳')).toBe(16);
  });

  it('身高解析出厘米数值', () => {
    expect(parseHeightCm('151cm')).toBe(151);
    expect(parseHeightCm('158cm (＋ヒール7cm)')).toBe(158);
    expect(parseHeightCm('')).toBeNull();
  });
});

describe('compareGuess', () => {
  const target = makePlayer({ id: 10, nickname: 'target', collab_groups: ['JK組'] });

  it('猜中时所有属性 correct', () => {
    const fb = compareGuess(target, target);
    expect(fb.correct).toBe(true);
    expect(Object.values(fb.attributes).every((a) => a.level === 'correct')).toBe(true);
  });

  it('性别相同绿、不同红', () => {
    expect(compareGuess(makePlayer({ id: 2 }), target).attributes.gender.level).toBe('correct');
    expect(compareGuess(makePlayer({ id: 2, gender: '男' }), target).attributes.gender.level)
      .toBe('wrong');
  });

  it('种族相同绿、不同红', () => {
    expect(compareGuess(makePlayer({ id: 2 }), target).attributes.race.level).toBe('correct');
    expect(compareGuess(makePlayer({ id: 2, race: '精灵' }), target).attributes.race.level)
      .toBe('wrong');
  });

  it('出道日相同为绿', () => {
    expect(compareGuess(makePlayer({ id: 2 }), target).attributes.debutDate.level).toBe('correct');
  });

  it('出道日相差一年内为黄并带方向', () => {
    const guess = makePlayer({ id: 2, debut_date: '2019-01-15' });
    const fb = compareGuess(guess, target).attributes.debutDate;
    expect(fb.level).toBe('close');
    expect(fb.hint).toBe('higher');
  });

  it('出道日超过一年为灰并带方向', () => {
    const guess = makePlayer({ id: 2, debut_date: '2019-06-01' });
    const fb = compareGuess(guess, target).attributes.debutDate;
    expect(fb.level).toBe('gray');
    expect(fb.hint).toBe('higher');
  });

  it('答案出道更晚时箭头向下', () => {
    const fb = compareGuess(target, makePlayer({ id: 3, debut_date: '2019-01-15' })).attributes.debutDate;
    expect(fb.hint).toBe('lower');
  });

  it('身高相差 5cm 内为黄，超出为灰', () => {
    const close = makePlayer({ id: 2, height_cm: '156cm' });
    expect(compareGuess(close, target).attributes.height.level).toBe('close');

    const far = makePlayer({ id: 2, height_cm: '160cm' });
    const fb = compareGuess(far, target).attributes.height;
    expect(fb.level).toBe('gray');
    expect(fb.hint).toBe('lower');
  });

  it('身高无法解析时为灰且不带方向', () => {
    const guess = makePlayer({ id: 2, height_cm: '' });
    const fb = compareGuess(guess, target).attributes.height;
    expect(fb.level).toBe('gray');
    expect(fb.hint).toBeUndefined();
  });

  it('年龄相差 5 岁内为黄，超出为灰', () => {
    const close = makePlayer({ id: 2, age_text: '21歳' });
    expect(compareGuess(close, target).attributes.age.level).toBe('close');

    const far = makePlayer({ id: 2, age_text: '22歳' });
    const fb = compareGuess(far, target).attributes.age;
    expect(fb.level).toBe('gray');
    expect(fb.hint).toBe('lower');
  });

  it('双方任一年龄不详时显示紫色', () => {
    const guessUnknown = makePlayer({ id: 2, age_text: '不明' });
    expect(compareGuess(guessUnknown, target).attributes.age.level).toBe('unknown');

    const targetUnknown = makePlayer({ id: 11, age_text: '非公開' });
    expect(compareGuess(makePlayer({ id: 2 }), targetUnknown).attributes.age.level)
      .toBe('unknown');
  });

  it('142億歳 与普通年龄比较时方向正确', () => {
    const bigAge = makePlayer({ id: 12, age_text: '142億歳' });
    const fb = compareGuess(makePlayer({ id: 2, age_text: '16歳' }), bigAge).attributes.age;
    expect(fb.level).toBe('gray');
    expect(fb.hint).toBe('higher');
  });

  it('有共同组合为绿，没有则为红', () => {
    const a = makePlayer({ id: 2, collab_groups: ['JK組', 'さんばかJK組'] });
    const b = makePlayer({ id: 3, collab_groups: ['さんばかJK組', 'Twinkle'] });
    expect(compareGuess(a, b).attributes.collab.level).toBe('correct');

    const c = makePlayer({ id: 4, collab_groups: ['Twinkle'] });
    expect(compareGuess(a, c).attributes.collab.level).toBe('wrong');
  });

  it('组合交集会列出共同组合', () => {
    const a = makePlayer({ id: 2, collab_groups: ['JK組', 'さんばかJK組'] });
    const b = makePlayer({ id: 3, collab_groups: ['さんばかJK組', 'Twinkle'] });
    expect(compareGuess(a, b).attributes.collab.value).toBe('さんばかJK組');
  });

  it('没有共同组合时组合值为空', () => {
    const a = makePlayer({ id: 2, collab_groups: ['JK組'] });
    const c = makePlayer({ id: 4, collab_groups: ['Twinkle'] });
    expect(compareGuess(a, c).attributes.collab.value).toBe('');
  });
});
