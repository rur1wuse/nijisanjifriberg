/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import { ReactNode, useEffect } from 'react';
import { Cake, Globe2, Layers3, Ruler, Tag, Users, UserRound } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useTranslation } from 'react-i18next';
import { difficultyLabel } from '../utils/difficulty';
import { localizedName } from '../utils/playerName';

export interface AnswerInfo {
  nickname: string;
  nameZh?: string;
  gender?: string;
  debutDate?: string;
  height?: string;
  age?: string;
  collab?: string;
  race?: string;
  difficulties?: string[];
}

/** 选手信息卡(答案卡片/查询结果共用) */
export function PlayerInfoTable({ answer }: { answer: AnswerInfo }) {
  const { t } = useTranslation();
  const rows: [ReactNode, string, ReactNode][] = [
    [<UserRound size={14} key="i" />, t('player.gender'), answer.gender || '-'],
    [<Cake size={14} key="i" />, t('player.debutDate'), answer.debutDate || '-'],
    [<Ruler size={14} key="i" />, t('player.height'), answer.height || '-'],
    [<Tag size={14} key="i" />, t('player.age'), answer.age || '-'],
    [<Users size={14} key="i" />, t('player.collab'), answer.collab || '-'],
    [<Globe2 size={14} key="i" />, t('player.race'), answer.race || '-'],
  ];
  if (answer.difficulties) {
    rows.push([
      <Layers3 size={14} key="i" />,
      t('player.difficulties'),
      answer.difficulties.length
        ? answer.difficulties.map((key) => difficultyLabel(t, key)).join(', ')
        : '-',
    ]);
  }
  return (
    <table className="player-info-table">
      <tbody>
        {rows.map(([icon, label, value]) => (
          <tr key={label}>
            <td className="label">
              {icon}
              {label}
            </td>
            <td className="value">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface Props {
  title: string;
  answer: AnswerInfo | null;
  extra?: ReactNode;
  actions: ReactNode;
  onClose?: () => void;
  /** 胜负配色:win 绿色调头部,lose 中性 */
  tone?: 'win' | 'lose';
}

/** 结算/答案遮罩卡片 */
export default function AnswerOverlay({ title, answer, extra, actions, onClose, tone }: Props) {
  const { i18n } = useTranslation();
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <ModalPortal>
      <div
        className="overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <div
          className={`overlay-card${tone ? ` overlay-card-${tone}` : ''}`}
          role="dialog"
          aria-modal="true"
        >
          <h2>{title}</h2>
          {extra}
          {answer && (
            <>
              <p className="answer-name">{localizedName(answer, i18n.language)}</p>
              <PlayerInfoTable answer={answer} />
            </>
          )}
          <div className="btns">{actions}</div>
        </div>
      </div>
    </ModalPortal>
  );
}
