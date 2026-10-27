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

  it('offers only the single full tier and selects it by default', () => {
    renderAtRoute(<SingleLobby />, { route: '/single', path: '/single' });

    const options = screen.getAllByRole('button', { name: /完整版/ });
    expect(options).toHaveLength(1);
    const normal = options[0];
    expect(normal).toHaveClass('active');
    expect(screen.queryByRole('button', { name: /入门版/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /简单版/ })).not.toBeInTheDocument();
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

  it('mobile start button remains a full-width primary action class', () => {
    renderAtRoute(<SingleLobby />, { route: '/single', path: '/single' });
    const start = screen.getByRole('button', { name: /开始游戏/ });
    expect(start).toHaveClass('btn', 'btn-lg', 'btn-green');
  });
});
