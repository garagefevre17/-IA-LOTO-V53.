"""Offline regression tests for FDJ ZIP and the prospectively anchored 30-draw window."""
import datetime as dt
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from sync_fdj import extract_csv
from report_30 import build_summary

class DeployTests(unittest.TestCase):
    def test_zip_csv_extract(self):
        memory = io.BytesIO()
        with zipfile.ZipFile(memory, 'w') as archive:
            archive.writestr('loto_201911.csv', 'date_de_tirage;boule_1\n')
        self.assertEqual(extract_csv(memory.getvalue()), b'date_de_tirage;boule_1\n')
    def test_zip_multiple_csv_refused(self):
        memory = io.BytesIO()
        with zipfile.ZipFile(memory, 'w') as archive:
            archive.writestr('a.csv', 'a')
            archive.writestr('b.csv', 'b')
        with self.assertRaises(ValueError): extract_csv(memory.getvalue())
    def test_first_forecast_anchors_window(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            pred = root / 'pred'; pred.mkdir()
            res = root / 'results'; res.mkdir()
            (pred/'loto-2026-11-18.json').write_text(json.dumps({'target':'2026-11-18','protocol':'Froids 300 — frozen'}))
            result = {'target':'2026-11-21','game':'LOTO','verified_tsa_on_this_run':True,'main_hits':0,'chance_hit':False,'forecast_sha256':'0'*64,'timestamp_receipt_sha256':'1'*64}
            (res/'loto-2026-11-21.json').write_text(json.dumps(result))
            report = build_summary(res, today=dt.date(2026,11,22), predictions_folder=pred)
            self.assertEqual(report['window_start'],'2026-11-18')
            self.assertEqual(report['missing_draws'],['2026-11-18'])
            self.assertEqual(report['evaluated_results'],1)

if __name__ == '__main__': unittest.main()
