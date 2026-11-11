#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 wiki コラボ一覧表 提取「コラボ名」脚注, 生成服务端与客户端脚注表

用法:
  python scripts/niji/gen_collab_notes.py

服务端表 key 为抓取时的原始组合名（含 *N），用于把旧数据库里的字符串
迁移成 { name, note }；客户端表同时包含原始 key 与去掉 *N 的 key，作为
旧回放数据的兜底。
"""

import html as html_module
import json
import re
import sys
from pathlib import Path

# scrape 在导入时已把 stdout/stderr 包装成 UTF-8, 这里不要重复包装(会在退出时关闭底层流)
from scrape import fetch  # noqa: E402  (scripts/niji 在 sys.path[0])

ROOT = Path(__file__).resolve().parents[2]
SERVER_OUT = ROOT / 'server' / 'src' / 'db' / 'seeds' / 'collabLegacyNotes.json'
CLIENT_OUT = ROOT / 'client' / 'src' / 'config' / 'collabNotes.ts'

NOTE_ANCHOR = re.compile(r'<a\b[^>]*class="[^"]*note_super[^"]*"[^>]*>')
NOTE_CONTENT = re.compile(r'data-tooltip-content="([^"]*)"')
FOOTNOTE_MARKER = re.compile(r'\*\d+')


def cell_text(cell: str) -> str:
    text = re.sub(r'<br[^>]*>', ' / ', cell)
    text = re.sub(r'<[^>]+>', '', text)
    text = html_module.unescape(text)
    text = text.replace('\u3000', ' ')
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def note_text(raw: str) -> str:
    text = html_module.unescape(raw)
    # 去掉脚注末尾的「脚注 *N へ」跳转块
    text = re.sub(r'<div style="text-align: right;">[\s\S]*?</div>', ' ', text)
    text = re.sub(r'</p>|<br[^>]*>', ' ', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = html_module.unescape(text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def parse_notes(page_html: str) -> dict[str, str]:
    notes: dict[str, list[str]] = {}
    for table in re.findall(r'<table[\s\S]*?</table>', page_html):
        if 'コラボ名' not in table:
            continue
        for row in re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', table):
            cells = re.findall(r'<t[dh][^>]*>([\s\S]*?)</t[dh]>', row)
            if len(cells) < 4:
                continue
            anchors = NOTE_ANCHOR.findall(cells[1])
            if not anchors:
                continue
            texts = []
            for anchor in anchors:
                content = NOTE_CONTENT.search(anchor)
                if not content:
                    continue
                text = note_text(content.group(1))
                if text and text not in texts:
                    texts.append(text)
            name = cell_text(cells[1])
            if not name or not texts:
                continue
            bucket = notes.setdefault(name, [])
            for text in texts:
                if text not in bucket:
                    bucket.append(text)
    return {key: '；'.join(texts) for key, texts in notes.items()}


def main() -> None:
    html = fetch('コラボ一覧表', cache_name='collabs')
    if not html:
        raise SystemExit('collab fetch failed')
    raw_notes = parse_notes(html)

    SERVER_OUT.parent.mkdir(parents=True, exist_ok=True)
    SERVER_OUT.write_text(
        json.dumps(dict(sorted(raw_notes.items())), ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )

    client_notes: dict[str, str] = {}
    for raw_key, note in raw_notes.items():
        client_notes[raw_key] = note
        clean_key = FOOTNOTE_MARKER.sub('', raw_key).strip()
        if not clean_key:
            continue
        existing = client_notes.get(clean_key)
        if not existing:
            client_notes[clean_key] = note
        elif note not in existing.split('；'):
            client_notes[clean_key] = f'{existing}；{note}'

    lines = [
        '/**',
        ' * 组合名脚注（来源：wikiwiki コラボ一覧表 的「コラボ名」单元格脚注）。',
        ' * 带 *N 的 key 用于旧回放数据；不带序号的 key 用于旧接口返回的纯名字。',
        ' * 由 scripts/niji/gen_collab_notes.py 生成，请勿手改。',
        ' */',
        'const COLLAB_NOTES: Record<string, string> = {',
    ]
    for key in sorted(client_notes):
        lines.append(f'  {json.dumps(key, ensure_ascii=False)}: {json.dumps(client_notes[key], ensure_ascii=False)},')
    lines.extend(['};', '', 'export default COLLAB_NOTES;', ''])
    CLIENT_OUT.write_text('\n'.join(lines), encoding='utf-8')

    print(f'wrote {SERVER_OUT} ({len(raw_notes)} raw notes)')
    print(f'wrote {CLIENT_OUT} ({len(client_notes)} keys)')


if __name__ == '__main__':
    main()
