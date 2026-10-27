#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""由 docs/niji/data-review.md + collabs.md 生成 server/src/db/seeds/players.json"""

import sys
import io
import json
import re
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = Path(__file__).resolve().parents[2]
REVIEW = ROOT / 'docs' / 'niji' / 'data-review.md'
DATA = ROOT / 'docs' / 'niji' / '.data'
OUT = ROOT / 'server' / 'src' / 'db' / 'seeds' / 'players.json'

COLLAB_ALIASES = {'ましろ': 'ましろ爻'}


def read_review():
    rows = []
    for line in REVIEW.read_text(encoding='utf-8').splitlines():
        if not line.startswith('| ') or line.startswith('| #') or line.startswith('|---'):
            continue
        parts = [p.strip() for p in re.split(r'\s*\|\s*', line)[1:-1]]
        if len(parts) < 8 or not parts[0].isdigit():
            continue
        rows.append({
            'index': int(parts[0]),
            'nickname': parts[1],
            'gender': parts[2],
            'debut_date': parts[3],
            'height_cm': parts[4],
            'age_text': parts[5],
            'race': parts[7],
        })
    return rows


def read_collabs():
    collabs = json.loads((DATA / 'collabs.json').read_text(encoding='utf-8'))
    by_member = {}
    for c in collabs:
        for name in c['members']:
            by_member.setdefault(name, []).append(c['name'])
    for old, new in COLLAB_ALIASES.items():
        if new in by_member and old not in by_member:
            by_member[old] = by_member[new]
    return by_member


def main():
    rows = read_review()
    collabs = read_collabs()

    players = []
    for row in rows:
        groups = sorted(set(collabs.get(row['nickname'], [])))
        players.append({
            'nickname': row['nickname'],
            'gender': row['gender'],
            'debut_date': row['debut_date'],
            'height_cm': row['height_cm'],
            'age_text': row['age_text'],
            'race': row['race'],
            'collab_groups': groups,
            'difficulties': ['normal'],
            'is_enabled': True,
        })

    OUT.write_text(json.dumps(players, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'wrote {OUT} ({len(players)} players)')

    missing = [p['nickname'] for p in players if not p['debut_date']]
    print(f'without debut_date: {len(missing)}')


if __name__ == '__main__':
    main()
