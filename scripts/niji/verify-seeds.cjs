// Verify seeds/players.json matches the migrated database row for row.
const fs = require('fs');
const path = require('path');
const knex = require(path.resolve('node_modules/knex'));

const seeds = JSON.parse(fs.readFileSync('src/db/seeds/players.json', 'utf8')).sort(
  (a, b) => a.nickname.localeCompare(b.nickname)
);

const db = knex({
  client: 'better-sqlite3',
  connection: { filename: './data/csgofriberg.sqlite3' },
  useNullAsDefault: true,
});

(async () => {
  const rows = await db('players')
    .select('nickname', 'gender', 'debut_date', 'height_cm', 'age_text', 'collab_groups', 'race', 'is_enabled')
    .orderBy('nickname');

  const problems = [];
  if (rows.length !== seeds.length) {
    problems.push(`count mismatch: db=${rows.length} seeds=${seeds.length}`);
  }
  const byNick = new Map(rows.map((r) => [String(r.nickname), r]));

  for (const seed of seeds) {
    const row = byNick.get(seed.nickname);
    if (!row) {
      problems.push(`missing in db: ${seed.nickname}`);
      continue;
    }
    for (const field of ['gender', 'debut_date', 'height_cm', 'age_text', 'race']) {
      if (String(row[field] ?? '') !== String(seed[field] ?? '')) {
        problems.push(`${seed.nickname}.${field}: db="${row[field]}" seed="${seed[field]}"`);
      }
    }
    const dbCollabs = JSON.parse(row.collab_groups);
    if (JSON.stringify(dbCollabs) !== JSON.stringify(seed.collab_groups)) {
      problems.push(`${seed.nickname}.collab_groups: db=${dbCollabs.length} seed=${seed.collab_groups.length}`);
    }
    if (Boolean(row.is_enabled) !== (seed.is_enabled ?? true)) {
      problems.push(`${seed.nickname}.is_enabled mismatch`);
    }
  }

  const dupes = seeds.map((s) => s.nickname).filter((n, i, arr) => arr.indexOf(n) !== i);
  if (dupes.length) problems.push(`duplicate nicknames in seeds: ${dupes.join(', ')}`);

  const totalCollabs = seeds.reduce((sum, s) => sum + s.collab_groups.length, 0);
  const maxCollabs = Math.max(...seeds.map((s) => s.collab_groups.length));

  console.log(`seeds=${seeds.length} db=${rows.length}`);
  console.log(`collab_groups total=${totalCollabs} max=${maxCollabs}`);
  console.log(problems.length ? `PROBLEMS(${problems.length}):\n` + problems.slice(0, 20).join('\n') : 'MATCH: seeds and db are identical');

  await db.destroy();
  process.exit(problems.length ? 1 : 0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
