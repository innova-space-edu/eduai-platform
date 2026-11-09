"""R5 validation evaluator: exact answer, output contract, and truncation are distinct.

No model/tokenizer dependencies. Never use held-out test to choose checkpoints.
"""
from __future__ import annotations
from collections import defaultdict
from fractions import Fraction
import re

FINAL_LINE = re.compile(r"(?i)\brespuesta\s+final\s*:\s*([^\n\r]+)")
NUMERIC = re.compile(r"^[+-]?(?:\d+(?:\.\d+)?|\d+\/[+-]?\d+)$")
ASSIGNMENT = re.compile(r"^(?:x\s*=\s*)?([+-]?(?:\d+(?:\.\d+)?|\d+\/[+-]?\d+))$")
BOOLS = {"si": "si", "sí": "si", "no": "no", "verdadero": "si",
         "falso": "no", "true": "si", "false": "no"}

def _plain(raw):
    s = str(raw or "").strip().replace("\u2212", "-").replace("\u2013", "-")
    if len(s) > 8192:
        return ""
    if s.startswith("$") and s.endswith("$"):
        s = s.strip("$").strip()
    if s.startswith("**") and s.endswith("**"):
        s = s.strip("*").strip()
    return s.rstrip(" .!")

def same_answer(actual, expected):
    a = _plain(actual).lower()
    e = _plain(expected).lower()
    if a == e:
        return True
    if e in BOOLS or a in BOOLS:
        return BOOLS.get(a) == BOOLS.get(e) and BOOLS.get(e) is not None
    if a.replace(" ", "").startswith("x="):
        a = a.replace(" ", "")[2:]
    if NUMERIC.fullmatch(a) and NUMERIC.fullmatch(e):
        try:
            return Fraction(a) == Fraction(e)
        except (ValueError, ZeroDivisionError):
            return False
    return False

def classify(actual, expected, *, token_count=None, max_new_tokens=None,
             eos_seen=None, response_format="final"):
    """Return strict correctness and a secondary mathematical-meaning metric.

    A long solution containing a correct final answer is NOT counted as a
    compliant answer to a final-only question.
    """
    raw = str(actual or "").strip()
    truncated = bool(max_new_tokens is not None and token_count is not None
                     and token_count >= max_new_tokens and eos_seen is False)
    pure = same_answer(raw, expected)
    marker = list(FINAL_LINE.finditer(raw))
    explicit = marker[-1].group(1).strip() if marker else None
    semantic = pure or (explicit is not None and same_answer(explicit, expected))
    if truncated:
        kind = "truncated"
    elif pure:
        kind = "correct"
    elif semantic:
        kind = "format_error"
    elif not raw:
        kind = "empty"
    elif marker and not semantic:
        kind = "wrong_answer"
    elif "\n" in raw or len(raw) > 65:
        kind = "format_error_ungraded"
    else:
        kind = "wrong_answer"
    if response_format == "trace":
        # Trace prompts are not used in final-only accuracy selection.
        strict = semantic and bool(marker) and not truncated
    else:
        strict = pure and not truncated
    return {"passed": bool(strict), "semanticCorrect": bool(semantic),
            "formatCorrect": bool(pure) if response_format=="final" else bool(marker),
            "truncated": truncated, "reason": kind}

def summarize(rows, responses, *, max_errors=24):
    if len(rows) != len(responses):
        raise ValueError("EVALUATION_ALIGNMENT_ERROR")
    categories = defaultdict(lambda: {"correct": 0, "semanticCorrect": 0, "total": 0})
    reasons = defaultdict(int)
    strict = semantic = truncated = format_errors = 0
    errors = []
    for row, answer in zip(rows, responses):
        generation = answer if isinstance(answer, dict) else {"text": answer}
        response = generation.get("text", "")
        mode = row.get("response_format", "final")
        diag = classify(response, row["answer"], token_count=generation.get("tokens"),
                        max_new_tokens=generation.get("max_new_tokens"),
                        eos_seen=generation.get("eos_seen"), response_format=mode)
        cat = categories[row["category"]]
        cat["total"] += 1
        cat["correct"] += int(diag["passed"])
        cat["semanticCorrect"] += int(diag["semanticCorrect"])
        strict += int(diag["passed"])
        semantic += int(diag["semanticCorrect"])
        truncated += int(diag["truncated"])
        format_errors += int(diag["reason"] in ("format_error","format_error_ungraded"))
        reasons[diag["reason"]] += 1
        if not diag["passed"] and len(errors) < max_errors:
            errors.append({"category": row["category"], "subtype": row.get("subtype"),
                           "question": row["question"], "expected": row["answer"],
                           "got": response, **diag})
    total = len(rows)
    return {
        "correct": strict, "total": total,
        "accuracyPct": round(100*strict/total, 2) if total else 0,
        "semanticCorrect": semantic,
        "semanticAccuracyPct": round(100*semantic/total, 2) if total else 0,
        "formatErrors": format_errors, "truncated": truncated,
        "errorReasons": dict(reasons),
        "categories": dict(categories), "errorExamples": errors,
    }

def objective(report, focus):
    """Checkpoint score on validation only; NOT applicable to test."""
    categories = report["categories"]
    required = list(focus)
    if any(not categories.get(key, {}).get("total", 0) for key in required):
        raise ValueError("MISSING_CRITICAL_VALIDATION_CATEGORY")
    critical = sum(categories[key]["correct"]/categories[key]["total"]
                   for key in required)/len(required)
    overall = report["correct"]/max(report["total"],1)
    rehearse = categories.get("rehearsal", {"correct":0,"total":0})
    retention = rehearse["correct"]/rehearse["total"] if rehearse["total"] else overall
    score = 0.50 * critical + 0.35 * overall + 0.15 * retention
    return {"score": round(score, 8), "criticalMacro": round(critical, 8),
            "overall": round(overall, 8), "rehearsal": round(retention, 8)}

def validation_gate(candidate, baseline, focus, tolerance=0.03):
    a=objective(candidate,focus)
    b=objective(baseline,focus)
    # Require progress in critical skills while guarding aggregate and rehearsal.
    focus_non_regression=all(
        candidate["categories"][key]["correct"]/candidate["categories"][key]["total"] >=
        baseline["categories"][key]["correct"]/baseline["categories"][key]["total"]-tolerance
        for key in focus)
    return bool(a["criticalMacro"] > b["criticalMacro"] and focus_non_regression
                and a["overall"] >= b["overall"]-tolerance
                and a["rehearsal"] >= b["rehearsal"]-tolerance)
