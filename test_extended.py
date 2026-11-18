"""Additional checks for reproducibility, integrity, and safe rejection."""
import datetime as dt
import tempfile
import unittest
from pathlib import Path
from benchmark import benchmark
from forecast import load_draws, make_forecast
from evaluate import verify_frozen_forecast

SOURCE=Path(__file__).resolve().parent/'fixtures'/'loto_reference_2026-11-16.csv'

class ExtendedTests(unittest.TestCase):
    def test_benchmark_reproducible(self):
        a=benchmark(SOURCE,25,17);b=benchmark(SOURCE,25,17)
        self.assertEqual(a,b)
    def test_benchmark_no_leakage(self):
        result=benchmark(SOURCE,25,17)
        self.assertEqual(len(result['per_draw']),25)
        self.assertFalse(result['advantage_proven'])
    def test_benchmark_reject_insufficient_training(self):
        with self.assertRaises(ValueError): benchmark(SOURCE,10000)
    def test_forecast_metadata_tamper(self):
        info=make_forecast(dt.datetime(2026,11,18,14,tzinfo=dt.timezone.utc),SOURCE)
        draws,_,_=load_draws(SOURCE,dt.date(2026,11,18))
        with self.assertRaises(ValueError):verify_frozen_forecast({**info,'generated_utc':'2026-11-19T12:00:00+00:00'},draws,dt.date(2026,11,18),info['numbers'],info['chance'],'fixture')
    def test_forecast_chance_tamper(self):
        info=make_forecast(dt.datetime(2026,11,18,14,tzinfo=dt.timezone.utc),SOURCE)
        draws,_,_=load_draws(SOURCE,dt.date(2026,11,18))
        with self.assertRaises(ValueError):verify_frozen_forecast(info,draws,dt.date(2026,11,18),info['numbers'],(info['chance']%10)+1,'fixture')
    def test_csv_invalid_number(self):
        lines=SOURCE.read_text(encoding='utf-8-sig').splitlines()
        fields=lines[1].split(';');idx=lines[0].split(';').index('boule_1');fields[idx]='99';lines[1]=';'.join(fields)
        with tempfile.TemporaryDirectory() as tmp:
            f=Path(tmp)/'bad.csv';f.write_text('\n'.join(lines)+'\n')
            with self.assertRaisesRegex(ValueError,'invalid numbers'):load_draws(f,dt.date(2026,11,18))
