import { db } from './knex';
import { closeRedis, initRedis } from '../redis';
import { invalidatePlayerCache } from '../services/playerCache';
import { collabGroupKey, normalizeCollabGroups, serializeCollabGroups } from '../services/teamHistory';
import type { CollabGroup } from '../types';
import playersData from './seeds/players.json';

interface SeedPlayer {
  nickname: string;
  collab_groups: CollabGroup[];
}

const seedPlayers = playersData as SeedPlayer[];

interface ChangedPlayer {
  id: number;
  nickname: string;
  current: CollabGroup[];
  desired: CollabGroup[];
}

function groupLabel(group: CollabGroup): string {
  return group.note ? `${group.name} (${group.note})` : group.name;
}

function printChanges(changes: ChangedPlayer[]): void {
  for (const change of changes) {
    console.log(`[collab-sync] ${change.nickname}`);
    const removed = change.current.filter(
      (group) => !change.desired.some((desired) => collabGroupKey(desired) === collabGroupKey(group))
    );
    const added = change.desired.filter(
      (group) => !change.current.some((current) => collabGroupKey(current) === collabGroupKey(group))
    );
    const lines = [
      ...added.map((group) => `  + ${groupLabel(group)}`),
      ...removed.map((group) => `  - ${groupLabel(group)}`),
    ];
    for (const line of lines.slice(0, 20)) console.log(line);
    if (lines.length > 20) console.log(`  ... ${lines.length - 20} more`);
  }
}

async function applyChanges(changes: ChangedPlayer[]): Promise<void> {
  await db.transaction(async (trx) => {
    for (const change of changes) {
      await trx('players')
        .where({ id: change.id })
        .update({ collab_groups: serializeCollabGroups(change.desired) });
    }
  });
}

async function refreshRedisCaches(): Promise<void> {
  try {
    const ready = await initRedis();
    if (!ready) {
      console.warn('[collab-sync] Redis unavailable; running instances keep the old cache until restart');
      return;
    }
    await invalidatePlayerCache();
    console.log('[collab-sync] player cache invalidated');
  } catch (error) {
    console.warn(
      '[collab-sync] cache invalidation failed; restart app instances to reload player data:',
      error instanceof Error ? error.message : error
    );
  } finally {
    await closeRedis().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? '--dry-run';
  if (!['--dry-run', '--apply', 'apply'].includes(mode)) {
    console.error('usage: applyCollabGroups.js [--dry-run|--apply]');
    process.exitCode = 2;
    await db.destroy();
    return;
  }
  const apply = mode === '--apply' || mode === 'apply';

  const desiredByNickname = new Map(
    seedPlayers.map((player) => [player.nickname, normalizeCollabGroups(player.collab_groups)])
  );
  const rows = await db('players').select('id', 'nickname', 'collab_groups');
  const changes: ChangedPlayer[] = [];
  let missingSeeds = 0;

  for (const row of rows) {
    const nickname = String(row.nickname);
    const desired = desiredByNickname.get(nickname);
    if (!desired) {
      missingSeeds += 1;
      continue;
    }
    const current = normalizeCollabGroups(row.collab_groups);
    if (JSON.stringify(current) === JSON.stringify(desired)) continue;
    changes.push({ id: Number(row.id), nickname, current, desired });
  }

  const skipped = seedPlayers.length - (rows.length - missingSeeds);
  let removed = 0;
  let added = 0;
  for (const change of changes) {
    const currentKeys = new Set(change.current.map(collabGroupKey));
    const desiredKeys = new Set(change.desired.map(collabGroupKey));
    removed += change.current.filter((group) => !desiredKeys.has(collabGroupKey(group))).length;
    added += change.desired.filter((group) => !currentKeys.has(collabGroupKey(group))).length;
  }

  printChanges(changes);
  if (skipped > 0) {
    console.log(`[collab-sync] skipped=${skipped} seed players are not present in the database`);
  }

  if (apply && changes.length > 0) {
    await applyChanges(changes);
    await refreshRedisCaches();
  }

  console.log(
    `[collab-sync] mode=${apply ? 'apply' : 'dry-run'} players=${rows.length} `
    + `changed=${changes.length} added=${added} removed=${removed} skipped=${skipped}`
  );

  await db.destroy();
}

main().catch(async (error) => {
  console.error('[collab-sync]', error instanceof Error ? error.message : error);
  await db.destroy().catch(() => undefined);
  process.exitCode = 1;
});
