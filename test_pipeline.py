"""Regression tests: frozen protocol, chronology, stale source and safety cutoff."""
import csv
import datetime as dt
import tempfile
import unittest
from pathlib import Path
from forecast import load_draws, make_forecast, next_draw

SOURCE = Path(__file__).resolve().parent / 'fixtures' / 'loto_reference_2026-11-16.csv'

class PipelineTests(unittest.TestCase):
    def test_next_draw(self):
        self.assertEqual(next_draw(dt.date(2026,11,16)), dt.date(2026,11,18))
        self.assertEqual(next_draw(dt.date(2026,11,18)), dt.date(2026,11,21))

    def test_frozen_prediction(self):
        result = make_forecast(dt.datetime(2026,11,18,14,tzinfo=dt.timezone.utc), SOURCE)
        self.assertEqual(result['numbers'], [11,35,43,46,48])
        self.assertEqual(result['chance'], 10)

    def test_late_forecast_rejected(self):
        with self.assertRaisesRegex(ValueError, 'cutoff'):
            make_forecast(dt.datetime(2026,11,18,18,tzinfo=dt.timezone.utc), SOURCE)

    def test_missing_draw_rejected(self):
        self._mutate_and_reject(lambda rows: [r for r in rows if '09/11/2026' not in r], 'Missing or unexpected')

    def test_duplicate_date_rejected(self):
        self._mutate_and_reject(lambda rows: rows + [rows[-1]], 'Duplicate date')

    def test_wrong_weekday_rejected(self):
        def mutate(rows):
            result = rows.copy()
            result[0] = result[0].replace('16/11/2026', '17/11/2026')
            return result
        self._mutate_and_reject(mutate, 'invalid draw date')

    def test_future_draw_rejected(self):
        with self.assertRaisesRegex(ValueError, 'invalid draw date'):
            load_draws(SOURCE, dt.date(2026,11,15))

    def test_stale_history_rejected(self):
        with self.assertRaisesRegex(ValueError, 'immediately precede'):
            make_forecast(dt.datetime(2026,11,21,14,tzinfo=dt.timezone.utc), SOURCE)

    def test_non_draw_day_rejected(self):
        with self.assertRaisesRegex(ValueError, 'only permitted on draw days'):
            make_forecast(dt.datetime(2026,11,19,14,tzinfo=dt.timezone.utc), SOURCE)

    def _mutate_and_reject(self, mutate, error):
        rows = SOURCE.read_text(encoding='utf-8-sig').splitlines()
        with tempfile.TemporaryDirectory() as temp:
            file = Path(temp) / 'draws.csv'
            file.write_text('\n'.join([rows[0]] + mutate(rows[1:])) + '\n', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, error):
                load_draws(file, dt.date(2026,11,18))

if __name__ == '__main__':
    unittest.main()

class AuditIntegrityTests(unittest.TestCase):
    def test_frozen_forecast_verified_against_training_history(self):
        from evaluate import verify_frozen_forecast
        draws, dates, _ = load_draws(SOURCE, dt.date(2026, 11, 18))
        info = make_forecast(dt.datetime(2026, 11, 18, 14, tzinfo=dt.timezone.utc), SOURCE)
        verify_frozen_forecast(info, draws, dt.date(2026, 11, 18), info['numbers'], info['chance'], 'fixture')
        with self.assertRaisesRegex(ValueError, 'differs'):
            verify_frozen_forecast(info, draws, dt.date(2026, 11, 18), [1, 2, 3, 4, 5], info['chance'], 'fixture')
        with self.assertRaisesRegex(ValueError, 'metadata'):
            verify_frozen_forecast({**info, 'training_count': 299}, draws, dt.date(2026, 11, 18), info['numbers'], info['chance'], 'fixture')
