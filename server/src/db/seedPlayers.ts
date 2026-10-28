/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import type { Knex } from 'knex';
import { db } from './knex';
import playersData from './seeds/players.json';

interface SeedPlayer {
  nickname: string;
  name_zh?: string;
  gender: string;
  debut_date: string;
  height_cm: string;
  age_text: string;
  race: string;
  collab_groups: string[];
  difficulties?: string[];
  is_enabled?: boolean;
}

const seedPlayers = playersData as SeedPlayer[];

function difficulties(player: SeedPlayer): string[] {
  return player.difficulties?.length ? [...new Set(player.difficulties)] : ['normal'];
}

export async function insertMissingSeedPlayers(instance: Knex = db): Promise<number> {
  const existing = new Set(
    (await instance('players').select('nickname')).map((player) => String(player.nickname))
  );
  const additions = seedPlayers.filter((player) => !existing.has(player.nickname));
  if (!additions.length) return 0;

  await instance.transaction(async (trx) => {
    const inserted = await trx('players')
      .insert(additions.map((player) => ({
        nickname: player.nickname,
        name_zh: player.name_zh ?? '',
        gender: player.gender ?? '',
        debut_date: player.debut_date ?? '',
        height_cm: player.height_cm ?? '',
        age_text: player.age_text ?? '',
        collab_groups: JSON.stringify(player.collab_groups ?? []),
        race: player.race ?? '',
        is_enabled: player.is_enabled ?? true,
      })))
      .returning(['id', 'nickname']);
    const seedByNickname = new Map(additions.map((player) => [player.nickname, player]));
    const memberships = inserted.flatMap((player) => {
      const seed = seedByNickname.get(String(player.nickname));
      return seed
        ? difficulties(seed).map((difficultyKey) => ({
            player_id: player.id,
            difficulty_key: difficultyKey,
          }))
        : [];
    });
    if (memberships.length) {
      await trx('player_difficulties')
        .insert(memberships)
        .onConflict(['player_id', 'difficulty_key'])
        .ignore();
    }
  });
  return additions.length;
}

export async function seedPlayersIfEmpty(instance: Knex = db): Promise<number> {
  const row = await instance('players').count<{ count: number | string }[]>({ count: '*' });
  if (Number(row[0]?.count ?? 0) > 0) return 0;
  return insertMissingSeedPlayers(instance);
}

/**
 * 为已存在的选手补写种子里的中文译名。只填当前为空的 name_zh,
 * 不覆盖管理员在后台改过的译名;返回实际更新的行数。
 */
export async function backfillSeedPlayerNamesZh(instance: Knex = db): Promise<number> {
  const rows = await instance('players').select('id', 'nickname', 'name_zh');
  const byNickname = new Map(seedPlayers.map((player) => [player.nickname, player.name_zh ?? '']));
  const updates = rows
    .map((row) => ({
      id: Number(row.id),
      name_zh: byNickname.get(String(row.nickname)) ?? '',
      current: String(row.name_zh ?? ''),
    }))
    .filter((row) => !row.current && row.name_zh);

  if (!updates.length) return 0;

  await instance.transaction(async (trx) => {
    for (const update of updates) {
      await trx('players').where({ id: update.id }).update({ name_zh: update.name_zh });
    }
  });
  return updates.length;
}
