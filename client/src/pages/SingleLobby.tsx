/**
 * Modified for nijisanjifriberg on 2026-10-27.
 * Original work: csgofriberg, Copyright (C) 2026 星海 (Xinhai).
 * Licensed under the GNU Affero General Public License v3.
 * See LICENSE, NOTICE and COPYRIGHT.md for details.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, Gamepad2, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Page from '../components/Page';
import RegionPicker from '../components/RegionPicker';
import { AVAILABLE_DIFFICULTIES } from '../config/difficulties';
import { ALL_REGIONS, RegionKey, serializeRegionQuery } from '../config/regions';
import {
  difficultyColor,
  difficultyDescription,
  difficultyIcon,
  difficultyLabel,
} from '../utils/difficulty';
import { getStoredSingleDifficulty, setStoredSingleDifficulty } from '../store/singleDifficulty';
import { getStoredSingleRegions, setStoredSingleRegions } from '../store/singleRegions';
import { useTranslation } from 'react-i18next';
import { toast } from '../components/Toast';

export default function SingleLobby() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const difficulties = AVAILABLE_DIFFICULTIES;
  const [selected, setSelected] = useState<string | null>(getStoredSingleDifficulty);
  const [regions, setRegions] = useState<RegionKey[]>(
    () => getStoredSingleRegions() ?? [...ALL_REGIONS]
  );

  const selectedDifficulty = useMemo(
    () => difficulties.find((item) => item.key === selected)
      ?? difficulties[0],
    [difficulties, selected]
  );

  useEffect(() => {
    if (!selectedDifficulty) return;
    if (selected !== selectedDifficulty.key) {
      setSelected(selectedDifficulty.key);
      setStoredSingleDifficulty(selectedDifficulty.key);
    }
  }, [selected, selectedDifficulty]);

  const choose = (key: string) => {
    setSelected(key);
    setStoredSingleDifficulty(key);
  };

  const chooseRegions = (next: RegionKey[]) => {
    setRegions(next);
    setStoredSingleRegions(next);
  };

  const start = () => {
    if (!selectedDifficulty) {
      toast.error(t('errors.DIFFICULTY_UNAVAILABLE'));
      return;
    }
    if (!regions.length) {
      toast.error(t('errors.REGION_REQUIRED'));
      return;
    }
    navigate(`/single/${selectedDifficulty.key}?regions=${serializeRegionQuery(regions)}`);
  };

  return (
    <Page title={t('singleLobby.title')} icon={<Gamepad2 size={17} />}>
      <p className="muted single-lobby-subtitle">{t('singleLobby.subtitle')}</p>
      {difficulties.length ? (
        <>
          <div className="single-difficulty-grid">
            {difficulties.map((difficulty) => {
              const active = selectedDifficulty?.key === difficulty.key;
              const Icon = difficultyIcon(difficulty.key);
              return (
                <button
                  type="button"
                  key={difficulty.key}
                  className={`single-difficulty-option${active ? ' active' : ''}`}
                  style={{ ['--diff-color' as string]: difficultyColor(difficulty.key) }}
                  onClick={() => choose(difficulty.key)}
                >
                  <span className="single-difficulty-icon"><Icon size={20} /></span>
                  <span className="single-difficulty-copy">
                    <strong>{difficultyLabel(t, difficulty.key)}</strong>
                    <small>
                      {difficultyDescription(t, difficulty.key) || t('singleLobby.available')}
                    </small>
                  </span>
                  <span className="single-difficulty-check" aria-hidden="true">{active && <Check size={17} />}</span>
                </button>
              );
            })}
          </div>
          <RegionPicker value={regions} onChange={chooseRegions} />
          <div className="single-lobby-action">
            <button type="button" className="btn btn-lg btn-green" onClick={start} disabled={regions.length === 0}>
              <Play size={17} /> {t('singleLobby.start')}
            </button>
          </div>
        </>
      ) : (
        <div className="card"><p className="muted">{t('errors.DIFFICULTY_UNAVAILABLE')}</p></div>
      )}
    </Page>
  );
}
