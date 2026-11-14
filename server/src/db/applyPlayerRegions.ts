/**
 * 新增文件：把种子里的选手分部（region）回写到已有数据库。
 * Copyright (C) 2026 rur1wuse。以 AGPL-3.0 发布，详见 LICENSE / COPYRIGHT.md。
 *
 * migrate/seed 只在 players 表为空时导入种子，因此存量库需要单独执行：
 *   node server/dist/db/applyPlayerRegions.js            # dry-run，只报告差异
 *   node server/dist/db/applyPlayerRegions.js --apply    # 只更新 region 一列，幂等
 */
import { db } from './knex';
import { closeRedis, initRedis } from '../redis';
import { isKnownRegion } from '../regions';
import { invalidatePlayerCache } from '../services/playerCache';
import playersData from './seeds/players.json';

interface SeedPlayer {
  nickname: string;
  region?: string;
}

interface ChangedPlayer {
  id: number;
  nickname: string;
  current: string;
  desired: string;
}

const seedPlayers = playersData as SeedPlayer[];

function printChanges(changes: ChangedPlayer[], limit = 200): void {
  for (const change of changes.slice(0, limit)) {
    console.log(`[region-sync] ${change.nickname}: ${change.current || '(none)'} -> ${change.desired}`);
  }
  if (changes.length > limit) console.log(`[region-sync] ... ${changes.length - limit} more`);
}

async function refreshRedisCaches(): Promise<void> {
  try {
    const ready = await initRedis();
    if (!ready) {
      console.warn('[region-sync] Redis unavailable; running instances keep the old cache until restart');
      return;
    }
    await invalidatePlayerCache();
    console.log('[region-sync] player cache invalidated');
  } catch (error) {
    console.warn(
      '[region-sync] cache invalidation failed; restart app instances to reload player data:',
      error instanceof Error ? error.message : error
    );
  } finally {
    await closeRedis().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? '--dry-run';
  if (!['--dry-run', '--apply', 'apply'].includes(mode)) {
    console.error('usage: applyPlayerRegions.js [--dry-run|--apply]');
    process.exitCode = 2;
    await db.destroy();
    return;
  }
  const apply = mode === '--apply' || mode === 'apply';

  const desiredByNickname = new Map<string, string>();
  for (const player of seedPlayers) {
    if (isKnownRegion(player.region)) desiredByNickname.set(player.nickname, player.region);
  }

  const rows = await db('players').select('id', 'nickname', 'region');
  const changes: ChangedPlayer[] = [];
  let missingSeeds = 0;

  for (const row of rows) {
    const nickname = String(row.nickname);
    const desired = desiredByNickname.get(nickname);
    if (!desired) {
      missingSeeds += 1;
      continue;
    }
    const current = String(row.region ?? '');
    if (current === desired) continue;
    changes.push({ id: Number(row.id), nickname, current, desired });
  }

  printChanges(changes);

  if (apply && changes.length > 0) {
    await db.transaction(async (trx) => {
      for (const change of changes) {
        await trx('players').where({ id: change.id }).update({ region: change.desired });
      }
    });
    await refreshRedisCaches();
  }

  console.log(
    `[region-sync] mode=${apply ? 'apply' : 'dry-run'} players=${rows.length} `
    + `changed=${changes.length} missing_seed=${missingSeeds}`
  );

  await db.destroy();
}

main().catch(async (error) => {
  console.error('[region-sync]', error instanceof Error ? error.message : error);
  await db.destroy().catch(() => undefined);
  process.exitCode = 1;
});
