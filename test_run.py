import unittest,datetime as dt
from run import pick,parse,next_draw
class EngineTests(unittest.TestCase):
 def test_pick_tie_break(self):
  rows=[{'numbers':[1,2,3,4,5],'chance':1} for _ in range(300)]
  self.assertEqual(pick(rows),([6,7,8,9,10],2))
 def test_next_draw(self):
  self.assertEqual(next_draw('2026-11-14'),'2026-11-16')
 def test_conflicting_draw(self):
  import json
  a={'date':'2026-11-14','numbers':[1,2,3,4,5],'chance':1}
  b={**a,'chance':2}
  with self.assertRaises(ValueError): parse(json.dumps([a,b]))
 def test_invalid_numbers(self):
  import json
  with self.assertRaises(ValueError): parse(json.dumps([{'date':'2026-11-14','numbers':[1,1,2,3,4],'chance':1}]))
if __name__=='__main__': unittest.main()
