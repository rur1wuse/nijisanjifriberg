import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../src/i18n';
import { SPECIAL_THANKS } from '../../src/config/specialThanks';
import { renderWithProviders } from '../render';
import HomeSpecialThanks from '../../src/components/HomeSpecialThanks';

describe('HomeSpecialThanks', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh');
  });

  it('links to the csgofriberg project this site is based on', async () => {
    const user = userEvent.setup();

    renderWithProviders(<HomeSpecialThanks />);

    await user.click(screen.getByRole('button', { name: '特别感谢' }));
    expect(screen.getByRole('heading', { name: '特别感谢' })).toBeInTheDocument();
    expect(screen.getByText('本站所基于的原项目')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'csgofriberg' })).toHaveAttribute('src', SPECIAL_THANKS[0].image);
    expect(screen.getByRole('link', { name: /csgofriberg/ }))
      .toHaveAttribute('href', 'https://github.com/shnlfriberg/csgofriberg');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
