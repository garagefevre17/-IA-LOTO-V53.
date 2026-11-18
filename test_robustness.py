import unittest
from pathlib import Path
from robustness import assess

FIXTURE=Path(__file__).resolve().parent/'fixtures'/'loto_reference_2026-11-16.csv'

class RobustnessTests(unittest.TestCase):
    def test_reproducible(self):
        self.assertEqual(assess(FIXTURE,20,100,123),assess(FIXTURE,20,100,123))
    def test_invalid_simulation_count(self):
        with self.assertRaises(ValueError): assess(FIXTURE,20,99)
    def test_null_expected(self):
        r=assess(FIXTURE,20,100,123)
        self.assertAlmostEqual(r['random_main_expected'],20*25/49)
        self.assertEqual(r['random_chance_expected'],2)
        self.assertTrue(0<r['main_one_sided_p_greater_or_equal']<=1)
