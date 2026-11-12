#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
同步 wikiwiki「コラボ一覧表」到选手种子数据（只改 collab_groups）。

用法:
  python scripts/niji/sync_collabs.py                    # 抓取并报告 diff，不写文件
  python scripts/niji/sync_collabs.py --write            # 写回 players.json / collabs.md / 脚注表
  python scripts/niji/sync_collabs.py --report-json out.json --report-md out.md

退出码: 0 正常（有无变化都算正常）；2 抓取结果异常（拒绝写文件）；3 抓取失败。
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import scrape  # 先导入：它会把 stdout 包装成 UTF-8
from gen_collab_notes import parse_notes, write_note_files
from collab_parse import (
    build_member_groups,
    canonical_groups,
    check_guards,
    diff_groups,
    notes_from_players,
    parse_collabs,
    strip_marker,
)
from report import render_collabs

ROOT = Path(__file__).resolve().parents[2]
SEEDS = ROOT / 'server' / 'src' / 'db' / 'seeds' / 'players.json'
NOTES = ROOT / 'server' / 'src' / 'db' / 'seeds' / 'collabLegacyNotes.json'
COLLABS_DOC = ROOT / 'docs' / 'niji' / 'collabs.md'
PAGE = 'コラボ一覧表'


def group_label(group: dict) -> str:
    note = group.get('note') or ''
    return f"{group['name']} ({note})" if note else group['name']


def build_report(
    *,
    page_bytes: int,
    collabs: list[dict],
    by_member: dict[str, list[dict]],
    unknown: list[str],
    vanished: list[str],
    changes: list[dict],
    groups_without_note: list[str],
) -> dict:
    added = sum(len(change['added']) for change in changes)
    removed = sum(len(change['removed']) for change in changes)
    return {
        'generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'pageBytes': page_bytes,
        'collabRows': len(collabs),
        'distinctGroups': len({strip_marker(collab['name']) for collab in collabs}),
        'memberGroupPairs': sum(len(groups) for groups in by_member.values()),
        'playersChanged': len(changes),
        'added': added,
        'removed': removed,
        'changes': changes,
        'unknownMembers': unknown,
        'vanishedPlayers': vanished,
        'groupsWithoutNote': groups_without_note,
    }


