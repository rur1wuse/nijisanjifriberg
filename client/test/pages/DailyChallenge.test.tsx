/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyChallenge from '../../src/pages/DailyChallenge';
import { renderAtRoute } from '../render';
import { api } from '../../src/api/client';

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client');
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn() },
  };
});

vi.mock('../../src/api/playerList', () => ({
  getPlayerList: vi.fn(async () => [{ id: 1, nickname: 's1mple' }]),
  subscribePlayerList: vi.fn(() => () => undefined),
  searchPlayerList: (list: Array<{ id: number; nickname: string }>, query: string) =>
    list.filter((item) => item.nickname.toLowerCase().includes(query.trim().toLowerCase())),
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

function detail(status: 'not_started' | 'won' = 'not_started', serverNow = 100_000) {
  return {
    data: {
      date: '2026-08-11',
      timeZone: 'Asia/Shanghai',
      serverNow,
      startsAt: 40_000,
      nextRefreshAt: serverNow + 60_000,
      challenge: {
        difficulty: 'normal',
        status,
        gameId: null,
        maxGuesses: 8,
        guessCount: status === 'won' ? 2 : 0,
        solveOrder: status === 'won' ? 1 : null,
        guesses: [],
        answer: status === 'won'
          ? { nickname: 'friberg', team: 'NIP', nationality: '瑞典' }
          : null,
      },
    },
  };
}

function leaderboard() {
  return {
    data: {
      difficulty: 'normal',
      leaderboard: [{ rank: 1, displayId: '访客#ABCDE', guessCount: 2, isCurrent: true }],
    },
  };
}

describe('DailyChallenge', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts the daily game selected by the route', async () => {
    get.mockResolvedValue(detail() as never);
    post.mockResolvedValue({
      data: { gameId: 'daily-1', difficulty: 'normal', status: 'playing', maxGuesses: 8, guesses: [] },
    } as never);
    renderAtRoute(<DailyChallenge />, { route: '/daily/normal', path: '/daily/:mode' });

    expect(await screen.findByText('每日挑战')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '完整版' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText('今日前十')).not.toBeInTheDocument();
    expect(screen.queryByText('该难度今天还没有通关记录')).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/daily-challenge/normal');

    await userEvent.click(screen.getByRole('button', { name: '开始挑战' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/daily-challenge/start', { difficulty: 'normal' }));
    expect(await screen.findByPlaceholderText('输入选手昵称...')).not.toBeDisabled();
  });

  it('calibrates the refresh countdown from server time instead of the system clock', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(9_999_999_999_999);
    get.mockResolvedValue(detail() as never);

    renderAtRoute(<DailyChallenge />, { route: '/daily/normal', path: '/daily/:mode' });

    const countdown = await screen.findByText(/后刷新/);
    expect(countdown).toHaveTextContent(/(?:00:01:00|00:00:5[89]) 后刷新/);
    expect(countdown).not.toHaveTextContent('00:00:00 后刷新');
  });

  it('renders the embedded top-ten result and current-player marker', async () => {
    get.mockImplementation(async (path) => {
      if (path === '/daily-challenge/normal/leaderboard') return leaderboard() as never;
      return detail('won') as never;
    });
    renderAtRoute(<DailyChallenge />, { route: '/daily/normal', path: '/daily/:mode' });

    expect(await screen.findByText('今日前十')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/daily-challenge/normal');
    expect(get).toHaveBeenCalledWith('/daily-challenge/normal/leaderboard');
    expect(screen.getByText('访客#ABCDE')).toBeInTheDocument();
    expect(screen.getByText('2 步')).toBeInTheDocument();
    expect(screen.getByText('我')).toBeInTheDocument();
    expect(screen.getByText('你是今天第 1 个猜出该难度答案的人')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看答案' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '查看答案' }));
    expect(screen.getAllByText('你是今天第 1 个猜出该难度答案的人')).toHaveLength(2);
  });
});
