/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { Route } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SingleLobby from '../../src/pages/SingleLobby';
import { renderAtRoute } from '../render';

describe('SingleLobby', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('offers easy and full tiers and selects full by default', () => {
    renderAtRoute(<SingleLobby />, { route: '/single', path: '/single' });

    const normal = screen.getByRole('button', { name: /完整版/ });
    const easy = screen.getByRole('button', { name: /简单版/ });
    expect(normal).toHaveClass('active');
    expect(easy).not.toHaveClass('active');
    expect(easy).toHaveTextContent('无限次猜测');
    expect(normal.querySelector('.single-difficulty-badge')).toBeNull();
    expect(normal.style.getPropertyValue('--diff-color')).toBe('var(--accent)');
    expect(screen.getByText('选择一个难度开始游戏。你的选择会保存在本地浏览器中。')).toBeInTheDocument();
  });

  it('starts the selected difficulty and remembers the choice', async () => {
    const user = userEvent.setup();
    renderAtRoute(
      <SingleLobby />,
      {
        route: '/single',
        path: '/single',
        extraRoutes: (
          <Route path="/single/:mode" element={<div data-testid="game-route" />} />
        ),
      }
    );

    expect(screen.getByRole('button', { name: /完整版/ })).toHaveClass('active');
    await user.click(screen.getByRole('button', { name: /开始游戏/ }));

    expect(await screen.findByTestId('game-route')).toBeInTheDocument();
    expect(localStorage.getItem('nijisanjifriberg.single-difficulty')).toBe('normal');
  });

  it('starts the easy tier and remembers the choice', async () => {
    const user = userEvent.setup();
    renderAtRoute(
      <SingleLobby />,
      {
        route: '/single',
        path: '/single',
        extraRoutes: (
          <Route path="/single/:mode" element={<div data-testid="game-route" />} />
        ),
      }
    );

    await user.click(screen.getByRole('button', { name: /简单版/ }));
    await user.click(screen.getByRole('button', { name: /开始游戏/ }));

    expect(await screen.findByTestId('game-route')).toBeInTheDocument();
    expect(localStorage.getItem('nijisanjifriberg.single-difficulty')).toBe('easy');
  });

  it('mobile start button remains a full-width primary action class', () => {
    renderAtRoute(<SingleLobby />, { route: '/single', path: '/single' });
    const start = screen.getByRole('button', { name: /开始游戏/ });
    expect(start).toHaveClass('btn', 'btn-lg', 'btn-green');
  });

  it('defaults the pool to every region and persists multi-select changes', async () => {
    const user = userEvent.setup();
    renderAtRoute(<SingleLobby />, { route: '/single', path: '/single' });

    expect(screen.getByRole('checkbox', { name: 'JP' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'KR' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'ID' })).toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: 'KR' }));

    expect(screen.getByRole('checkbox', { name: 'KR' })).not.toBeChecked();
    expect(localStorage.getItem('nijisanjifriberg.single-regions')).toBe('["jp","id"]');
  });

  it('disables the start button when no region is selected', async () => {
    const user = userEvent.setup();
    renderAtRoute(<SingleLobby />, { route: '/single', path: '/single' });

    for (const name of ['JP', 'KR', 'ID']) {
      await user.click(screen.getByRole('checkbox', { name }));
    }

    expect(screen.getByRole('button', { name: /开始游戏/ })).toBeDisabled();
  });
});
