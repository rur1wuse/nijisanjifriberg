import { Fragment } from 'react';
import type { ReactNode } from 'react';
import COLLAB_NOTES from '../config/collabNotes';
import HoverTooltip from './HoverTooltip';
import type { CollabGroup } from '../types';

const FOOTNOTE_MARKER = /\*\d+/g;
const LIST_SEPARATOR = /(、|, )/;
const COMBINED_SEPARATOR = ' / ';

function legacyName(name: string): { name: string; note?: string } {
  const clean = name.replace(FOOTNOTE_MARKER, '');
  return { name: clean, note: COLLAB_NOTES[name] ?? COLLAB_NOTES[clean] };
}

function renderLegacyName(name: string, key: string): ReactNode {
  const resolved = legacyName(name);
  if (resolved.note) {
    return (
      <HoverTooltip key={key} content={resolved.note}>
        {resolved.name}
      </HoverTooltip>
    );
  }
  const parts = resolved.name.split(COMBINED_SEPARATOR);
  if (parts.length === 1 || !parts.some((part) => legacyName(part).note)) {
    return resolved.name;
  }
  return (
    <span key={key}>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? COMBINED_SEPARATOR : ''}
          {renderLegacyName(part, `${key}-${index}`)}
        </Fragment>
      ))}
    </span>
  );
}

interface Props {
  groups?: CollabGroup[];
  value?: string;
  separator?: string;
}

/** 渲染组合名列表: 同名组合按脚注区分, 旧版字符串数据仍会去掉 *N 后兜底显示脚注 */
export default function CollabGroupNames({ groups, value, separator = '、' }: Props) {
  if (groups?.length) {
    return (
      <>
        {groups.map((group, index) => (
          <Fragment key={index}>
            {index > 0 ? separator : ''}
            {group.note ? (
              <HoverTooltip content={group.note}>{group.name}</HoverTooltip>
            ) : (
              group.name
            )}
          </Fragment>
        ))}
      </>
    );
  }
  return (
    <>
      {(value ?? '')
        .split(LIST_SEPARATOR)
        .map((part, index) => (index % 2 === 1 ? part : renderLegacyName(part, String(index))))}
    </>
  );
}
