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
full={**q,"type":"development","responseMode":"math_steps","expectedLatex":"$BE=10\\text{cm}$"}
result=module.verify_question(full)
assert result["proposal"]["fields"]["expectedLatex"]==r"$BE=15\,\text{cm}$"
assert module.verify_question({**full,**result["proposal"]["fields"]})["status"]=="partial"
assert module.verify_question({"type":"development","question":"Otro","solutionSteps":["$2+3=7$"]})["proposal"] is None
assert module.verify_question({**full,**result["proposal"]["fields"],"rubric":[{"criteria":"BE = 10 cm","points":2}]})["status"]=="incorrect"
# Capture regression: correct final value must not hide incorrect expected answer.
contradiction=module.verify_question({**full,"modelAnswer":"BE: 10 cm","expectedLatex":r"$BE=15\,\text{cm}$"})
assert any(c["label"]=="Respuesta esperada · Tales" and c["valid"] is False for c in contradiction["checks"])
assert any(c["label"]=="Resultado final · Tales" and c["valid"] is True for c in contradiction["checks"])
assert any(c["label"]=="Rúbrica · criterio 1 · Tales" and c["valid"] is False for c in module.verify_question({**full,**result["proposal"]["fields"],"rubric":[{"criteria":"BE = 10 cm","points":2}]})["checks"])
print("15 comprobaciones Python superadas")
