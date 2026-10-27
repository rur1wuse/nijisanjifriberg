import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initRedis, redis, redisKey } from '../../src/redis';
import { db } from '../../src/db/knex';
import { ensureSchema } from '../../src/db/schema';
import {
  getDifficultyPlayers,
  getPublicPlayerList,
  isDifficultyAvailable,
  invalidatePlayerCache,
  pickCachedTarget,
  refreshPlayerCache,
  searchCachedPlayers,
} from '../../src/services/playerCache';

function cacheTestPlayer(nickname: string, overrides: Record<string, unknown> = {}) {
  return {
    nickname,
    gender: '女',
    debut_date: '2018-02-08',
    height_cm: '151cm',
    age_text: '16歳',
    collab_groups: JSON.stringify(['テスト組']),
    race: '人类',
    is_enabled: true,
    ...overrides,
  };
}

async function insertCacheTestPlayer(
  nickname: string,
  overrides: Record<string, unknown> = {}
): Promise<number> {
  const [row] = await db('players').insert(cacheTestPlayer(nickname, overrides)).returning('id');
  const id = typeof row === 'object' ? row.id : row;
  await db('player_difficulties').insert({ player_id: id, difficulty_key: 'normal' });
  return id;
}

beforeAll(async () => {
  await ensureSchema();
  await initRedis();
});

afterAll(async () => {
  await db('players').whereLike('nickname', 'cache-test-%').del();
});

describe('player cache invalidation', () => {
  it('removes a disabled player before invalidation returns and changes the list version', async () => {
    const nickname = `cache-test-${Date.now()}`;
    const id = await insertCacheTestPlayer(nickname);

    await refreshPlayerCache();
    const before = await getPublicPlayerList();
    expect(before.players).toContainEqual({ id, nickname });

    await db('players').where({ id }).update({ is_enabled: false });
    await invalidatePlayerCache();

    const after = await getPublicPlayerList();
    expect(after.version).not.toBe(before.version);
    expect(after.players).not.toContainEqual({ id, nickname });
  });

  it('refreshes a stale instance before serving the public list', async () => {
    const nickname = `cache-test-cross-instance-${Date.now()}`;
    const id = await insertCacheTestPlayer(nickname);

    await refreshPlayerCache();
    expect((await getPublicPlayerList()).players).toContainEqual({ id, nickname });

    await db('players').where({ id }).update({ is_enabled: false });
    await redis()!.incr(redisKey('players:revision'));

    expect((await getPublicPlayerList()).players).not.toContainEqual({ id, nickname });
  });
});

describe('player cache pool', () => {
  it('serves every enabled player from the only difficulty pool', async () => {
    const nickname = `cache-test-normal-${Date.now()}`;
    const id = await insertCacheTestPlayer(nickname);

    await refreshPlayerCache();

    const enabledCount = Number(
      (await db('players').where({ is_enabled: true }).count({ count: '*' }).first())?.count ?? 0
    );
    expect(isDifficultyAvailable('normal')).toBe(true);
    expect(getDifficultyPlayers('normal')).toHaveLength(enabledCount);
    expect(getDifficultyPlayers('normal').map((player) => player.id)).toContain(id);
    expect(pickCachedTarget('normal')).not.toBeNull();
  });

  it('indexes players by nickname and race so either term is searchable', async () => {
    const nickname = `cache-test-search-${Date.now()}`;
    const race = `検索専用種族${Date.now()}`;
    const id = await insertCacheTestPlayer(nickname, { race });

    await refreshPlayerCache();

    expect(searchCachedPlayers(nickname, 100).map((player) => player.id)).toContain(id);
    expect(searchCachedPlayers(race, 100).map((player) => player.id)).toContain(id);
  });
});
