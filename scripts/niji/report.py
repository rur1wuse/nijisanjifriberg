#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Step 1 汇总: 生成 docs/niji/data-review.md 供人工核对

数据来源优先级:
  出道日  wikiwiki プロフィール > ja.wikipedia 活動開始日 > (空)
  其他    只取 wikiwiki プロフィール, 缺失即留空
"""

import sys
import io
import json
import re
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'docs' / 'niji' / '.data'
OUT = ROOT / 'docs' / 'niji'

YMD_JP = re.compile(r'(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日')
YMD_SLASH = re.compile(r'(20\d{2})/(\d{1,2})/(\d{1,2})')
YM_JP = re.compile(r'(20\d{2})\s*年\s*(\d{1,2})\s*月')


def name_key(name: str) -> str:
    """抹平 wikipedia 与 wikiwiki 的写法差异: 空格 / 中黑点 / 全角括号 / 大小写。"""
    s = (name or '').strip().lower()
    s = re.sub(r'[（(].*?[）)]', '', s)
    s = re.sub(r'[\s・·\u3000]+', '', s)
    return s


WIKI_NAME_ALIASES = {
    'ましろ': 'ましろ爻',
}

COLLAB_NAME_ALIASES = {
    'ましろ': 'ましろ爻',
}

AGE_UNKNOWN = re.compile(r'不[明详詳]|非公開|秘密')

def norm_date(text: str):
    """把各种写法归一成 (YYYY-MM-DD 或 YYYY-MM 或 None, 是否精确到日)。"""
    if not text:
        return None, False
    m = YMD_JP.search(text) or YMD_SLASH.search(text)
    if m:
        y, mo, d = (int(x) for x in m.groups())
        return f'{y:04d}-{mo:02d}-{d:02d}', True
    m = YM_JP.search(text)
    if m:
        y, mo = (int(x) for x in m.groups())
        return f'{y:04d}-{mo:02d}', False
    return None, False


def clean(value: str) -> str:
    text = re.sub(r'\*\d+', '', value or '')
    return re.sub(r'\s+', ' ', text).replace('|', '\\|').strip()


def read_previous_review() -> dict:
    """读回人工填过的值, 重跑时只补组合数、不动性别/种族/身高/年龄。"""
    path = OUT / 'data-review.md'
    if not path.exists():
        return {}
    previous = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        if not line.startswith('| ') or line.startswith('| #') or line.startswith('|---'):
            continue
        parts = [p.strip() for p in re.split(r'\s*\|\s*', line)[1:-1]]
        if len(parts) < 8 or not parts[0].isdigit():
            continue
        previous[parts[1]] = {
            'gender': parts[2],
            'debut': parts[3],
            'height': parts[4],
            'age': parts[5],
            'race': parts[7],
        }
    return previous


def main():
    roster = json.loads((DATA / 'roster.json').read_text(encoding='utf-8'))
    profiles = json.loads((DATA / 'profiles.json').read_text(encoding='utf-8'))
    wiki = json.loads((DATA / 'wikipedia_debut.json').read_text(encoding='utf-8'))
    previous = read_previous_review()
    wiki_alias_path = DATA / 'wikipedia_alias.json'
    wiki_alias = (
        json.loads(wiki_alias_path.read_text(encoding='utf-8'))
        if wiki_alias_path.exists() else {}
    )
    collabs = json.loads((DATA / 'collabs.json').read_text(encoding='utf-8'))

    member_collabs = {}
    for c in collabs:
        for name in c['members']:
            member_collabs.setdefault(name, []).append(c)
    for old, new in COLLAB_NAME_ALIASES.items():
        if new in member_collabs and old not in member_collabs:
            member_collabs[old] = member_collabs[new]

    wiki_by_key = {name_key(k): v for k, v in wiki.items()}

    def wiki_entry(name: str):
        for candidate in (
            name,
            WIKI_NAME_ALIASES.get(name),
            wiki_alias.get(name),
            wiki_alias.get(name.replace(' ', '')),
        ):
            if not candidate:
                continue
            hit = wiki.get(candidate) or wiki_by_key.get(name_key(candidate))
            if hit:
                return hit
        return {}

    def resolve_debut(name: str):
        prof = profiles.get(name) or {}
        debut, exact = norm_date(' / '.join(prof.get('debut') or []))
        if exact:
            return debut, True
        return norm_date(wiki_entry(name).get('raw') or '')

    lines = []
    notes = []

    lines.append('# 彩虹社 JP 成员数据核对表')
    lines.append('')
    lines.append('> 本文件由 `scripts/niji/scrape.py` + `report.py` 生成。重跑只更新「组合数」和「状态」，')
    lines.append('> 不会覆盖已填的性别 / 出道日 / 身高 / 年龄 / 种族。')
    lines.append('> 组合关系明细单独放在 [`collabs.md`](./collabs.md)，本表只显示数量。')
    lines.append('')

    lines.append('## 字段说明')
    lines.append('')
    lines.append('| 列 | 来源 | 说明 |')
    lines.append('|---|---|---|')
    lines.append('| 名字 | wikiwiki メンバーデータ一覧 | 唯一键 |')
    lines.append('| 性别 | 人工填写 | 相同绿 / 不同红 |')
    lines.append('| 出道日 | プロフィール → ja.wikipedia | YYYY-MM-DD |')
    lines.append('| 身高 | プロフィール | 原文，多值需人工选定 |')
    lines.append('| 年龄 | プロフィール | 原文；不详显示紫色 |')
    lines.append('| 组合数 | コラボ一覧表 | 参与组合个数，明细见 collabs.md |')
    lines.append('| 种族 | 人工填写 | 相同绿 / 不同红 |')
    lines.append('')
    lines.append('`状态` 列含义：`✅` 完整 ／ `⚠️多值` 需筛选 ／ `❌缺` 需补 ／ `🟣年龄不详` 游戏内显示紫色')
    lines.append('')

    lines.append('## 主表')
    lines.append('')
    lines.append('| # | 名字 | 性别 | 出道日 | 身高 | 年龄 | 组合数 | 种族 | 状态 |')
    lines.append('|---:|---|---|---|---|---|---:|---|---|')

    for i, member in enumerate(roster, 1):
        name = member['name']
        prof = profiles.get(name) or {}
        w = wiki_entry(name)

        age_raw = ' / '.join(prof.get('age') or [])
        height_raw = ' / '.join(prof.get('height') or [])
        debut_raw = ' / '.join(prof.get('debut') or [])

        debut, exact = norm_date(debut_raw)
        if not exact:
            wd, wexact = norm_date(w.get('raw') or '')
            if wexact:
                debut, exact = wd, True
                if debut_raw:
                    notes.append(
                        f'- **{name}**：プロフィール写 `{clean(debut_raw)}` 不精确，改用 wikipedia `{debut}`'
                    )
            elif wd:
                debut = wd

        groups = member_collabs.get(name, [])

        prev = previous.get(name) or {}
        gender = prev.get('gender', '')
        race = prev.get('race', '')
        height_final = prev.get('height') or height_raw
        age_final = prev.get('age') or age_raw
        debut_final = prev.get('debut') or debut or ''

        flags = []
        if not prof.get('profile_found') and not (height_final and age_final):
            flags.append('❌无档案')
        if not debut_final:
            flags.append('❌缺出道日')
        if not gender:
            flags.append('❌缺性别')
        if not race:
            flags.append('❌缺种族')
        if not age_final:
            flags.append('❌缺年龄')
        if not height_final:
            flags.append('❌缺身高')
        if ' / ' in age_final or ' / ' in height_final:
            flags.append('⚠️多值')
        if AGE_UNKNOWN.search(age_final or ''):
            flags.append('🟣年龄不详')

        lines.append(
            f"| {i} | {clean(name)} | {gender} | {debut_final} | "
            f"{clean(height_final)} | {clean(age_final)} | {len(groups)} | {race} | "
            f"{' '.join(flags) or '✅'} |"
        )

    lines.append('')
    lines.append('## 需要你重点核对的项')
    lines.append('')
    lines.append(f'- 总人数：**{len(roster)}**')
    missing_debut = [m['name'] for m in roster if not resolve_debut(m['name'])[1]]
    no_profile = [m['name'] for m in roster if not (profiles.get(m['name']) or {}).get('profile_found')]
    multi = [m['name'] for m in roster if any(
        ' / ' in ' / '.join((profiles.get(m['name']) or {}).get(k) or []) for k in ('age', 'height'))]

    lines.append(f'- 出道日仍缺失：**{len(missing_debut)}** 人 {missing_debut if missing_debut else ""}')
    lines.append(f'- 找不到档案表：**{len(no_profile)}** 人 {no_profile if no_profile else ""}')
    lines.append(f'- 年龄/身高为多值：**{len(multi)}** 人（已在主表用 ` / ` 标出）')
    lines.append('')
    lines.append('### 补记')
    lines.append('')
    lines.extend(notes or ['- 无'])
    lines.append('')

    (OUT / 'data-review.md').write_text('\n'.join(lines), encoding='utf-8')
    print(f'wrote {OUT / "data-review.md"} ({len(lines)} lines)')

    write_collabs(roster, collabs)


def write_collabs(roster, collabs):
    names = {m['name'] for m in roster}
    aliases = COLLAB_NAME_ALIASES
    out = []
    out.append('# 组合关系明细（コラボ一覧表）')
    out.append('')
    out.append('> 供核对「关系」判定用：同一组合 = 绿，不同 = 红。所有组合一律计入，不区分解散与否。')
    out.append('')

    by_member = {}
    for c in collabs:
        for m in c['members']:
            by_member.setdefault(m, []).append(c)
    for old, new in aliases.items():
        if new in by_member and old not in by_member:
            by_member[old] = by_member[new]

    out.append('## 每位成员的组合')
    out.append('')
    out.append('| 名字 | 组合数 | 组合名（人数） |')
    out.append('|---|---:|---|')
    for member in roster:
        name = member['name']
        items = by_member.get(name, [])
        detail = ' / '.join(f"{clean(c['name'])}({c['size']})" for c in items)
        out.append(f'| {clean(name)} | {len(items)} | {detail} |')

    out.append('')
    out.append('## 全部组合清单')
    out.append('')
    out.append('| # | 人数 | 组合名 | 成员 |')
    out.append('|---:|---:|---|---|')
    for i, c in enumerate(collabs, 1):
        members = ', '.join(clean(m) for m in c['members'])
        in_roster = sum(1 for m in c['members'] if m in names)
        out.append(
            f"| {i} | {c['size']} | {clean(c['name'])} | "
            f"{members} ({in_roster}/{len(c['members'])} 在名单内) |"
        )
    out.append('')

    (OUT / 'collabs.md').write_text('\n'.join(out), encoding='utf-8')
    print(f'wrote {OUT / "collabs.md"} ({len(collabs)} collabs)')

    roster_lines = ['# JP 成员名单（メンバーデータ一覧）', '', f'共 {len(roster)} 人。', '',
                    '| # | 名字 | wiki 页面 |', '|---:|---|---|']
    for i, m in enumerate(roster, 1):
        roster_lines.append(f"| {i} | {clean(m['name'])} | {m['url']} |")
    (OUT / 'roster.md').write_text('\n'.join(roster_lines) + '\n', encoding='utf-8')
    print(f'wrote {OUT / "roster.md"}')


if __name__ == '__main__':
    main()
