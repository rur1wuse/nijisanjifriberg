import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnswerOverlay, { PlayerInfoTable } from '../../src/components/AnswerOverlay';
import { renderWithProviders } from '../render';

const answer = {
  nickname: 'friberg',
  gender: '\u5973',
  debutDate: '2019-03-01',
  height: '155cm',
  age: '24',
  collab: '\u7ec4\u5408A',
  race: '\u4eba\u7c7b',
};

describe('AnswerOverlay', () => {
  it('exposes dialog semantics used by keyboard focus guards', () => {
    renderWithProviders(
      <AnswerOverlay title="\u7ed3\u7b97" answer={answer} actions={<button type="button">\u67e5\u770b</button>} />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('friberg')).toBeInTheDocument();
  });

  it('supports desktop Escape and mobile backdrop dismiss when onClose is provided', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <AnswerOverlay
        title="\u7ed3\u7b97"
        answer={answer}
        onClose={onClose}
        actions={<button type="button">\u67e5\u770b</button>}
      />
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    const overlay = container.ownerDocument.querySelector('.overlay');
    expect(overlay).toBeTruthy();
    fireEvent.mouseDown(overlay!);
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not close when onClose is omitted (match-over flow)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AnswerOverlay title="\u6574\u573a\u7ed3\u7b97" answer={answer} actions={<button type="button">\u518d\u6765</button>} />
    );
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the seven niji fields', () => {
    renderWithProviders(<PlayerInfoTable answer={answer} />);
    expect(screen.getByText('\u6027\u522b')).toBeInTheDocument();
    expect(screen.getByText('\u51fa\u9053\u65e5')).toBeInTheDocument();
    expect(screen.getByText('\u8eab\u9ad8')).toBeInTheDocument();
    expect(screen.getByText('\u5173\u7cfb')).toBeInTheDocument();
    expect(screen.getByText('\u79cd\u65cf')).toBeInTheDocument();
    expect(screen.getByText('155cm')).toBeInTheDocument();
  });

  it('shows a player\'s difficulty memberships when provided', () => {
    renderWithProviders(
      <PlayerInfoTable answer={{ ...answer, difficulties: ['normal'] }} />
    );

    expect(screen.getByText('\u6240\u5c5e\u96be\u5ea6')).toBeInTheDocument();
    expect(screen.getByText('\u5b8c\u6574\u7248')).toBeInTheDocument();
  });
});
