import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("exam_python",Path(__file__).resolve().parents[1]/"public/exam-python-check.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert module.number("25*12/20")==15
assert module.number("3/8*9")==module.Fraction(27,8)
q={"id":"1","question":"En el triángulo ABC, AB = 20 cm, BC = 25 cm. En AB se marca D tal que AD = 8 cm. La recta paralela a AC corta BC en E. Determina BE mediante Tales.","modelAnswer":"BE = 10 cm","solutionSteps":["$25*12/20=15$"]}
assert module.verify_question(q)["status"]=="incorrect"
assert module.verify_question({**q,"modelAnswer":"BE = 15 cm"})["status"]=="partial"
assert module.verify_question({"question":"Otro","solutionSteps":["$2+3=7$"]})["status"]=="incorrect"
assert module.verify_question({"question":"Otro","solutionSteps":["2+3=7"]})["status"]=="incorrect"
assert module.verify_question({"question":"Lee el texto"})["status"]=="unsupported"
try:
    module.number("__import__('os')")
    raise AssertionError("unsafe")
except ValueError: pass
print("8 comprobaciones Python superadas")
