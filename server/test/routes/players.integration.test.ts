/**
 * nijisanjifriberg — Copyright (C) 2026 rur1wuse.
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import http from 'http';
import express from 'express';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import playersRoutes from '../../src/routes/players';
import { errorHandler } from '../../src/middleware/common';
import { db } from '../../src/db/knex';
import { initDb } from '../../src/db/init';
import { initRedis } from '../../src/redis';
import { initPlayerCache, invalidatePlayerCache } from '../../src/services/playerCache';

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  await initDb();
  await initRedis();
  await initPlayerCache();
  const app = express();
  app.use('/api/players', playersRoutes);
  app.use(errorHandler);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await db('players').whereLike('nickname', 'players-route-%').del();
  if (!server) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('GET /api/players', () => {
  it('returns the niji field set and never leaks removed CS columns', async () => {
    const stamp = Date.now();
    const nickname = `players-route-${stamp}`;
    const [row] = await db('players')
      .insert({
        nickname,
        gender: '女',
        debut_date: '2018-02-08',
        height_cm: '151cm',
        age_text: '16歳',
        collab_groups: JSON.stringify(['JK組', 'さんばかJK組']),
        race: '人类',
        is_enabled: true,
      })
      .returning('id');
    const id = typeof row === 'object' ? row.id : row;
    await invalidatePlayerCache();

    const response = await fetch(`${baseUrl}/api/players?search=${encodeURIComponent(nickname)}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<Record<string, unknown>>;
    const found = body.find((player) => player.id === id);

    expect(found).toBeDefined();
    expect(found).toMatchObject({
      id,
      nickname,
      gender: '女',
      debutDate: '2018-02-08',
      height: '151cm',
      age: '16歳',
      collab: 'JK組、さんばかJK組',
      race: '人类',
    });
    for (const removed of [
      'nationality',
      'region',
      'team',
      'role',
      'majorChampionships',
      'majorAppearances',
      'isActive',
      'debut_date',
      'height_cm',
      'age_text',
      'collab_groups',
    ]) {
      expect(found).not.toHaveProperty(removed);
    }
  });

  it('returns only id and nickname when suggest=1', async () => {
    const response = await fetch(`${baseUrl}/api/players?suggest=1`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<Record<string, unknown>>;
    expect(body.length).toBeGreaterThan(0);
    for (const player of body) {
      expect(Object.keys(player).sort()).toEqual(['id', 'nickname']);
    }
  });
});
