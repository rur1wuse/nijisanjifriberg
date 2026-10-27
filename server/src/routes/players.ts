/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validateQuery } from '../middleware/common';
import { getPublicPlayerList, searchCachedPlayers } from '../services/playerCache';
import { rateLimit } from '../middleware/rateLimit';
import type { Player } from '../types';

const router = Router();

/** 客户端把 collab 当纯文本渲染，所以组合数组在这里拼成顿号分隔的字符串。 */
function playerInfoView(player: Player) {
  return {
    id: player.id,
    nickname: player.nickname,
    gender: player.gender,
    debutDate: player.debut_date,
    height: player.height_cm,
    age: player.age_text,
    collab: player.collab_groups.join('、'),
    race: player.race,
    difficulties: player.difficulties ?? [],
  };
}

const playerSearchQuery = z.object({
  search: z.string().trim().max(100).default(''),
  suggest: z.enum(['0', '1']).default('0').transform((value) => value === '1'),
});

router.get(
  '/list',
  asyncHandler(async (req, res) => {
    const list = await getPublicPlayerList();
    const etag = `\"players-${list.version}\"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('X-Player-List-Version', list.version);
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json(list);
  })
);

/**
 * 查选手 / 自动补全。
 * - ?search=xxx 模糊搜索昵称/种族
 * - ?suggest=1 仅返回 id+nickname(猜测输入补全用,不泄露属性)
 */
router.get(
  '/',
  rateLimit({
    name: 'player-search',
    limit: 10,
    windowSeconds: 60,
    failClosed: true,
  }),
  validateQuery(playerSearchQuery),
  asyncHandler(async (req, res) => {
    const { search, suggest } = req.query as unknown as z.infer<typeof playerSearchQuery>;

    const players = searchCachedPlayers(search, suggest ? 10 : 100);

    if (suggest) {
      return res.json(players.map((p) => ({ id: p.id, nickname: p.nickname })));
    }
    res.json(players.map(playerInfoView));
  })
);

export default router;
