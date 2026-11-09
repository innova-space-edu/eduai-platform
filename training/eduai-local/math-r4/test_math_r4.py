import pathlib, sys, tempfile, unittest, json
sys.path.insert(0,str(pathlib.Path(__file__).parent))
from generate import example, generate, save, TEST_SEEDS
from build_kaggle_bundle import bundle
import random
from fractions import Fraction
class DataTests(unittest.TestCase):
 def test_seed_deterministic(self):
  a=generate(250,100,120);b=generate(250,100,120)
  self.assertEqual(a,b)
 def test_no_overlap(self):
  train,val,tests=generate(250,100,120)
  groups=[train,val,*tests];ids=[set(r["id"] for r in g) for g in groups]
  self.assertEqual(sum(len(x) for x in ids),len(set.union(*ids)))
 def test_exact_labels(self):
  rng=random.Random(123)
  for cat in ("algebra","recurrence","euler","arithmetic","logic","rehearsal"):
   for level in (1,2,3):
    row=example(rng,cat,level,"train")
    self.assertTrue(row[3])
    self.assertTrue(row[4])
 def test_bundle_single_file(self):
  with tempfile.TemporaryDirectory() as d:
   bundle(pathlib.Path(d))
   metadata=json.loads((pathlib.Path(d)/"kernel-metadata.json").read_text())
   self.assertEqual(metadata["id"],"esthefano/eduai-nano-lite-refuerzo-corto-v4")
   compile((pathlib.Path(d)/"main.py").read_text(),"main.py","exec")
if __name__=="__main__":unittest.main()
