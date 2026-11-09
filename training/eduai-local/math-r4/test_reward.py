import unittest
from reward import equivalent,correctness_reward,format_reward
class RewardTests(unittest.TestCase):
 def test_exact_fraction(self):
  self.assertTrue(equivalent("Respuesta final: 2/4","1/2"))
  self.assertFalse(equivalent("Respuesta final: 2/5","1/2"))
 def test_reject_prose_hack(self):
  self.assertFalse(equivalent("El resultado podría ser 100 o 2","2"))
 def test_boolean(self):
  self.assertTrue(equivalent("sí","si"))
  self.assertFalse(equivalent("no","si"))
 def test_batch(self):
  self.assertEqual(correctness_reward(["1/2","-2"],["2/4","-3"]),[1.0,0.0])
 def test_format(self):
  self.assertEqual(format_reward(["Respuesta final: 9","9"]),[0.1,0.0])
if __name__=="__main__":unittest.main()
