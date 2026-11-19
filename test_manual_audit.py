"""Reproducibility of the clearly labelled manual draw comparison."""
import json
import unittest
from pathlib import Path
from forecast import make_forecast
import datetime as dt

ROOT = Path(__file__).resolve().parent.parent

class ManualAuditTests(unittest.TestCase):
    def test_18_november_manual_report(self):
        data = json.loads((ROOT / 'audits' / 'tirage_2026-11-18.json').read_text(encoding='utf-8'))
        forecast = make_forecast(dt.datetime(2026, 11, 18, 14, tzinfo=dt.timezone.utc),
                                 ROOT / 'automation' / 'fixtures' / 'loto_reference_2026-11-16.csv')
        self.assertEqual(data['froids300_reference']['numbers'], forecast['numbers'])
        self.assertEqual(data['froids300_reference']['chance'], forecast['chance'])
        self.assertEqual(data['froids300_reference']['main_hits'],
                         len(set(forecast['numbers']) & set(data['main_numbers'])))
        self.assertEqual(data['froids300_reference']['chance_hit'], forecast['chance'] == data['chance'])
