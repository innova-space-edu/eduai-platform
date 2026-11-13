"""Bounded integer subtraction. Never evaluates model code or inferred operands."""
import re

NUMBER = r"\(([+-]?[0-9]{1,12})\)"
FORMS = (
    (rf"Resta {NUMBER} de {NUMBER}\.", True),
    (rf"Quita {NUMBER} a {NUMBER}\.", True),
    (rf"A {NUMBER} réstale {NUMBER}\.", False),
    (rf"Parte de {NUMBER} y resta {NUMBER}\.", False),
    (rf"Sustrae {NUMBER} del número {NUMBER}\.", True),
    (rf"Disminuye {NUMBER} en {NUMBER}\.", False),
)
ENGINE = "python-integer-subtraction-v1"


def verify_subtraction(question, candidate=None):
    abstain = {"supported": False, "verified": False, "engine": ENGINE,
               "reason": "Formato no admitido. Usa, por ejemplo: Resta (35) de (39)."}
    if not isinstance(question, str) or not 1 <= len(question) <= 1000:
        return abstain
    text = " ".join(question.replace("−", "-").split())
    operands = []
    for pattern, reverse in FORMS:
        match = re.fullmatch(pattern, text, re.IGNORECASE)
        if match:
            x, y = map(int, match.groups())
            operands.append((y, x) if reverse else (x, y))
    if len(operands) != 1:
        return abstain
    a, b = operands[0]
    if candidate is not None:
        if not isinstance(candidate, str) or not re.fullmatch(r"[+-]?[0-9]{1,13}", candidate):
            return {**abstain, "reason": "El candidato debe ser un entero de hasta 13 dígitos."}
        c = int(candidate)
    else:
        c = a - b
    answer, total = a - b, c + b
    steps = [f"Minuendo: {a}. Sustraendo original: {b}.",
             f"Operación: ({a}) - ({b}).",
             f"Sumar el opuesto: ({a}) + ({-b}) = {answer}.",
             f"Comprobación: ({c}) + ({b}) = {total}."]
    if candidate is not None:
        steps.append(f"{total} " + ("coincide" if total == a else "no coincide") + f" con el minuendo {a}.")
    return {"supported": True, "verified": True, "engine": ENGINE,
            "answer": str(answer), "steps": steps, "minuend": str(a), "subtrahend": str(b),
            "candidate": str(c) if candidate is not None else None,
            "candidateCorrect": (total == a) if candidate is not None else None}
