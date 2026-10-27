/**
 * nijisanjifriberg — Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
// Compare i18n key sets across locales by importing the real module.
// Run from the repo root with tsx so TypeScript is transpiled on the fly.
import { resources } from '../../client/src/i18n/resources';

type Dict = Record<string, unknown>;

function flatten(obj: Dict, prefix = '', out: Set<string> = new Set()): Set<string> {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value as Dict, path, out);
    } else {
      out.add(path);
    }
  }
  return out;
}

const locales = Object.keys(resources) as Array<keyof typeof resources>;
const flat = new Map<string, Set<string>>();
for (const locale of locales) {
  flat.set(locale, flatten(resources[locale].translation as Dict));
}

const base = locales[0];
const baseKeys = flat.get(base)!;
console.log(`locales: ${locales.join(', ')}`);
console.log(`key counts: ${locales.map((l) => `${l}=${flat.get(l)!.size}`).join('  ')}`);
console.log('---');

let failed = false;
for (const locale of locales) {
  if (locale === base) continue;
  const keys = flat.get(locale)!;
  const missing = [...baseKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !baseKeys.has(k));
  if (missing.length) {
    failed = true;
    console.log(`[${locale}] MISSING ${missing.length}:`);
    missing.slice(0, 40).forEach((k) => console.log(`  - ${k}`));
  }
  if (extra.length) {
    failed = true;
    console.log(`[${locale}] EXTRA ${extra.length} (not in ${base}):`);
    extra.slice(0, 40).forEach((k) => console.log(`  + ${k}`));
  }
  if (!missing.length && !extra.length) {
    console.log(`[${locale}] OK - identical key set to ${base}`);
  }
}

// Empty-string values usually mean a placeholder that was never translated.
console.log('---');
for (const locale of locales) {
  const empties: string[] = [];
  const walk = (obj: Dict, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) walk(value as Dict, path);
      else if (typeof value === 'string' && !value.trim()) empties.push(path);
    }
  };
  walk(resources[locale].translation as Dict);
  console.log(`[${locale}] empty strings: ${empties.length}${empties.length ? ' -> ' + empties.join(', ') : ''}`);
}

console.log(failed ? 'RESULT: KEY SETS DIFFER' : 'RESULT: ALL LOCALES CONSISTENT');
process.exit(failed ? 1 : 0);
