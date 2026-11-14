/**
 * 新增文件：nijisanjifriberg 题库多选控件。
 * Copyright (C) 2026 rur1wuse。以 AGPL-3.0 发布，详见 LICENSE / COPYRIGHT.md。
 */
import { useTranslation } from 'react-i18next';
import { REGION_OPTIONS, RegionKey } from '../config/regions';

interface RegionPickerProps {
  value: readonly RegionKey[];
  onChange: (regions: RegionKey[]) => void;
  disabled?: boolean;
}

export default function RegionPicker({ value, onChange, disabled }: RegionPickerProps) {
  const { t } = useTranslation();
  const toggle = (key: RegionKey) => {
    onChange(value.includes(key)
      ? value.filter((region) => region !== key)
      : [...value, key]);
  };
  return (
    <div className="region-picker" role="group" aria-label={t('regions.label')}>
      <span className="region-picker-label">{t('regions.label')}</span>
      <div className="region-picker-options">
        {REGION_OPTIONS.map((key) => (
          <label key={key} className="region-option">
            <input
              type="checkbox"
              checked={value.includes(key)}
              disabled={disabled}
              onChange={() => toggle(key)}
            />
            <span>{t(`regions.${key}`)}</span>
          </label>
        ))}
      </div>
      <small className="muted">{t('regions.hint')}</small>
    </div>
  );
}
