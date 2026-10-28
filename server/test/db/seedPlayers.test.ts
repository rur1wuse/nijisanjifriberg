/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import knex from 'knex';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureSchema } from '../../src/db/schema';
import {
  backfillEmptySeedPlayerAttributes,
  insertMissingSeedPlayers,
} from '../../src/db/seedPlayers';
import seedPlayers from '../../src/db/seeds/players.json';

const instances: ReturnType<typeof knex>[] = [];

afterEach(async () => {
  await Promise.all(instances.splice(0).map((instance) => instance.destroy()));
});

describe('baseline player seeds', () => {
  it('inserts every seed player once with normal difficulty membership', async () => {
    const instance = knex({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });
    instances.push(instance);
    await ensureSchema(instance);

    const total = seedPlayers.length;
    expect(total).toBeGreaterThan(0);

    expect(await insertMissingSeedPlayers(instance)).toBe(total);
    expect(await insertMissingSeedPlayers(instance)).toBe(0);
    expect(Number((await instance('players').count({ count: '*' }).first())?.count)).toBe(total);

    const player = await instance('players').where({ nickname: seedPlayers[0].nickname }).first();
    expect(player.gender).toBe(seedPlayers[0].gender);
    expect(player.debut_date).toBe(seedPlayers[0].debut_date);
    expect(JSON.parse(player.collab_groups)).toEqual(seedPlayers[0].collab_groups);
    expect(await instance('player_difficulties')
      .where({ player_id: player.id })
      .pluck('difficulty_key'))
      .toEqual(['normal']);
  });

  it('backfills only empty attributes and keeps values edited in the admin panel', async () => {
    const instance = knex({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });
    instances.push(instance);
    await ensureSchema(instance);
    await insertMissingSeedPlayers(instance);

    const target = seedPlayers[0];
    await instance('players').where({ nickname: target.nickname }).update({
      height_cm: '',
      race: '管理员改过的种族',
    });

    const updated = await backfillEmptySeedPlayerAttributes(instance);
    expect(updated).toBe(1);

    const player = await instance('players').where({ nickname: target.nickname }).first();
    expect(player.height_cm).toBe(target.height_cm);
    expect(player.race).toBe('管理员改过的种族');

    expect(await backfillEmptySeedPlayerAttributes(instance)).toBe(0);
  });
});
