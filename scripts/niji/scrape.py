#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
彩虹社 (にじさんじ) 数据抓取脚本 —— Step 1

数据源:
  - 名单:      https://wikiwiki.jp/nijisanji/メンバーデータ一覧
  - 档案:      https://wikiwiki.jp/nijisanji/<name>  (锚点 name="profile" 后第一张表)
  - 組合:      https://wikiwiki.jp/nijisanji/コラボ一覧表
  - 出道日兜底: https://wikiwiki.jp/nijisanji/<name>/ライブ一覧/<year>

用法:
  python scripts/niji/scrape.py roster      # 只抓名单
  python scripts/niji/scrape.py profiles    # 抓档案 (可断点续跑)
  python scripts/niji/scrape.py collabs     # 抓組合
  python scripts/niji/scrape.py debut       # 给档案里出道日不全的补抓直播一览
  python scripts/niji/scrape.py report      # 生成 docs/niji/data-review.md

设计要点:
  - curl_cffi Safari 指纹 (普通 requests 会被 403)
  - 限速 2s/请求 + 429 指数退避, 缓存到 docs/niji/.cache/
  - 输出一律 UTF-8, 原文照抄不猜测
"""

import sys
import io
import os
import re
import json
import time
import html as html_module
import random
import urllib.parse
from pathlib import Path

from curl_cffi import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / 'docs' / 'niji'
CACHE_DIR = OUT_DIR / '.cache'
DATA_DIR = OUT_DIR / '.data'
for d in (OUT_DIR, CACHE_DIR, DATA_DIR):
    d.mkdir(parents=True, exist_ok=True)

BASE = 'https://wikiwiki.jp/nijisanji/'
MIN_INTERVAL = 2.0
_last_request = 0.0
_session = requests.Session(impersonate='safari')


def fetch(page: str, *, cache_name: str | None = None, retries: int = 5) -> str | None:
    """抓一个 wiki 页面, 带缓存与限速。page 是不含前缀的页面名。"""
    global _last_request
    cache_name = cache_name or re.sub(r'[^\w\-.]', '_', page)
    cache_file = CACHE_DIR / f'{cache_name}.html'
    if cache_file.exists() and cache_file.stat().st_size > 1000:
        return cache_file.read_text(encoding='utf-8', errors='replace')

    url = BASE + urllib.parse.quote(page)
    backoff = 5.0
    for attempt in range(retries):
        wait = MIN_INTERVAL - (time.time() - _last_request)
        if wait > 0:
            time.sleep(wait + random.uniform(0, 0.4))
        try:
            r = _session.get(url, timeout=45)
            _last_request = time.time()
            if r.status_code == 200:
                html = r.content.decode('utf-8', 'replace')
                cache_file.write_text(html, encoding='utf-8')
                return html
            if r.status_code in (429, 403, 503):
                print(f'  [{r.status_code}] backoff {backoff:.0f}s -> {page}', file=sys.stderr)
                time.sleep(backoff)
                backoff = min(backoff * 2, 120)
                continue
            print(f'  [{r.status_code}] {page}', file=sys.stderr)
            return None
        except Exception as exc:
            print(f'  [ERR] {page}: {exc}', file=sys.stderr)
            time.sleep(backoff)
            backoff = min(backoff * 2, 120)
    return None


def strip_tags(html: str) -> str:
    html = re.sub(r'<script[\s\S]*?</script>', ' ', html)
    html = re.sub(r'<style[\s\S]*?</style>', ' ', html)
    return html


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


# ---------------------------------------------------------------- roster

def scrape_roster() -> list[dict]:
    html = fetch('メンバーデータ一覧', cache_name='members')
    if not html:
        raise SystemExit('roster fetch failed')
    body = strip_tags(html)

    # 成员表是页面里行数最多的那张表; 导航链接不在表内, 直接按表解析
    tables = re.findall(r'<table[\s\S]*?</table>', body)
    if not tables:
        raise SystemExit('no tables found on roster page')
    main = max(tables, key=lambda t: t.count('<tr'))

    members, seen = [], set()
    for cells_html in re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', main):
        link = re.search(
            r'<th[^>]*>\s*<a href="/nijisanji/([^"]+)" title="([^"]+)" class="rel-wiki-page"',
            cells_html,
        )
        if not link:
            continue
        page = urllib.parse.unquote(link.group(1))
        # 只保留顶层成员页, 排除 "xxx/紹介" 这类子页
        if '/' in page or page in seen:
            continue
        seen.add(page)
        members.append({'name': page, 'page': page, 'url': BASE + link.group(1)})

    (DATA_DIR / 'roster.json').write_text(
        json.dumps(members, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    print(f'roster: {len(members)} members -> docs/niji/.data/roster.json')
    return members


# ---------------------------------------------------------------- profiles

PROFILE_FIELDS = {
    'gender': ['性別'],
    'age': ['年齢'],
    'height': ['身長'],
    'debut': ['デビュー日', 'デビュー'],
    'first_stream': ['初配信日'],
    'birthday': ['誕生日'],
    'race': ['種族'],
}


def first_table_after(html: str, start: int, window: int = 60000) -> str | None:
    """取 start 之后第一张完整的表; 页面里可能夹着 tablescroll/caption 之类的容器。"""
    opening = html.find('<table', start)
    if opening < 0 or opening - start > window:
        return None
    depth, i = 0, opening
    for match in re.finditer(r'<table\b|</table>', html[opening:opening + 400000]):
        depth += 1 if match.group(0).startswith('<table') else -1
        if depth == 0:
            i = opening + match.end()
            return html[opening:i]
    return None


def parse_profile(html: str) -> dict:
    body = strip_tags(html)
    res = {k: [] for k in PROFILE_FIELDS}
    res['profile_found'] = False

    anchor = re.search(r'name\s*=\s*"profile"', body)
    if anchor:
        table = first_table_after(body, anchor.end())
    else:
        table = table_by_label(body, PROFILE_FIELDS['age'])

    if not table:
        return res

    res['profile_found'] = True
    for cells in table_rows(table):
        if len(cells) < 2:
            continue
        label = cells[0].strip()
        value = cells[1].strip()
        for key, labels in PROFILE_FIELDS.items():
            if any(label == lab or label.startswith(lab) for lab in labels):
                if value and value not in res[key]:
                    res[key].append(value)
    return res


def table_by_label(body: str, labels: list[str]) -> str | None:
    """没有 profile 锚点时, 找第一张表头含指定标签的表 (如 年齢)。"""
    for table in re.finditer(r'<table\b', body):
        candidate = first_table_after(body, table.start())
        if not candidate or len(candidate) < 400:
            continue
        rows = table_rows(candidate)
        if not rows:
            continue
        first_labels = [r[0] for r in rows[:12] if r]
        if sum(1 for lab in first_labels if any(x in lab for x in labels)) >= 1:
            return candidate
    return None


def scrape_profiles(members: list[dict]) -> None:
    out_path = DATA_DIR / 'profiles.json'
    done = {}
    if out_path.exists():
        done = json.loads(out_path.read_text(encoding='utf-8'))

    todo = [m for m in members if m['name'] not in done]
    print(f'profiles: {len(done)} cached, {len(todo)} to fetch')
    for i, member in enumerate(todo, 1):
        name = member['name']
        html = fetch(member['page'])
        if html is None:
            print(f'  [{i}/{len(todo)}] FAILED {name}')
            continue
        done[name] = parse_profile(html)
        if i % 10 == 0 or i == len(todo):
            out_path.write_text(json.dumps(done, ensure_ascii=False, indent=2), encoding='utf-8')
            print(f'  [{i}/{len(todo)}] {name}  (checkpoint)')
    out_path.write_text(json.dumps(done, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'profiles saved: {len(done)}')


# ---------------------------------------------------------------- collabs

def scrape_collabs() -> None:
    html = fetch('コラボ一覧表', cache_name='collabs')
    if not html:
        raise SystemExit('collab fetch failed')
    body = strip_tags(html)

    tables = re.findall(r'<table[\s\S]*?</table>', body)
    collabs = []
    for ti, table in enumerate(tables):
        for cells in table_rows(table):
            if len(cells) < 4 or cells[0] in ('人数', ''):
                continue
            size, name, detail, members_raw = cells[0], cells[1], cells[2], cells[3]
            if not re.fullmatch(r'\d+', size.strip()):
                continue
            members = [m.strip() for m in re.split(r'[,、，]', members_raw) if m.strip()]
            if not members:
                continue
            collabs.append({
                'table_index': ti,
                'size': int(size),
                'name': name.strip(),
                'detail': detail.strip(),
                'members': members,
                'raw_name': name.strip(),
            })

    (DATA_DIR / 'collabs.json').write_text(
        json.dumps(collabs, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    print(f'collabs: {len(collabs)} rows -> docs/niji/.data/collabs.json')


# ---------------------------------------------------------------- debut fallback

LIVE_YEAR_LINK = re.compile(
    r'href="/nijisanji/([^"]*/%E3%83%A9%E3%82%A4%E3%83%96%E4%B8%80%E8%A6%A7/\d{4})"'
)
LIVE_ENTRY = re.compile(r'(20\d{2})/(\d{1,2})/(\d{1,2})')


def scrape_debut_fallback(members: list[dict]) -> None:
    """给 profile 里没有完整出道日的人, 从最旧的直播一览子页面找最早的直播日期。"""
    prof_path = DATA_DIR / 'profiles.json'
    profiles = json.loads(prof_path.read_text(encoding='utf-8')) if prof_path.exists() else {}

    out_path = DATA_DIR / 'debut_from_lives.json'
    done = json.loads(out_path.read_text(encoding='utf-8')) if out_path.exists() else {}

    targets = []
    for m in members:
        name = m['name']
        prof = profiles.get(name) or {}
        debut_raw = ' / '.join(prof.get('debut') or [])
        if has_full_date(debut_raw):
            continue
        if name in done:
            continue
        targets.append(name)

    print(f'debut fallback: {len(targets)} members need archive lookup')
    for i, name in enumerate(targets, 1):
        html = fetch(m['page'] if False else name)
        entry = {'live_pages': [], 'earliest': None, 'earliest_url': None, 'error': None}
        if html is None:
            entry['error'] = 'main page failed'
            done[name] = entry
            continue

        body = strip_tags(html)
        # find year archive links
        rel_links = re.findall(r'href="/nijisanji/([^"]+%E3%83%A9%E3%82%A4%E3%83%96%E4%B8%80%E8%A6%A7/(\d{4}))"', body)
        years = sorted({(y, p) for p, y in rel_links})
        if not years:
            entry['error'] = 'no live archive links'
            done[name] = entry
            continue

        for year, path in years:
            page = urllib.parse.unquote(path)
            entry['live_pages'].append(page)
            sub = fetch(page)
            if not sub:
                continue
            m2 = re.search(r'name\s*=\s*"[^"]*_%s"' % year, strip_tags(sub))
            seg = strip_tags(sub)[m2.start():] if m2 else strip_tags(sub)
            dates = LIVE_ENTRY.findall(seg[:200000])
            if not dates:
                continue
            best = min(tuple(int(x) for x in d) for d in dates)
            if entry['earliest'] is None or best < tuple(entry['earliest']):
                entry['earliest'] = list(best)
                m3 = re.search(
                    r'(20\d{2}/\d{1,2}/\d{1,2})[\s\S]{0,400}?href="(https?://[^"]+)"', seg[:200000]
                )
                entry['earliest_url'] = m3.group(2) if m3 else None
            break  # oldest year with entries wins

        if entry['earliest']:
            entry['earliest'] = '%04d-%02d-%02d' % tuple(entry['earliest'])
        done[name] = entry
        if i % 5 == 0 or i == len(targets):
            out_path.write_text(json.dumps(done, ensure_ascii=False, indent=2), encoding='utf-8')
            print(f'  [{i}/{len(targets)}] {name} -> {entry["earliest"]}')
    out_path.write_text(json.dumps(done, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'debut fallback saved: {len(done)}')


def has_full_date(text: str) -> bool:
    return bool(re.search(r'20\d{2}\s*[年/\-.]\s*\d{1,2}\s*[月/\-.]\s*\d{1,2}', text or ''))


# ---------------------------------------------------------------- wikipedia debut

WIKI_URL = 'https://ja.wikipedia.org/wiki/%E3%81%AB%E3%81%98%E3%81%95%E3%82%93%E3%81%98'


def expand_rows(table_html: str) -> list[list[str]]:
    """展开 rowspan: 维基表格里同一期生的日期只写一次并纵向合并。"""
    pending: dict[int, list] = {}
    out = []
    for row_html in re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', table_html):
        cells = []
        for _tag, attrs, inner in re.findall(r'<(t[hd])([^>]*)>([\s\S]*?)</\1>', row_html):
            rs = re.search(r'rowspan="?(\d+)', attrs)
            span = int(rs.group(1)) if rs else 1
            text = re.sub(r'<br[^>]*>', ' / ', inner)
            text = re.sub(r'<sup[\s\S]*?</sup>', '', text)
            text = re.sub(r'<[^>]+>', '', text)
            cells.append([re.sub(r'\s+', ' ', text).strip(), span])

        width = max([len(cells)] + [c + 1 for c in pending]) if pending else len(cells)
        merged = []
        for c in range(width):
            if c in pending:
                merged.append(pending[c][0])
                pending[c][1] -= 1
                if pending[c][1] <= 0:
                    del pending[c]
            else:
                text, span = cells[c] if c < len(cells) else ('', 1)
                merged.append(text)
                if span > 1:
                    pending[c] = [text, span - 1]
        out.append(merged)
    return out


def scrape_debut_from_wikipedia() -> dict:
    global _last_request
    cache_file = CACHE_DIR / 'wikipedia_nijisanji.html'
    if cache_file.exists() and cache_file.stat().st_size > 1000:
        html = cache_file.read_text(encoding='utf-8', errors='replace')
    else:
        wait = MIN_INTERVAL - (time.time() - _last_request)
        if wait > 0:
            time.sleep(wait)
        r = _session.get(WIKI_URL, timeout=60)
        _last_request = time.time()
        if r.status_code != 200:
            raise SystemExit(f'wikipedia fetch failed: {r.status_code}')
        html = r.content.decode('utf-8', 'replace')
        cache_file.write_text(html, encoding='utf-8')

    body = strip_tags(html)
    anchor = body.find('活動開始日')
    if anchor < 0:
        raise SystemExit('wikipedia: 活動開始日 column not found')
    tstart = body.rfind('<table', 0, anchor)
    tend = body.find('</table>', anchor)
    rows = expand_rows(body[tstart:tend + 8])

    result = {}
    alias = {}
    for row in rows[1:]:
        if len(row) < 3 or not row[0]:
            continue
        raw_name = row[0]
        name = re.split(r'[（(]', raw_name)[0].strip()
        cell = row[2]
        date = YMD.search(cell)
        entry = {
            'raw': cell,
            'date': '%04d-%02d-%02d' % tuple(int(x) for x in date.groups()) if date else None,
            'reading': row[1],
        }
        result[name] = entry
        # 読み欄には「Hana Macchia」等のラテン表記が入るので別名として索引する
        reading = (row[1] or '').strip()
        if reading and reading != name:
            alias[reading] = name
            alias[reading.replace(' ', '')] = name

    (DATA_DIR / 'wikipedia_alias.json').write_text(
        json.dumps(alias, ensure_ascii=False, indent=2), encoding='utf-8'
    )

    (DATA_DIR / 'wikipedia_debut.json').write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    matched = sum(1 for v in result.values() if v['date'])
    print(f'wikipedia debut: {len(result)} rows, {matched} with date')
    return result


YMD = re.compile(r'(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日')


# ---------------------------------------------------------------- report

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'help'
    if cmd == 'roster':
        scrape_roster()
    elif cmd == 'profiles':
        members = json.loads((DATA_DIR / 'roster.json').read_text(encoding='utf-8'))
        scrape_profiles(members)
    elif cmd == 'collabs':
        scrape_collabs()
    elif cmd == 'debut':
        members = json.loads((DATA_DIR / 'roster.json').read_text(encoding='utf-8'))
        scrape_debut_fallback(members)
    elif cmd == 'wiki':
        scrape_debut_from_wikipedia()
    else:
        print(__doc__)


if __name__ == '__main__':
    main()
