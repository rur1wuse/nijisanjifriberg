const UNIT_MULTIPLIERS: Record<string, number> = {
  兆: 1e12,
  億: 1e8,
  万: 1e4,
  千: 1e3,
};

const AGE_UNKNOWN_PATTERN = /不[明详詳]|非公開|秘密/;

const NUMBER_WITH_UNIT = /(\d+(?:\.\d+)?)\s*([兆億万千])?/;

export function isUnknownAge(value: string | null | undefined): boolean {
  return AGE_UNKNOWN_PATTERN.test(value ?? '');
}

/**
 * 取字符串中第一个数值并按单位放大: `142億歳` -> 14200000000。
 * 单独截取数字会把「億歳」当成 142 岁,方向箭头会整体颠倒。
 */
export function parseScaledNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = NUMBER_WITH_UNIT.exec(value);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = match[2];
  return unit ? amount * UNIT_MULTIPLIERS[unit] : amount;
}

export function parseAge(value: string | null | undefined): number | null {
  if (isUnknownAge(value)) return null;
  return parseScaledNumber(value);
}

export function parseHeightCm(value: string | null | undefined): number | null {
  return parseScaledNumber(value);
}

/** 出道日按 UTC 日计算天数差,用于「相差一年内」判定。 */
export function parseDateToDay(value: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? '').trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(utc) ? null : Math.floor(utc / 86_400_000);
}

export const DEBUT_CLOSE_DAYS = 365;
export const HEIGHT_CLOSE_CM = 5;
export const AGE_CLOSE_YEARS = 5;
