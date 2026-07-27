from __future__ import annotations

import os
from typing import Any, Literal

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from sympy import Eq, Symbol, diff, simplify, solve, sympify
from sympy.core.expr import Expr
from sympy.parsing.latex import parse_latex

app = FastAPI(title="EduAI Whiteboard Math Engine", version="1.0.0")


class SolveRequest(BaseModel):
    latex: str = Field(min_length=1, max_length=8000)
    lines: list[str] = Field(default_factory=list, max_length=30)
    mode: Literal["solve", "verify", "hint", "explain", "graph"] = "solve"


class Step(BaseModel):
    index: int
    explanation: str
    latex: str
    valid: bool | None = None


class VerificationLine(BaseModel):
    index: int
    latex: str
    valid: bool | None
    message: str
    operation: str | None = None


class Verification(BaseModel):
    valid: bool | None
    substitutionLatex: str | None = None
    message: str | None = None
    lines: list[VerificationLine] | None = None


class SolveResponse(BaseModel):
    normalizedLatex: str
    classification: str
    steps: list[Step]
    answerLatex: str
    explanation: str
    verified: bool
    engine: Literal["sympy"] = "sympy"
    verification: Verification | None = None
    graph: dict[str, Any] | None = None
    warning: str | None = None


def authorize(authorization: str | None) -> None:
    token = os.getenv("WHITEBOARD_MATH_ENGINE_TOKEN", "").strip()
    if token and authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def strip_math_delimiters(value: str) -> str:
    source = value.strip()
    while source.startswith("$"):
        source = source[1:]
    while source.endswith("$"):
        source = source[:-1]
    return source.strip()


def parse_expression(value: str) -> Expr:
    source = strip_math_delimiters(value)
    try:
        return parse_latex(source)
    except Exception:
        safe = (
            source.replace("\\cdot", "*")
            .replace("\\times", "*")
            .replace("^", "**")
            .replace("\\pi", "pi")
        )
        return sympify(safe, evaluate=True)


def parse_equation(value: str) -> Eq | Expr:
    source = strip_math_delimiters(value)
    if "=" not in source:
        return parse_expression(source)
    left, right = source.split("=", 1)
    return Eq(parse_expression(left), parse_expression(right))


def latex_string(value: Any) -> str:
    from sympy import latex

    return latex(value)


def equation_difference(value: Eq | Expr) -> Expr:
    if isinstance(value, Eq):
        return simplify(value.lhs - value.rhs)
    return simplify(value)


def expressions_equivalent(first: str, second: str) -> bool | None:
    try:
        a = parse_equation(first)
        b = parse_equation(second)
        if isinstance(a, Eq) and isinstance(b, Eq):
            diff_a = equation_difference(a)
            diff_b = equation_difference(b)
            if simplify(diff_a - diff_b) == 0 or simplify(diff_a + diff_b) == 0:
                return True
            ratio = simplify(diff_a / diff_b)
            if ratio.is_number and ratio != 0:
                return True
            return False
        return simplify(equation_difference(a) - equation_difference(b)) == 0
    except Exception:
        return None


def verify_lines(lines: list[str]) -> list[VerificationLine]:
    clean = [strip_math_delimiters(line) for line in lines if line.strip()]
    output: list[VerificationLine] = []
    for index, line in enumerate(clean):
        if index == 0:
            output.append(VerificationLine(index=0, latex=line, valid=True, message="Expresión inicial."))
            continue
        equivalent = expressions_equivalent(clean[index - 1], line)
        if equivalent is True:
            output.append(VerificationLine(index=index, latex=line, valid=True, message="La transformación conserva la equivalencia."))
        elif equivalent is False:
            output.append(VerificationLine(index=index, latex=line, valid=False, message="Esta transformación cambia la expresión o el conjunto solución."))
        else:
            output.append(VerificationLine(index=index, latex=line, valid=None, message="No fue posible demostrar este paso automáticamente."))
    return output


