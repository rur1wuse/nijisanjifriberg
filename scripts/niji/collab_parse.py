#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
组合数据解析、映射与比对（纯函数，不做任何网络请求）。

页面：https://wikiwiki.jp/nijisanji/コラボ一覧表
表格行：人数 / コラボ名 / 詳細 / メンバー
"""

import html as html_module
import re

FOOTNOTE_MARKER = re.compile(r'\*\d+')

# wiki 页面成员名 -> 种子昵称（页面用「ましろ爻」，种子用「ましろ」）
MEMBER_ALIASES = {'ましろ爻': 'ましろ'}

# 页面异常时的兜底阈值
MIN_COLLAB_ROWS = 1000
MIN_DISTINCT_RATIO = 0.85
MIN_MEMBERSHIP_RATIO = 0.90
MAX_REMOVAL_RATIO = 0.10


def strip_marker(name: str) -> str:
    """去掉脚注序号 *N 并压缩空白。"""
    return FOOTNOTE_MARKER.sub('', name or '').strip()


def cell_text(cell: str) -> str:
    """保留多值: <br> 转 ' / ', 解 HTML 实体, 压缩空白但不合并分隔符。"""
    text = re.sub(r'<br[^>]*>', ' / ', cell)
    text = re.sub(r'<[^>]+>', '', text)
    text = html_module.unescape(text)
    text = text.replace('\u3000', ' ')
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def table_rows(table_html: str):
    """把 <table> 拆成 [[cell, cell, ...], ...]"""
    rows = []
    for row in re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', table_html):
        cells = re.findall(r'<t[dh][^>]*>([\s\S]*?)</t[dh]>', row)
        if cells:
            rows.append([cell_text(c) for c in cells])
    return rows


def parse_collabs(page_html: str) -> list[dict]:
    """从页面 HTML 提取全部组合行。"""
    body = re.sub(r'<script[\s\S]*?</script>', ' ', page_html)
    body = re.sub(r'<style[\s\S]*?</style>', ' ', body)

    collabs = []
    for table_index, table in enumerate(re.findall(r'<table[\s\S]*?</table>', body)):
        for cells in table_rows(table):
            if len(cells) < 4 or cells[0] in ('人数', ''):
                continue
            size, name, detail, members_raw = cells[0], cells[1], cells[2], cells[3]
            if not re.fullmatch(r'\d+', size.strip()):
                continue
            members = [member.strip() for member in re.split(r'[,、，]', members_raw) if member.strip()]
            if not members:
                continue
            collabs.append({
                'table_index': table_index,
                'size': int(size),
                'name': name.strip(),
                'detail': detail.strip(),
                'members': members,
                'raw_name': name.strip(),
            })
    return collabs


def member_key(name: str) -> str:
    """抹平括号昵称、空格、中黑点与大小写，用于页面/种子的二次匹配。"""
    text = strip_marker(name).lower()
    text = re.sub(r'[（(].*?[）)]', '', text)
    return re.sub(r'[\s・·\u3000]+', '', text)


def resolve_member(raw_name: str, known: set[str]) -> str | None:
    """把页面成员名映射到种子昵称；未知成员返回 None。"""
    name = strip_marker(raw_name)
    if not name:
        return None
    if name in known:
        return name
    alias = MEMBER_ALIASES.get(name)
    if alias and alias in known:
        return alias
    key = member_key(name)
    matches = [candidate for candidate in known if member_key(candidate) == key]
    if len(matches) == 1:
        return matches[0]
    return None


def notes_from_players(players: list[dict]) -> dict[str, str | None]:
    """从当前种子数据收集「组合名 -> 唯一脚注」；同名多脚注时记为 None。"""
    buckets: dict[str, set[str]] = {}
    for player in players:
        for group in player.get('collab_groups') or []:
            name = strip_marker(str(group.get('name') or ''))
            note = str(group.get('note') or '').strip()
            if name and note:
                buckets.setdefault(name, set()).add(note)
    return {
        name: (next(iter(values)) if len(values) == 1 else None)
        for name, values in buckets.items()
    }


def canonical_groups(groups) -> list[dict]:
    """去脚注、去重、按 (name, note) 排序，作为比较与写回的规范形态。"""
    seen: set[tuple[str, str]] = set()
    result: list[dict] = []
    for group in groups or []:
        if isinstance(group, str):
            name, note = strip_marker(group), ''
        elif isinstance(group, dict):
            name = strip_marker(str(group.get('name') or ''))
            note = str(group.get('note') or '').strip()
        else:
            continue
        if not name:
            continue
        key = (name, note)
        if key in seen:
            continue
        seen.add(key)
        item = {'name': name}
        if note:
            item['note'] = note
        result.append(item)
    return sorted(result, key=lambda group: (group['name'], group.get('note', '')))


def group_key(group: dict) -> str:
    return f"{group['name']}\u0000{group.get('note', '')}"


def build_member_groups(
    collabs: list[dict],
    nicknames: list[str],
    page_notes: dict[str, str],
    existing_notes: dict[str, str | None],
) -> tuple[dict[str, list[dict]], list[str]]:
    """按成员聚合组合；note 优先级：本次页面脚注 > 当前种子唯一脚注。"""
    known = set(nicknames)
    by_member: dict[str, list[dict]] = {}
    unknown: set[str] = set()
    name_counts: dict[str, int] = {}
    for collab in collabs:
        name = strip_marker(collab['name'])
        name_counts[name] = name_counts.get(name, 0) + 1

    for collab in collabs:
        group: dict = {'name': strip_marker(collab['name'])}
        note = (
            page_notes.get(collab['raw_name'])
            or page_notes.get(group['name'])
            or (existing_notes.get(group['name']) if name_counts.get(group['name']) == 1 else None)
            or ''
        )
        if note:
            group['note'] = note
        for raw_member in collab['members']:
            member = resolve_member(raw_member, known)
            if member is None:
                unknown.add(strip_marker(raw_member))
                continue
            by_member.setdefault(member, []).append(group)

    return (
        {member: canonical_groups(groups) for member, groups in by_member.items()},
        sorted(unknown),
    )


def diff_groups(current, desired) -> tuple[list[dict], list[dict]]:
    current_groups = canonical_groups(current)
    desired_groups = canonical_groups(desired)
    current_keys = {group_key(group) for group in current_groups}
    desired_keys = {group_key(group) for group in desired_groups}
    added = [group for group in desired_groups if group_key(group) not in current_keys]
    removed = [group for group in current_groups if group_key(group) not in desired_keys]
    return added, removed


def check_guards(
    *,
    collab_rows: int,
    distinct_groups: int,
    member_group_pairs: int,
    baseline_distinct_groups: int,
    baseline_memberships: int,
    total_removed: int,
    allow_large_removals: bool,
) -> list[str]:
    """抓取/解析异常时返回错误列表；调用方据此拒绝写文件。"""
    errors: list[str] = []
    if collab_rows < MIN_COLLAB_ROWS:
        errors.append(f'parsed only {collab_rows} collab rows (< {MIN_COLLAB_ROWS})')
    if member_group_pairs == 0:
        errors.append('no member matched the seed roster')
    if baseline_distinct_groups and distinct_groups < baseline_distinct_groups * MIN_DISTINCT_RATIO:
        errors.append(
            f'distinct groups {distinct_groups} < {MIN_DISTINCT_RATIO:.0%} of baseline {baseline_distinct_groups}'
        )
    if baseline_memberships and member_group_pairs < baseline_memberships * MIN_MEMBERSHIP_RATIO:
        errors.append(
            f'member-group pairs {member_group_pairs} < {MIN_MEMBERSHIP_RATIO:.0%} '
            f'of baseline {baseline_memberships}'
        )
    if (
        not allow_large_removals
        and baseline_memberships
        and total_removed > baseline_memberships * MAX_REMOVAL_RATIO
    ):
        errors.append(
            f'{total_removed} removals exceed {MAX_REMOVAL_RATIO:.0%} of baseline memberships; '
            're-run with --allow-large-removals after checking the page'
        )
    return errors
