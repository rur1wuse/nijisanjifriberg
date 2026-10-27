import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyLobby from '../../src/pages/DailyLobby';
import { api } from '../../src/api/client';
import { renderAtRoute } from '../render';

vi.mock('../../src/api/client', () => ({
  api: { get: vi.fn() },
  errMsg: vi.fn(() => '请求失败'),
}));

const get = vi.mocked(api.get);

function overview() {
  return {
    data: {
      date: '2026-08-11',
      timeZone: 'Asia/Shanghai',
      serverNow: 100_000,
      startsAt: 40_000,
      nextRefreshAt: 160_000,
      challenges: [
        { difficulty: 'normal', status: 'not_started' },
      ],
    },
  };
}

describe('DailyLobby', () => {
  beforeEach(() => {
    localStorage.clear();
    get.mockReset();
    get.mockResolvedValue(overview() as never);
  });

  it('shows the single daily difficulty and its current status', async () => {
    renderAtRoute(<DailyLobby />, { route: '/daily', path: '/daily' });

    expect(await screen.findByText('每日挑战', { selector: '.title' })).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/daily-challenge/overview');
    expect(screen.getByRole('button', { name: /完整版/ })).toHaveClass('active');
    expect(await screen.findByText('未开始')).toBeInTheDocument();
  });

  it('enters the selected difficulty route', async () => {
    const user = userEvent.setup();
    renderAtRoute(
      <DailyLobby />,
      {
        route: '/daily',
        path: '/daily',
        extraRoutes: <Route path="/daily/:mode" element={<div data-testid="daily-game-route" />} />,
      }
    );

    await user.click(screen.getByRole('button', { name: /完整版/ }));
    await user.click(screen.getByRole('button', { name: '进入挑战' }));

    expect(await screen.findByTestId('daily-game-route')).toBeInTheDocument();
    expect(localStorage.getItem('nijisanjifriberg.daily-difficulty')).toBe('normal');
  });
});
