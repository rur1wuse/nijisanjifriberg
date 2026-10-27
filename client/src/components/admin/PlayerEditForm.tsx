/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import ModalPortal from '../ModalPortal';
import { toast } from '../Toast';
import { useTranslation } from 'react-i18next';
import DifficultyMultiSelect from './DifficultyMultiSelect';

export interface PlayerForm {
  id?: number;
  nickname: string;
  gender: string;
  debut_date: string;
  height_cm: string;
  age_text: string;
  collab_groups: string[];
  race: string;
  difficulties: string[];
  is_enabled: boolean;
}

export const emptyPlayer: PlayerForm = {
  nickname: '',
  gender: '',
  debut_date: '',
  height_cm: '',
  age_text: '',
  collab_groups: [],
  race: '',
  difficulties: ['normal'],
  is_enabled: true,
};

interface Props {
  initial: PlayerForm;
  difficultyKeys: string[];
  onSubmit: (form: PlayerForm) => Promise<void>;
  onCancel: () => void;
}

export default function PlayerEditForm({ initial, difficultyKeys, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<PlayerForm>(initial);
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<PlayerForm>) => setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstInputRef.current?.focus();
    return () => {
      document.body.style.overflow = oldOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel, saving]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('admin.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div
        className="admin-player-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) onCancel();
        }}
      >
        <div className="admin-player-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="admin-player-dialog-heading">
            <div>
              <h2 id={titleId}>{form.id ? t('admin.editPlayer', { player: form.nickname }) : t('admin.addPlayer')}</h2>
              <p>{t('admin.formDescription')}</p>
            </div>
            <button className="confirm-close" type="button" aria-label={t('common.close')} onClick={onCancel} disabled={saving}>
              <X size={18} />
            </button>
          </div>

          <form onSubmit={submit}>
          <div className="admin-player-form-grid">
            <label className="admin-player-field">
              <span>{t('admin.playerNickname')}</span>
              <input ref={firstInputRef} className="input" value={form.nickname} onChange={(event) => set({ nickname: event.target.value })} required />
            </label>
            <label className="admin-player-field">
              <span>{t('player.gender')}</span>
              <input className="input" value={form.gender} onChange={(event) => set({ gender: event.target.value })} />
            </label>
            <label className="admin-player-field">
              <span>{t('player.debutDate')}</span>
              <input
                className="input"
                placeholder="YYYY-MM-DD"
                value={form.debut_date}
                onChange={(event) => set({ debut_date: event.target.value })}
              />
            </label>
            <label className="admin-player-field">
              <span>{t('player.height')}</span>
              <input className="input" value={form.height_cm} onChange={(event) => set({ height_cm: event.target.value })} />
            </label>
            <label className="admin-player-field">
              <span>{t('player.age')}</span>
              <input className="input" value={form.age_text} onChange={(event) => set({ age_text: event.target.value })} />
            </label>
            <label className="admin-player-field">
              <span>{t('player.race')}</span>
              <input className="input" value={form.race} onChange={(event) => set({ race: event.target.value })} />
            </label>
            <label className="admin-player-field">
              <span>{t('player.collab')}</span>
              <textarea
                className="input"
                rows={3}
                value={form.collab_groups.join('\n')}
                onChange={(event) => set({
                  collab_groups: event.target.value.split(/\r?\n/).map((group) => group.trim()).filter(Boolean),
                })}
              />
            </label>
          </div>

          <div className="admin-player-flags">
            <div className="admin-player-difficulty-field">
              <span className="admin-player-flag-label">{t('admin.difficulties')}</span>
              <DifficultyMultiSelect
                options={difficultyKeys}
                value={form.difficulties}
                onChange={(difficulties) => set({ difficulties })}
              />
            </div>
            <label><input type="checkbox" checked={form.is_enabled} onChange={(event) => set({ is_enabled: event.target.checked })} />{t('admin.enabledPlayer')}</label>
          </div>

          <div className="admin-player-dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>{t('common.cancel')}</button>
            <button className="btn btn-green" disabled={saving || form.difficulties.length === 0}>{saving ? t('admin.saving') : form.id ? t('admin.saveChanges') : t('admin.addPlayer')}</button>
          </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