def render_markdown(report: dict) -> str:
    lines = [
        '# 自动同步 wikiwiki 组合数据',
        '',
        f"生成时间：{report['generatedAt']}",
        '',
        '| 指标 | 值 |',
        '|---|---:|',
        f"| 页面大小 | {report['pageBytes']} B |",
        f"| 组合行数 | {report['collabRows']} |",
        f"| 不同组合名 | {report['distinctGroups']} |",
        f"| 成员-组合关系 | {report['memberGroupPairs']} |",
        f"| 变动玩家 | {report['playersChanged']} |",
        f"| 新增关系 | {report['added']} |",
        f"| 移除关系 | {report['removed']} |",
        '',
    ]

    changes = report['changes']
    if changes:
        lines.append(f"## 变动玩家（{len(changes)}）")
        lines.append('')
        for change in changes[:30]:
            lines.append(f"### {change['nickname']}")
            for group in change['added'][:10]:
                lines.append(f"- + {group_label(group)}")
            if len(change['added']) > 10:
                lines.append(f"- … 另有 {len(change['added']) - 10} 条新增")
            for group in change['removed'][:10]:
                lines.append(f"- - {group_label(group)}")
            if len(change['removed']) > 10:
                lines.append(f"- … 另有 {len(change['removed']) - 10} 条移除")
            lines.append('')
        if len(changes) > 30:
            lines.append(f"… 另有 {len(changes) - 30} 名玩家，完整数据见 `--report-json`。")
            lines.append('')

    if report['vanishedPlayers']:
        lines.append(f"## 组合被清空的玩家（{len(report['vanishedPlayers'])}）")
        lines.append('')
        lines.append('这些玩家在当前页面一个组合都匹配不到，通常是页面改名或抓取异常。')
        lines.append('')
        for name in report['vanishedPlayers']:
            lines.append(f'- {name}')
        lines.append('')

    if report['unknownMembers']:
        lines.append(f"## 未匹配成员（{len(report['unknownMembers'])}）")
        lines.append('')
        lines.append('这些名字不在 `players.json` 中，可能尚未入种子或页面写法变了；本次不建号。')
        lines.append('')
        for name in report['unknownMembers'][:50]:
            lines.append(f'- {name}')
        if len(report['unknownMembers']) > 50:
            lines.append(f'- … 另有 {len(report["unknownMembers"]) - 50} 个')
        lines.append('')

    if report['groupsWithoutNote']:
        lines.append(f"## 无脚注的新组合（{len(report['groupsWithoutNote'])}）")
        lines.append('')
        lines.append('同名不同成员时容易混淆，建议确认是否需要补 `collabLegacyNotes.json`。')
        lines.append('')
        for name in report['groupsWithoutNote'][:50]:
            lines.append(f'- {name}')
        if len(report['groupsWithoutNote']) > 50:
            lines.append(f'- … 另有 {len(report["groupsWithoutNote"]) - 50} 个')
        lines.append('')

    lines.append('> 合并不会更新生产库：部署后需运行 `docker compose run --rm apply-collabs`（dry-run），')
    lines.append('> 再运行 `docker compose run --rm apply-collabs server/dist/db/applyCollabGroups.js --apply`。')
    lines.append('')
    return '\n'.join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description='Sync wikiwiki collab groups into players.json')
    parser.add_argument('--write', action='store_true', help='write changes back to the repo')
    parser.add_argument('--report-json', help='write a machine-readable report to this path')
    parser.add_argument('--report-md', help='write a markdown report to this path')
    parser.add_argument(
        '--allow-large-removals',
        action='store_true',
        help='accept removals above 10%% of the current memberships',
    )
    args = parser.parse_args()

    html = scrape.fetch(PAGE, cache_name='collabs', force=True)
    if not html:
        print('[collab-sync] fetch failed', file=sys.stderr)
        return 3

    collabs = parse_collabs(html)
    page_notes = parse_notes(html)
    players = json.loads(SEEDS.read_text(encoding='utf-8'))
    nicknames = [str(player['nickname']) for player in players]
    existing_notes = notes_from_players(players)

    by_member, unknown = build_member_groups(collabs, nicknames, page_notes, existing_notes)

    baseline_memberships = sum(len(player.get('collab_groups') or []) for player in players)
    baseline_distinct_groups = len({
        strip_marker(str(group.get('name') or ''))
        for player in players
        for group in (player.get('collab_groups') or [])
        if strip_marker(str(group.get('name') or ''))
    })

    changes = []
    vanished = []
    total_removed = 0
    without_note = set()
    for player in players:
        nickname = str(player['nickname'])
        current = canonical_groups(player.get('collab_groups') or [])
        desired = by_member.get(nickname, [])
        if current and not desired:
            vanished.append(nickname)
        added, removed = diff_groups(current, desired)
        if not added and not removed:
            continue
        total_removed += len(removed)
        for group in added:
            if not group.get('note'):
                without_note.add(group['name'])
        changes.append({
            'nickname': nickname,
            'added': added,
            'removed': removed,
            'desired': desired,
        })

    errors = check_guards(
        collab_rows=len(collabs),
        distinct_groups=len({strip_marker(collab['name']) for collab in collabs}),
        member_group_pairs=sum(len(groups) for groups in by_member.values()),
        baseline_distinct_groups=baseline_distinct_groups,
        baseline_memberships=baseline_memberships,
        total_removed=total_removed,
        allow_large_removals=args.allow_large_removals,
    )
    if vanished and not args.allow_large_removals:
        errors.append(
            f'{len(vanished)} players lost all groups (likely a page rename): '
            + ', '.join(vanished[:10])
        )
    baseline_notes = (
        json.loads(NOTES.read_text(encoding='utf-8')) if NOTES.exists() else {}
    )
    if (
        baseline_notes
        and not args.allow_large_removals
        and len(page_notes) < len(baseline_notes) * 0.9
    ):
        errors.append(
            f'parsed {len(page_notes)} notes < 90% of baseline {len(baseline_notes)}; '
            'the page footnote markup may have changed'
        )
    report = build_report(
        page_bytes=len(html.encode('utf-8')),
        collabs=collabs,
        by_member=by_member,
        unknown=unknown,
        vanished=vanished,
        changes=[{key: value for key, value in change.items() if key != 'desired'} for change in changes],
        groups_without_note=sorted(without_note),
    )

    if args.report_json:
        Path(args.report_json).write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
        )
    if args.report_md:
        Path(args.report_md).write_text(render_markdown(report), encoding='utf-8')

    if errors:
        for error in errors:
            print(f'[collab-sync] guard: {error}', file=sys.stderr)
        print('[collab-sync] aborted without writing files', file=sys.stderr)
        return 2

    if args.write and changes:
        change_by_nickname = {change['nickname']: change for change in changes}
        for player in players:
            change = change_by_nickname.get(str(player['nickname']))
            if change:
                player['collab_groups'] = change['desired']
        SEEDS.write_text(
            json.dumps(players, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
        )
        write_note_files(page_notes)
        COLLABS_DOC.write_text(render_collabs(nicknames, collabs), encoding='utf-8')
        print(f'[collab-sync] wrote {SEEDS.name}, collabs.md and note tables')

    print(
        f"[collab-sync] mode={'write' if args.write else 'check'} "
        f"players={len(players)} changed={len(changes)} "
        f"added={report['added']} removed={report['removed']} "
        f"unknown={len(unknown)}"
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())
