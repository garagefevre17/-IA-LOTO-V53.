import datetime as dt
import tempfile
import unittest
from pathlib import Path
from healthcheck import diagnose

NOW = dt.datetime(2026, 11, 18, 15, tzinfo=dt.timezone.utc)


class HealthcheckTests(unittest.TestCase):
    def test_missing_files_and_configuration_are_not_passed(self):
        with tempfile.TemporaryDirectory() as folder:
            result = diagnose(folder, NOW, {})
            checks = {c['name']: c for c in result['checks']}
            self.assertEqual(checks['index.html']['status'], 'fail')
            self.assertEqual(checks['historical_csv']['status'], 'fail')
            self.assertEqual(checks['configuration_TSA_URL']['status'], 'missing')
            self.assertEqual(result['overall'], 'not_production_verified')

    def test_configured_is_not_verified(self):
        with tempfile.TemporaryDirectory() as folder:
            result = diagnose(folder, NOW, {'TSA_URL': 'https://example.org'})
            checks = {c['name']: c for c in result['checks']}
            self.assertEqual(checks['configuration_TSA_URL']['status'], 'configured')
            self.assertEqual(checks['live_tsa_signature']['status'], 'not_tested')

    def test_invalid_csv_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            Path(folder, 'loto_201911.csv').write_text('invalid')
            result = diagnose(folder, NOW, {})
            checks = {c['name']: c for c in result['checks']}
            self.assertEqual(checks['historical_csv']['status'], 'fail')
            self.assertEqual(checks['source_freshness']['status'], 'unknown')

    def test_stale_valid_fixture_is_detected(self):
        root = Path(__file__).resolve().parent
        with tempfile.TemporaryDirectory() as folder:
            from shutil import copyfile
            copyfile(root/'fixtures/loto_reference_2026-11-16.csv', Path(folder)/'loto_201911.csv')
            future = dt.datetime(2026, 11, 23, 15, tzinfo=dt.timezone.utc)
            checks = {c['name']: c for c in diagnose(folder, future, {})['checks']}
            self.assertEqual(checks['historical_csv']['status'], 'pass')
            self.assertEqual(checks['source_freshness']['status'], 'fail')


if __name__ == '__main__':
    unittest.main()
