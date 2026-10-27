/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../src/api/client';
import i18n from '../../../src/i18n';
import { renderWithProviders } from '../../render';
import AdminUsers, { AdminGuests } from '../../../src/components/admin/AdminUsers';

vi.mock('../../../src/api/client', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
  errMsg: vi.fn(() => 'request failed'),
}));

describe('AdminUsers', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('zh');
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/admin/users') return { data: { users: [{ id: 7, username: 'ranked-user', displayId: '用户#ABCDE', role: 'user', leaderboardHidden: false, matchmakingRestricted: false, createdAt: '2026-07-27T00:00:00.000Z' }], total: 1, page: 1, pageSize: 50, totalPages: 1 } } as never;
      if (url === '/admin/users/7/stats') return { data: { user: { id: 7 }, stats: { single: { games: 2, wins: 1, losses: 1, winRate: 0.5, avgGuesses: 2, bestGuesses: 2 }, multi: { games: 3, wins: 2, losses: 1, winRate: 0.667, recentAverageWinningGuesses: 1.5 } } } } as never;
      if (url === '/admin/users/7/leaderboards') return { data: { leaderboardHidden: false, entries: Array.from({ length: 2 }, (_, index) => ({ mode: index ? 'multi' : 'single', difficulty: 'normal', rank: index + 1, totalRanked: 10, total: 2, wins: 1, winRate: 0.5, avgGuesses: 2 })) } } as never;
      if (url === '/admin/guests') return { data: { guests: [{ id: 9, displayId: '访客#ABCDE', banned: false, createdAt: '2026-07-27T00:00:00.000Z', lastSeenAt: '2026-07-28T00:00:00.000Z' }], total: 1, page: 1, pageSize: 50, totalPages: 1 } } as never;
      if (url === '/admin/guests/9/stats') return { data: { stats: { single: { games: 0, wins: 0, losses: 0, winRate: 0, avgGuesses: 0, bestGuesses: null }, multi: { games: 0, wins: 0, losses: 0, winRate: 0, recentAverageWinningGuesses: null } } } } as never;
      return { data: { items: [], hasNext: false, page: 1, pageSize: 10 } } as never;
    });
    vi.mocked(api.patch).mockResolvedValue({
      data: { id: 7, leaderboardHidden: true },
    } as never);
  });

  it('opens one details action with three lazy-loaded tabs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminUsers />);

    expect(await screen.findByRole('button', { name: /详情/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /详情/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '查看战绩' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '对局记录' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '排行榜' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '对局分析' })).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/admin/users/7/stats');

    await user.click(screen.getByRole('tab', { name: '排行榜' }));
    expect(await screen.findByText('#1')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/admin/users/7/leaderboards');
  });

  it('updates leaderboard visibility from the details tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminUsers />);
    await user.click(await screen.findByRole('button', { name: /详情/ }));
    await user.click(screen.getByRole('tab', { name: '排行榜' }));
    const toggle = await screen.findByRole('checkbox');
    expect(toggle).toBeChecked();

    await user.click(toggle);

    expect(api.patch).toHaveBeenCalledWith('/admin/users/7/leaderboard-visibility', { hidden: true });
    expect(screen.getAllByText('已隐藏').length).toBeGreaterThanOrEqual(1);
  });

  it('restricts multiplayer matchmaking from the quick management tab', async () => {
    const user = userEvent.setup();
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: { id: 7, matchmakingRestricted: true },
    } as never);
    renderWithProviders(<AdminUsers />);
    await user.click(await screen.findByRole('button', { name: /详情/ }));
    await user.click(screen.getByRole('tab', { name: '快捷管理' }));
    const toggle = await screen.findByRole('checkbox', { name: '正常匹配' });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    expect(api.patch).toHaveBeenCalledWith('/admin/users/7/matchmaking-restriction', { restricted: true });
    expect(screen.getByRole('checkbox', { name: '已限制' })).toBeChecked();
    expect(screen.queryByText(/隔离匹配池/)).not.toBeInTheDocument();
  });

  it('keeps guest management limited to banning', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminGuests />);
    await user.click(await screen.findByRole('button', { name: /详情/ }));
    await user.click(screen.getByRole('tab', { name: '快捷管理' }));

    expect(screen.queryByText('多人匹配限制')).not.toBeInTheDocument();
    const toggle = screen.getByRole('checkbox', { name: '正常' });
    await user.click(toggle);

    expect(api.patch).toHaveBeenCalledWith('/admin/guests/9/ban', { banned: true });
  });
});
