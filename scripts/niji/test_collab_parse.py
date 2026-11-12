#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""collab_parse.py 的纯函数测试（不联网）。"""

import unittest

import collab_parse as cp

TABLE = '''
<table>
  <tr><th>人数</th><th>コラボ名</th><th>詳細</th><th>メンバー</th></tr>
  <tr><td>2</td><td>テスト組*1</td><td>テスト</td><td>月ノ美兎, ましろ</td></tr>
  <tr><td>3</td><td>もう一組</td><td></td><td>月ノ美兎、剣持刀也，ましろ</td></tr>
  <tr><td>x</td><td>壊れた行</td><td></td><td>月ノ美兎</td></tr>
</table>
'''


class ParseTests(unittest.TestCase):
    def test_parse_collabs_keeps_valid_rows(self):
        collabs = cp.parse_collabs(TABLE)
        self.assertEqual([c['name'] for c in collabs], ['テスト組*1', 'もう一組'])
        self.assertEqual(collabs[0]['members'], ['月ノ美兎', 'ましろ'])
        self.assertEqual(collabs[1]['members'], ['月ノ美兎', '剣持刀也', 'ましろ'])

    def test_parse_collabs_strips_member_footnote_markers(self):
        html = (
            '<table><tr><td>3</td><td>ROF-MAO(ろふまお)</td><td></td>'
            '<td>加賀美ハヤト, 不破湊, <a>甲斐田晴</a>'
            '<a class="note_super">*161</a></td></tr></table>'
        )
        collabs = cp.parse_collabs(html)
        self.assertEqual(
            collabs[0]['members'], ['加賀美ハヤト', '不破湊', '甲斐田晴']
        )

    def test_strip_marker(self):
        self.assertEqual(cp.strip_marker('ACDC*21'), 'ACDC')
        self.assertEqual(cp.strip_marker(' テスト*3 '), 'テスト')

    def test_resolve_member_alias_and_unknown(self):
        known = {'月ノ美兎', 'ましろ'}
        self.assertEqual(cp.resolve_member('月ノ美兎*2', known), '月ノ美兎')
        self.assertEqual(cp.resolve_member('ましろ爻', known), 'ましろ')
        self.assertIsNone(cp.resolve_member('新人', known))

    def test_resolve_member_ignores_page_parenthetical_alias(self):
        known = {'オリバー・エバンス', '四季凪アキラ'}
        self.assertEqual(cp.resolve_member('オリバー・エバンス(オリヴィエ)', known), 'オリバー・エバンス')
        self.assertEqual(cp.resolve_member('四季凪アキラ(セイラ)', known), '四季凪アキラ')
        self.assertIsNone(cp.resolve_member('別人(オリヴィエ)', known))

    def test_notes_from_players_ignores_conflicts(self):
        players = [
            {'collab_groups': [{'name': 'A*1', 'note': 'n1'}, {'name': 'B', 'note': 'x'}]},
            {'collab_groups': [{'name': 'B', 'note': 'y'}]},
        ]
        notes = cp.notes_from_players(players)
        self.assertEqual(notes['A'], 'n1')
        self.assertIsNone(notes['B'])


class GroupTests(unittest.TestCase):
    def test_canonical_groups_dedupes_and_sorts(self):
        groups = [
            {'name': 'B*2', 'note': 'n'},
            'A',
            {'name': 'B', 'note': 'n'},
            {'name': 'A', 'note': 'other'},
        ]
        self.assertEqual(
            cp.canonical_groups(groups),
            [
                {'name': 'A'},
                {'name': 'A', 'note': 'other'},
                {'name': 'B', 'note': 'n'},
            ],
        )

    def test_build_member_groups_prefers_page_note(self):
        collabs = cp.parse_collabs(TABLE)
        existing = {'テスト組': 'old note'}
        by_member, unknown = cp.build_member_groups(
            collabs, ['月ノ美兎', 'ましろ', '剣持刀也'], {'テスト組*1': 'new note'}, existing
        )
        self.assertEqual(unknown, [])
        self.assertEqual(
            by_member['ましろ'],
            [{'name': 'もう一組'}, {'name': 'テスト組', 'note': 'new note'}],
        )
        self.assertIn({'name': 'もう一組'}, by_member['剣持刀也'])

    def test_same_name_without_page_note_does_not_borrow_existing_note(self):
        collabs = [
            {'name': '月組*90', 'raw_name': '月組*90', 'members': ['A']},
            {'name': '月組', 'raw_name': '月組', 'members': ['B']},
        ]
        by_member, _ = cp.build_member_groups(
            collabs, ['A', 'B'], {'月組*90': 'unit'}, {'月組': 'unit'}
        )
        self.assertEqual(by_member['A'], [{'name': '月組', 'note': 'unit'}])
        self.assertEqual(by_member['B'], [{'name': '月組'}])

    def test_build_member_groups_falls_back_to_existing_note(self):
        collabs = cp.parse_collabs(TABLE)
        by_member, _ = cp.build_member_groups(
            collabs, ['月ノ美兎'], {}, {'テスト組': 'old note'}
        )
        self.assertIn({'name': 'テスト組', 'note': 'old note'}, by_member['月ノ美兎'])

    def test_diff_groups(self):
        added, removed = cp.diff_groups(
            [{'name': 'A'}, {'name': 'B', 'note': 'n'}],
            [{'name': 'A'}, {'name': 'C'}],
        )
        self.assertEqual(added, [{'name': 'C'}])
        self.assertEqual(removed, [{'name': 'B', 'note': 'n'}])


class GuardTests(unittest.TestCase):
    def guards(self, **overrides):
        values = {
            'collab_rows': 1801,
            'distinct_groups': 1660,
            'member_group_pairs': 5025,
            'baseline_distinct_groups': 1660,
            'baseline_memberships': 5025,
            'total_removed': 0,
            'allow_large_removals': False,
        }
        values.update(overrides)
        return cp.check_guards(**values)

    def test_healthy_snapshot_passes(self):
        self.assertEqual(self.guards(), [])

    def test_truncated_page_is_rejected(self):
        errors = self.guards(collab_rows=120, distinct_groups=100, member_group_pairs=200)
        self.assertEqual(len(errors), 3)

    def test_large_removal_requires_flag(self):
        errors = self.guards(total_removed=600)
        self.assertEqual(len(errors), 1)
        self.assertIn('--allow-large-removals', errors[0])
        self.assertEqual(self.guards(total_removed=600, allow_large_removals=True), [])

    def test_zero_membership_is_rejected(self):
        errors = self.guards(member_group_pairs=0)
        self.assertTrue(any('no member matched' in error for error in errors))


if __name__ == '__main__':
    unittest.main()
