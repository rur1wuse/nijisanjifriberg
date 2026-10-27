const path = require('path');
const knex = require(path.resolve('node_modules/knex'));

const file = process.argv[2];
const db = knex({
  client: 'better-sqlite3',
  connection: { filename: file },
  useNullAsDefault: true,
});

(async () => {
  const expected = [
    'users', 'email_verifications', 'guest_accounts', 'players', 'difficulty_levels',
    'player_difficulties', 'games', 'match_records', 'match_players', 'match_reports',
    'report_whitelist', 'announcements', 'daily_challenges', 'daily_challenge_attempts',
  ];
  const removed = ['api_tokens', 'player_change_submissions', 'player_change_items'];

  const present = [];
  const missing = [];
  for (const t of expected) {
    (await db.schema.hasTable(t)) ? present.push(t) : missing.push(t);
  }
  const stillThere = [];
  for (const t of removed) {
    if (await db.schema.hasTable(t)) stillThere.push(t);
  }

  const players = Number((await db('players').count({ c: '*' }).first()).c);
  const enabled = Number((await db('players').where({ is_enabled: true }).count({ c: '*' }).first()).c);
  const levels = await db('difficulty_levels').pluck('key');
  const memberships = await db('player_difficulties').select('difficulty_key').count({ c: '*' }).groupBy('difficulty_key');

  console.log(`tables present: ${present.length}/${expected.length}`);
  if (missing.length) console.log(`MISSING TABLES: ${missing.join(', ')}`);
  if (stillThere.length) console.log(`LEGACY TABLES STILL PRESENT: ${stillThere.join(', ')}`);
  console.log(`players=${players} enabled=${enabled}`);
  console.log(`difficulty_levels=${JSON.stringify(levels)}`);
  console.log(`player_difficulties=${JSON.stringify(memberships)}`);

  const ok =
    !missing.length &&
    !stillThere.length &&
    players === 172 &&
    enabled === 172 &&
    levels.length === 1 &&
    levels[0] === 'normal' &&
    memberships.length === 1 &&
    String(memberships[0].difficulty_key) === 'normal' &&
    Number(memberships[0].c) === 172;

  console.log(ok ? 'FRESH DB OK' : 'FRESH DB PROBLEM');
  await db.destroy();
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