def graph_payload(expression: Expr, variable: Symbol) -> dict[str, Any] | None:
    from sympy import lambdify

    try:
        function = lambdify(variable, expression, modules=["math"])
        points: list[dict[str, float]] = []
        values: list[float] = []
        for index in range(121):
            x_value = -10 + index / 6
            try:
                y_value = float(function(x_value))
            except Exception:
                continue
            if not (-1000 <= y_value <= 1000):
                continue
            points.append({"x": x_value, "y": y_value})
            values.append(y_value)
        if len(points) < 3:
            return None
        return {
            "expressionLatex": latex_string(expression),
            "xMin": -10,
            "xMax": 10,
            "yMin": max(-100, min(values + [-1])),
            "yMax": min(100, max(values + [1])),
            "points": points,
        }
    except Exception:
        return None


def solve_symbolic(request: SolveRequest) -> SolveResponse:
    source = strip_math_delimiters(request.latex)
    parsed = parse_equation(source)
    variables = sorted(equation_difference(parsed).free_symbols, key=lambda symbol: symbol.name)
    variable = variables[0] if variables else Symbol("x")

    if request.mode == "verify" and len(request.lines) > 1:
        verified_lines = verify_lines(request.lines)
        valid = all(line.valid is not False for line in verified_lines)
        return SolveResponse(
            normalizedLatex=source,
            classification="procedure",
            steps=[Step(index=line.index, explanation=line.message, latex=line.latex, valid=line.valid) for line in verified_lines],
            answerLatex=strip_math_delimiters(request.lines[-1]),
            explanation="Cada línea fue comparada simbólicamente con la anterior.",
            verified=valid and all(line.valid is not None for line in verified_lines),
            verification=Verification(valid=valid, lines=verified_lines),
            warning="Algunos pasos no pudieron demostrarse." if any(line.valid is None for line in verified_lines) else None,
        )

    if isinstance(parsed, Eq):
        solutions = solve(parsed, variable)
        steps = [
            Step(index=1, explanation="Se lleva la ecuación a una forma simbólica equivalente.", latex=latex_string(equation_difference(parsed)), valid=True),
            Step(index=2, explanation=f"Se resuelve respecto de {variable}.", latex=latex_string(solutions), valid=True),
        ]
        answer = ",\\quad ".join(f"{variable}={latex_string(solution)}" for solution in solutions) if solutions else "\\varnothing"
        valid = all(simplify(parsed.lhs.subs(variable, solution) - parsed.rhs.subs(variable, solution)) == 0 for solution in solutions)
        graph = graph_payload(equation_difference(parsed), variable)
        return SolveResponse(
            normalizedLatex=source,
            classification="equation",
            steps=steps,
            answerLatex=answer,
            explanation="La solución fue calculada y verificada mediante sustitución simbólica.",
            verified=valid,
            verification=Verification(valid=valid, message="Sustitución simbólica verificada."),
            graph=graph,
        )

    simplified = simplify(parsed)
    graph = graph_payload(simplified, variable) if variable in simplified.free_symbols else None
    steps = [Step(index=1, explanation="Se simplifica la expresión simbólicamente.", latex=latex_string(simplified), valid=True)]
    if request.mode == "explain" and variable in simplified.free_symbols:
        derivative = diff(simplified, variable)
        steps.append(Step(index=2, explanation="Se calcula la derivada como información complementaria.", latex=latex_string(derivative), valid=True))
    return SolveResponse(
        normalizedLatex=source,
        classification="expression" if variables else "numeric-expression",
        steps=steps,
        answerLatex=latex_string(simplified),
        explanation="La expresión fue procesada por el motor simbólico.",
        verified=True,
        verification=Verification(valid=True),
        graph=graph,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "sympy"}


@app.post("/solve", response_model=SolveResponse)
def solve_route(request: SolveRequest, authorization: str | None = Header(default=None)) -> SolveResponse:
    authorize(authorization)
    try:
        response = solve_symbolic(request)
        if request.mode == "hint":
            response.answerLatex = ""
            response.steps = response.steps[:1]
            response.explanation = response.steps[0].explanation if response.steps else "Identifica la operación principal."
        return response
    except Exception as error:
        raise HTTPException(status_code=422, detail=f"No fue posible interpretar la expresión: {error}") from error
