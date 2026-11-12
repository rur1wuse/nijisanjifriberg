import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../src/store/auth';
import { renderAtRoute } from '../render';
import Home from '../../src/pages/Home';

vi.mock('../../src/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  errMsg: vi.fn(() => '请求失败'),
}));

describe('Home', () => {
  beforeEach(() => {
    useAuth.setState({
      user: { id: 7, username: 'tester', role: 'user' },
      initialized: true,
    });
  });

  it('places the daily challenge as the first home menu entry', () => {
    renderAtRoute(<Home />);

    const daily = screen.getByRole('link', { name: /每日挑战/ });
    expect(daily.parentElement?.firstElementChild).toBe(daily);
  });

  it('does not render the removed leaderboard, announcements, friend links, or bilibili entries', () => {
    renderAtRoute(<Home />);

    expect(screen.queryByRole('link', { name: /排行榜/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /更新公告/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /友情链接/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /B站/ })).not.toBeInTheDocument();
  });
});
