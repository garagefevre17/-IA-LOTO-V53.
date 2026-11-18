import unittest
from math import comb, isclose
from exact_stats import main_hit_distribution, exact_main_upper_tail, exact_chance_upper_tail

class ExactStatsTests(unittest.TestCase):
    def test_zero_draws(self):
        self.assertEqual(main_hit_distribution(0), [1.0])
    def test_one_draw_exact_five(self):
        self.assertAlmostEqual(exact_main_upper_tail(1,5),1/comb(49,5))
    def test_expectation(self):
        p=main_hit_distribution(3)
        self.assertAlmostEqual(sum(p),1.0,places=12)
        self.assertAlmostEqual(sum(i*v for i,v in enumerate(p)),3*25/49,places=12)
    def test_chance(self):
        self.assertAlmostEqual(exact_chance_upper_tail(1,1),.1)
    def test_reject_bad_inputs(self):
        with self.assertRaises(ValueError): exact_main_upper_tail(-1,1)
        with self.assertRaises(ValueError): exact_chance_upper_tail(1,-1)
