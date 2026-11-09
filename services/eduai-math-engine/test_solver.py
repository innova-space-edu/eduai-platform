import unittest
from engine.solver import solve
class Tests(unittest.TestCase):
 def test_quadratic(self):
  self.assertEqual(solve({"operation":"quadratic","a":1,"b":-5,"c":6})["answer"],"x=2, x=3")
 def test_derivative(self):
  self.assertEqual(solve({"operation":"polynomial_derivative","coefficients":[3,0,-4]})["answer"],"6*x")
 def test_integral(self):
  self.assertEqual(solve({"operation":"polynomial_integral","coefficients":[2,0]})["answer"],"x**2 + C")
 def test_system(self):
  self.assertEqual(solve({"operation":"linear_system3","matrix":[[1,0,0],[0,1,0],[0,0,1]],"values":[1,2,3]})["answer"],"x=1, y=2, z=3")
 def test_binomial(self):
  self.assertEqual(solve({"operation":"binomial_exact","n":4,"k":2,"p":"1/2"})["answer"],"3/8")
 def test_rejects_code(self):
  with self.assertRaises(ValueError):solve({"operation":"quadratic","a":"__import__('os')","b":1,"c":2})
 def test_rejects_large(self):
  with self.assertRaises(ValueError):solve({"operation":"polynomial_derivative","coefficients":[1]*100})
if __name__=="__main__":unittest.main()
