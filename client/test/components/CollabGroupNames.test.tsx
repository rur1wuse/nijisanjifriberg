import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CollabGroupNames from '../../src/components/CollabGroupNames';
import GuessBoard from '../../src/components/GuessBoard';
import { PlayerInfoTable } from '../../src/components/AnswerOverlay';
import COLLAB_NOTES from '../../src/config/collabNotes';
import type { CollabGroup, MultiplayerGuessFeedback } from '../../src/types';
import { renderWithProviders } from '../render';

const plain = { value: '-', level: 'gray' as const };

function guessWithCollab(collab: string, groups?: CollabGroup[]): MultiplayerGuessFeedback {
  return {
    playerId: 1,
    nickname: 'test',
    correct: false,
    attributes: {
      gender: plain,
      debutDate: plain,
      height: plain,
      age: plain,
      collab: { value: collab, level: 'correct', groups },
      race: plain,
    },
  };
}

function expectHoverNote(trigger: HTMLElement, note: string) {
  expect(trigger).not.toHaveAttribute('title');
  fireEvent.mouseOver(trigger);
  expect(screen.getByRole('tooltip')).toHaveTextContent(note);
  fireEvent.mouseOut(trigger);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
}

describe('CollabGroupNames', () => {
  it('removes footnote markers and shows the note in a floating tooltip', () => {
    render(<CollabGroupNames value={'ACDC*21, \u5357\u30c1\u30fc\u30e0*143'} />);

    expectHoverNote(screen.getByText('ACDC'), COLLAB_NOTES['ACDC*21']);
    expectHoverNote(
      screen.getByText('\u5357\u30c1\u30fc\u30e0'),
      COLLAB_NOTES['\u5357\u30c1\u30fc\u30e0*143']
    );
    expect(screen.queryByText(/\*\d+/)).not.toBeInTheDocument();
  });

  it('leaves names without footnotes untouched', () => {
    render(<CollabGroupNames value={'\u3055\u3093\u3070\u304b, JK\u7d44'} />);

    const text = screen.getByText('\u3055\u3093\u3070\u304b, JK\u7d44');
    fireEvent.mouseOver(text);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps a combined wiki cell as one group with its combined note', () => {
    render(<CollabGroupNames value={'\u5185\u80a1\u30ac\u30cb\u80a1*16 / \u3084\u3057\u30c1\u30e3\u30a4*17'} />);

    expectHoverNote(
      screen.getByText('\u5185\u80a1\u30ac\u30cb\u80a1 / \u3084\u3057\u30c1\u30e3\u30a4'),
      COLLAB_NOTES['\u5185\u80a1\u30ac\u30cb\u80a1*16 / \u3084\u3057\u30c1\u30e3\u30a4*17']
    );
  });

  it('removes markers that are not at the end of the name', () => {
    render(<CollabGroupNames value={'\uff08\u96d1*59\uff09'} />);

    expectHoverNote(screen.getByText('\uff08\u96d1\uff09'), COLLAB_NOTES['\uff08\u96d1*59\uff09']);
  });

  it('only matches whole combo names', () => {
    const { container } = render(
      <CollabGroupNames value={'\u30d0\u30c8\u30ed\u30efA\u30c1\u30fc\u30e0, B\u30c1\u30fc\u30e0\u3007\u3059'} />
    );

    expect(screen.getByText('\u30d0\u30c8\u30ed\u30efA\u30c1\u30fc\u30e0, B\u30c1\u30fc\u30e0\u3007\u3059')).toBeInTheDocument();
    expect(container.querySelector('.collab-group-note')).toBeNull();
  });

  it('keeps same-name groups distinct by rendering each footnote', () => {
    render(
      <CollabGroupNames
        groups={[
          { name: 'A\u30c1\u30fc\u30e0', note: 'first' },
          { name: 'A\u30c1\u30fc\u30e0', note: 'second' },
        ]}
      />
    );

    const names = screen.getAllByText('A\u30c1\u30fc\u30e0');
    expect(names).toHaveLength(2);
    expectHoverNote(names[0], 'first');
    expectHoverNote(names[1], 'second');
  });

  it('shows the note on keyboard focus as well', () => {
    render(<CollabGroupNames groups={[{ name: 'A\u30c1\u30fc\u30e0', note: 'focus note' }]} />);

    const trigger = screen.getByText('A\u30c1\u30fc\u30e0');
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent('focus note');
    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('is wired into the guess board collab cell', () => {
    renderWithProviders(
      <GuessBoard
        guesses={[guessWithCollab('A\u30c1\u30fc\u30e0', [{ name: 'A\u30c1\u30fc\u30e0', note: 'board note' }])]}
      />
    );

    expectHoverNote(screen.getByText('A\u30c1\u30fc\u30e0'), 'board note');
  });

  it('is wired into the player info card', () => {
    renderWithProviders(
      <PlayerInfoTable
        answer={{
          nickname: 'test',
          collab: 'A\u30c1\u30fc\u30e0\u3001A\u30c1\u30fc\u30e0',
          collabGroups: [
            { name: 'A\u30c1\u30fc\u30e0', note: 'first' },
            { name: 'A\u30c1\u30fc\u30e0', note: 'second' },
          ],
        }}
      />
    );

    const names = screen.getAllByText('A\u30c1\u30fc\u30e0');
    expect(names).toHaveLength(2);
    expectHoverNote(names[0], 'first');
    expectHoverNote(names[1], 'second');
  });
});
