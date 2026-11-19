"""Explicitly diagnose misplaced frozen reference data in GitHub Actions."""
import unittest
from pathlib import Path

FIXTURE = Path(__file__).resolve().parent / 'fixtures' / 'loto_reference_2026-11-16.csv'

class FrozenFixturePresenceTests(unittest.TestCase):
    def test_fixture_exists_at_expected_location(self):
        self.assertTrue(FIXTURE.is_file(),
            'Missing frozen CSV: fixtures/loto_reference_2026-11-16.csv. '
            'Upload the file at this exact path; do not nest it under accessoires/automatisation.')
        self.assertGreater(FIXTURE.stat().st_size, 100000)
