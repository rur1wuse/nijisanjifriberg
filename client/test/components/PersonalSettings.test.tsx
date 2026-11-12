import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuth } from '../../src/store/auth';
import { renderWithProviders } from '../render';
import PersonalSettings from '../../src/components/PersonalSettings';

describe('PersonalSettings', () => {
  beforeEach(() => {
    useAuth.setState({ user: null, initialized: true });
  });

  it('stores and immediately applies the animation preference', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PersonalSettings />);

    await user.click(screen.getByRole('button', { name: '个人设置' }));
    const motion = screen.getByRole('switch', { name: '动画效果' });
    expect(motion).toBeChecked();

    await user.click(motion);
    expect(motion).not.toBeChecked();
    expect(localStorage.getItem('ui-motion')).toBe('off');
    expect(document.documentElement).toHaveAttribute('data-motion', 'reduced');

    await user.click(motion);
    expect(localStorage.getItem('ui-motion')).toBe('on');
    expect(document.documentElement).not.toHaveAttribute('data-motion');
  });

  it('no longer offers email verification for signed-in users', async () => {
    const user = userEvent.setup();
    useAuth.setState({
      user: { id: 7, username: 'tester', role: 'user' },
      initialized: true,
    });
    renderWithProviders(<PersonalSettings />);

    await user.click(screen.getByRole('button', { name: '个人设置' }));

    expect(await screen.findByRole('dialog', { name: '个人设置' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '动画效果' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /验证/ })).not.toBeInTheDocument();
  });
});
