"""Verify that missing scheduled draws cannot be cherry-picked away."""
import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path
from report_30 import build_summary


def put(folder, date, hits):
    (folder / f'loto-{date}.json').write_text(json.dumps({
        'game': 'LOTO', 'target': date, 'verified_tsa_on_this_run': True,
        'main_hits': hits, 'chance_hit': False,
        'forecast_sha256': 'a'*64, 'timestamp_receipt_sha256': 'b'*64,
    }), encoding='utf-8')


class ReportingGapTests(unittest.TestCase):
    def test_gap_is_not_replaced_by_later_result(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            put(folder, '2026-11-16', 1)
            put(folder, '2026-11-21', 5)  # Missing Wednesday Nov 18
            summary = build_summary(folder, today=dt.date(2026, 11, 22))
            self.assertIn('2026-11-18', summary['missing_draws'])
            self.assertFalse(summary['complete'])
            self.assertEqual(summary['window_start'], '2026-11-16')
            self.assertEqual(summary['evaluated_results'], 2)

    def test_bad_draw_day_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            put(folder, '2026-11-17', 2)
            with self.assertRaisesRegex(ValueError, 'Invalid evaluated'):
                build_summary(folder)

    def test_future_dates_are_pending(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            put(folder, '2026-11-18', 2)
            summary = build_summary(folder, today=dt.date(2026, 11, 19))
            self.assertNotIn('2026-11-21', summary['missing_draws'])
            self.assertIn('2026-11-21', summary['pending_draws'])

if __name__ == '__main__':
    unittest.main()
