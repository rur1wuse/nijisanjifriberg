import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../src/i18n';
import { renderWithProviders } from '../render';
import GameRules from '../../src/components/GameRules';

describe('GameRules', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh');
  });

  it('explains the five feedback levels and the seven compared fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GameRules />);

    await user.click(screen.getByRole('button', { name: '\u6e38\u620f\u89c4\u5219' }));

    expect(screen.getByText(/\u51fa\u9053\u65e5\u76f8\u5dee\u4e00\u5e74\u5185/)).toBeInTheDocument();
    expect(screen.getByText('\u7d2b\u8272 \u00b7 \u5e74\u9f84\u4e0d\u8be6')).toBeInTheDocument();
    expect(screen.getByText(/\u540d\u5b57\u3001\u6027\u522b\u3001\u79cd\u65cf/)).toBeInTheDocument();
    expect(screen.getByText(/\u6027\u522b \u00b7 \u76f8\u540c\u7eff/)).toBeInTheDocument();
    expect(screen.getByText(/\u5173\u7cfb \u00b7 \u6709\u5171\u540c\u7ec4\u5408\u7eff/)).toBeInTheDocument();
  });
});
