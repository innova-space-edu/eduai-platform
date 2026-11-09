import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).parent))
from challenge import build_challenges,CATEGORIES
from generate import generate
class CrossFamilyTests(unittest.TestCase):
 def test_balanced_distinct_and_repeatable(self):
  a=build_challenges();b=build_challenges()
  self.assertEqual(a,b)
  self.assertEqual(len(a),120)
  self.assertEqual(len({r["question"] for r in a}),120)
  self.assertEqual({c:24 for c in CATEGORIES},{c:sum(r["category"]==c for r in a) for c in CATEGORIES})
 def test_not_in_training(self):
  probes=build_challenges()
  train,val,tests=generate(300,100,120)
  all_q={r["question"] for rows in [train,val,*tests] for r in rows}
  self.assertFalse(any(row["question"] in all_q for row in probes))
 def test_answers(self):
  probes=build_challenges()
  from fractions import Fraction
  for r in probes:
   self.assertTrue(r["answer"])
   if r["category"]=="logic":self.assertIn(r["answer"],["sí","no"])
   else:self.assertIsInstance(Fraction(r["answer"]),Fraction)
if __name__=="__main__":unittest.main()
