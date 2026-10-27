/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import { ArrowUp, ArrowDown } from 'lucide-react';
import { memo } from 'react';
import type { ReactNode } from 'react';
import {
  AttributeFeedback,
  HiddenAttributeFeedback,
  MultiplayerGuessFeedback,
} from '../types';
import { useTranslation } from 'react-i18next';

function Cell({
  attr,
  label,
}: {
  attr: AttributeFeedback | HiddenAttributeFeedback;
  label: string;
}) {
  if (!('value' in attr)) {
    return (
      <td className={`${attr.level} masked-cell`} data-label={label}>
        {attr.hint && attr.level !== 'correct' && attr.level !== 'unknown' && (
          <span className="dir">
            {attr.hint === 'higher' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
          </span>
        )}
      </td>
    );
  }
  return (
    <td className={attr.level} data-label={label}>
      {String(attr.value)}
      {attr.hint && attr.level !== 'correct' && attr.level !== 'unknown' && (
        <span className="dir">
          {attr.hint === 'higher' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
        </span>
      )}
    </td>
  );
}

/** 猜测反馈表:原版 game-table 布局,每行一次猜测的逐属性对比 */
function GuessBoard({
  guesses,
  rowAnnotations,
}: {
  guesses: MultiplayerGuessFeedback[];
  rowAnnotations?: Array<{ content: ReactNode; title?: string; tone?: 'self' | 'other' }>;
}) {
  const { t } = useTranslation();
  const columns = [
    t('guess.columns.nickname'),
    t('guess.columns.gender'),
    t('guess.columns.debutDate'),
    t('guess.columns.height'),
    t('guess.columns.age'),
    t('guess.columns.collab'),
    t('guess.columns.race'),
  ];
  return (
    <div className="game-table-wrap">
      <table className="game-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {guesses.map((g, i) => {
            const annotation = rowAnnotations?.[i];
            return (
              <tr
                key={'hidden' in g ? `hidden-${i}` : `${g.playerId}-${i}`}
                className={`${i === guesses.length - 1 ? 'row-latest' : ''} ${g.correct ? 'row-correct' : ''}`}
              >
                <td
                  className={`name ${g.correct ? 'correct' : ''} ${'hidden' in g ? 'masked-cell' : ''}`}
                  data-label={columns[0]}
                >
                  {annotation && (
                    <span
                      className={`guess-row-actor${annotation.tone ? ` guess-row-actor-${annotation.tone}` : ''}`}
                      title={annotation.title}
                    >
                      {annotation.content}
                    </span>
                  )}
                  {'hidden' in g ? null : g.nickname}
                </td>
                <Cell attr={g.attributes.gender} label={columns[1]} />
                <Cell attr={g.attributes.debutDate} label={columns[2]} />
                <Cell attr={g.attributes.height} label={columns[3]} />
                <Cell attr={g.attributes.age} label={columns[4]} />
                <Cell attr={g.attributes.collab} label={columns[5]} />
                <Cell attr={g.attributes.race} label={columns[6]} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default memo(GuessBoard);
