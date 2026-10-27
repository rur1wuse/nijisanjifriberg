// End-to-end smoke test against a running server: solo, daily, leaderboard.
// Reuses the server's own PoW implementation so the solve always matches.

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const crypto = require('crypto');

const POW_ALGORITHM = 'csgofriberg-pow-v1';
const DOMAIN = Buffer.from(`${POW_ALGORITHM}\0`, 'ascii');

function nonceBuffer(nonce) {
  const value = Buffer.allocUnsafe(8);
  value.writeBigUInt64LE(nonce);
  return value;
}

function modifiedSha256(challenge, nonce) {
  const first = crypto
    .createHash('sha256')
    .update(DOMAIN)
    .update(challenge)
    .update(nonceBuffer(nonce))
    .digest();
  const mixed = Buffer.allocUnsafe(32);
  for (let i = 0; i < 32; i += 1) {
    mixed[i] = first[(i + 11) & 31] ^ first[i] ^ ((i * 29 + 0x5d) & 0xff);
  }
  return crypto.createHash('sha256').update(DOMAIN).update(mixed).digest();
}

function hasLeadingZeroBits(digest, difficulty) {
  const wholeBytes = Math.floor(difficulty / 8);
  for (let i = 0; i < wholeBytes; i += 1) if (digest[i] !== 0) return false;
  const remaining = difficulty & 7;
  return remaining === 0 || (digest[wholeBytes] & (0xff << (8 - remaining))) === 0;
}

const cookieJar = new Map();
const cookieHeader = () => [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

function storeCookies(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const line of raw) {
    const [pair] = line.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) cookieJar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

async function request(method, path, body, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const cookie = cookieHeader();
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  storeCookies(res);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

async function solvePow() {
  const ch = await request('POST', '/api/pow/challenge', {});
  if (ch.data?.valid) return ch.data;
  const { id, challenge, difficulty } = ch.data;
  if (!id || !challenge) throw new Error('unexpected challenge: ' + JSON.stringify(ch.data).slice(0, 300));
  const challengeBuf = Buffer.from(challenge, 'base64url');
  let nonce = 0n;
  const started = Date.now();
  for (;;) {
    if (hasLeadingZeroBits(modifiedSha256(challengeBuf, nonce), difficulty)) break;
    nonce += 1n;
    if (Date.now() - started > 120_000) throw new Error('pow timeout');
  }
  const verify = await request('POST', '/api/pow/verify', { id, nonce: nonce.toString() });
  if (verify.status >= 400) throw new Error(`pow verify ${verify.status}: ${JSON.stringify(verify.data)}`);
  return verify.data;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
}

const NIJI_KEYS = ['gender', 'debutDate', 'height', 'age', 'collab', 'race'];
const LEGACY_KEYS = ['nationality', 'region', 'team', 'teamHistory', 'role', 'majorChampionships', 'majorAppearances', 'isActive'];

(async () => {
  console.log('=== SOLO ===');
  await solvePow();
  check('pow solved', true);

  const start = await request('POST', '/api/game/start', { mode: 'normal' });
  check('solo start 200', start.status === 200, `status=${start.status}`);
  const gameId = start.data?.gameId;
  check('solo returns gameId', Boolean(gameId));

  const suggest = await request('GET', '/api/players?suggest=1');
  check('suggest list 200', suggest.status === 200, `count=${suggest.data?.length}`);
  const pick = suggest.data?.[0];

  const guess = await request('POST', `/api/game/${gameId}/guess`, { playerId: pick.id });
  check('solo guess 200', guess.status === 200, `status=${guess.status}`);
  const attrs = guess.data?.feedback?.attributes;
  check('feedback has 6 attributes', Boolean(attrs) && Object.keys(attrs).length === 6, attrs ? Object.keys(attrs).join(',') : 'none');

  const giveup = await request('POST', `/api/game/${gameId}/giveup`);
  check('solo giveup 200', giveup.status === 200, `status=${giveup.status}`);
  const answer = giveup.data?.answer;
  check('answer has 6 niji fields', Boolean(answer) && NIJI_KEYS.every((k) => k in answer), answer ? Object.keys(answer).join(',') : 'none');
  check('answer has no legacy fields', Boolean(answer) && !LEGACY_KEYS.some((k) => k in answer));

  console.log('\n=== PLAYER SEARCH ===');
  const search = await request('GET', '/api/players?search=' + encodeURIComponent(pick.nickname));
  check('players search 200', search.status === 200, `status=${search.status}`);
  const info = search.data?.[0];
  check('search result uses niji fields', Boolean(info) && NIJI_KEYS.every((k) => k in info), info ? Object.keys(info).join(',') : 'none');
  check('search result has no legacy fields', Boolean(info) && !LEGACY_KEYS.some((k) => k in info));

  console.log('\n=== DAILY ===');
  const overview = await request('GET', '/api/daily-challenge/overview');
  check('overview 200', overview.status === 200, `status=${overview.status}`);
  const challenges = overview.data?.challenges ?? [];
  check('exactly 1 difficulty', challenges.length === 1, JSON.stringify(challenges));
  check('difficulty is normal', challenges[0]?.difficulty === 'normal');
  const dailyStart = await request('POST', '/api/daily-challenge/start', { difficulty: 'normal' });
  check('daily start 200', dailyStart.status === 200, `status=${dailyStart.status}`);
  check('daily gameId present', Boolean(dailyStart.data?.gameId));
  const dailyGuess = await request('POST', `/api/daily-challenge/${dailyStart.data.gameId}/guess`, { playerId: pick.id });
  check('daily guess 200', dailyGuess.status === 200, `status=${dailyGuess.status}`);
  // The board is guarded until the attempt is finished, so a fresh visitor must get 409.
  const dailyBoard = await request('GET', '/api/daily-challenge/normal/leaderboard');
  check('daily leaderboard guarded until finished',
    dailyBoard.status === 409 && dailyBoard.data?.code === 'DAILY_CHALLENGE_INCOMPLETE',
    `status=${dailyBoard.status} code=${dailyBoard.data?.code}`);

  console.log('\n=== LEADERBOARD ===');
  const lb = await request('GET', '/api/leaderboard?mode=single&difficulty=normal');
  check('leaderboard 200', lb.status === 200, `status=${lb.status}`);
  check('leaderboard difficulty echoed', lb.data?.difficulty === 'normal', String(lb.data?.difficulty));

  console.log('\n--- SUMMARY ---');
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) { console.log('FAILED:'); failed.forEach((r) => console.log('  - ' + r.name)); }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
