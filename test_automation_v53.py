"""Regression tests for the automated, fail-closed reporting pipeline."""
import json
import tempfile
import unittest
from pathlib import Path
from report_30 import build_summary


class AutomationReportingTests(unittest.TestCase):
    def test_empty_result_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(build_summary(Path(directory))['certified_results'], 0)

    def test_reject_uncertified_result(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / 'loto-2026-11-18.json'
            p.write_text(json.dumps({'game':'LOTO','target':'2026-11-18', 'main_hits':3, 'chance_hit':False}), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Invalid'):
                build_summary(Path(directory))

    def test_reject_fake_certified_without_hashes(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / 'loto-2026-11-18.json'
            p.write_text(json.dumps({'game':'LOTO','target':'2026-11-18','verified_tsa_on_this_run':True, 'main_hits':3, 'chance_hit':False}), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'hash'):
                build_summary(Path(directory))

    def test_accept_well_formed_result_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / 'loto-2026-11-18.json'
            p.write_text(json.dumps({'game':'LOTO','target':'2026-11-18','verified_tsa_on_this_run':True,
              'main_hits':2,'chance_hit':True, 'forecast_sha256':'a'*64,
              'timestamp_receipt_sha256':'b'*64}), encoding='utf-8')
            summary = build_summary(Path(directory))
            self.assertEqual(summary['main_hits_total'],2)
            self.assertEqual(summary['chance_hits_total'],1)


if __name__ == '__main__':
    unittest.main()
