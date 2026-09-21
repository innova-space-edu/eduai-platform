#!/usr/bin/env python3
"""Evalúa un candidato EDUAI contra un endpoint OpenAI-compatible local.

Ejemplo:
python training/eduai-local/evaluate_openai_compatible.py \
  --profile eduai-lite \
  --base-url http://localhost:1234/v1 \
  --model eduai-lite
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CASES = ROOT / "training" / "eduai-local" / "eval-cases.jsonl"
PROFILES = ROOT / "training" / "eduai-local" / "profiles.json"


def normalize(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value).lower())
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=["eduai-nano", "eduai-lite", "eduai-performance"], required=True)
    parser.add_argument("--base-url", default="http://localhost:1234/v1")
    parser.add_argument("--model", required=True)
    parser.add_argument("--api-key", default=os.getenv("EDUAI_LOCAL_EVAL_API_KEY", ""))
    parser.add_argument("--cases", default=str(DEFAULT_CASES))
    parser.add_argument("--output", default="")
    parser.add_argument("--timeout", type=float, default=90.0)
    parser.add_argument("--max-tokens", type=int, default=320)
    return parser.parse_args()


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as error:
            raise SystemExit(f"JSONL inválido en {path}:{number}: {error}") from error
    return rows


def extract_json(text: str):
    cleaned = text.strip()
    cleaned = re.sub(r"^\s*```(?:json)?\s*", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\s*```\s*$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.S)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None


def compare_json_value(actual, expected) -> bool:
    if isinstance(expected, str):
        return normalize(actual) == normalize(expected)
    return actual == expected


def evaluate_checks(text: str, checks: dict) -> tuple[bool, list[str]]:
    normalized = normalize(text)
    failures: list[str] = []

    for phrase in checks.get("containsAll", []):
        if normalize(phrase) not in normalized:
            failures.append(f"falta containsAll: {phrase}")

    for key in ("containsAny", "containsAnySecondary"):
        phrases = checks.get(key, [])
        if phrases and not any(normalize(phrase) in normalized for phrase in phrases):
            failures.append(f"no cumple {key}: {phrases}")

    for phrase in checks.get("forbiddenAny", []):
        if normalize(phrase) in normalized:
            failures.append(f"contiene prohibido: {phrase}")

    if checks.get("jsonKeys") or checks.get("jsonEquals"):
        payload = extract_json(text)
        if not isinstance(payload, dict):
            failures.append("respuesta no es JSON objeto válido")
        else:
            for key in checks.get("jsonKeys", []):
                if key not in payload:
                    failures.append(f"falta clave JSON: {key}")
            for key, expected in checks.get("jsonEquals", {}).items():
                if key not in payload or not compare_json_value(payload.get(key), expected):
                    failures.append(f"JSON {key} != {expected!r}")

    return not failures, failures


def request_completion(base_url: str, model: str, api_key: str, case: dict, timeout: float, max_tokens: int):
    url = base_url.rstrip("/") + "/chat/completions"
    body = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": case.get("system", "Eres EDUAI Local.")},
            {"role": "user", "content": case["prompt"]},
        ],
        "temperature": 0.0,
        "max_tokens": max_tokens,
        "stream": False,
    }).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))
    elapsed_ms = (time.perf_counter() - started) * 1000
    text = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    usage = payload.get("usage") or {}
    completion_tokens = int(usage.get("completion_tokens") or 0)
    return str(text), elapsed_ms, completion_tokens


def main() -> None:
    args = parse_args()
    profiles = json.loads(PROFILES.read_text(encoding="utf-8"))
    profile = profiles[args.profile]
    threshold = float(profile.get("evaluationThreshold", 80))
    cases = load_jsonl(Path(args.cases))

    results = []
    by_category = defaultdict(lambda: {"passed": 0, "total": 0})
    critical_failures = []

    for case in cases:
        try:
            answer, latency_ms, completion_tokens = request_completion(
                args.base_url,
                args.model,
                args.api_key,
                case,
                args.timeout,
                args.max_tokens,
            )
            passed, failures = evaluate_checks(answer, case.get("checks") or {})
            error = None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError) as exc:
            answer = ""
            latency_ms = 0.0
            completion_tokens = 0
            passed = False
            failures = [f"endpoint error: {exc}"]
            error = str(exc)

        category = case.get("category", "other")
        by_category[category]["total"] += 1
        if passed:
            by_category[category]["passed"] += 1
        elif case.get("critical"):
            critical_failures.append(case["id"])

        results.append({
            "id": case["id"],
            "category": category,
            "critical": bool(case.get("critical")),
            "passed": passed,
            "failures": failures,
            "answer": answer,
            "latencyMs": round(latency_ms, 1),
            "completionTokens": completion_tokens,
            "error": error,
        })
        print(f"[{'PASS' if passed else 'FAIL'}] {case['id']}")

    passed_count = sum(1 for item in results if item["passed"])
    score = 100.0 * passed_count / max(1, len(results))
    category_scores = {
        name: {
            **value,
            "score": round(100.0 * value["passed"] / max(1, value["total"]), 1),
        }
        for name, value in sorted(by_category.items())
    }
    promoted = score >= threshold and not critical_failures

    report = {
        "schemaVersion": 1,
        "profile": args.profile,
        "profileLabel": profile["label"],
        "model": args.model,
        "baseUrl": args.base_url,
        "threshold": threshold,
        "score": round(score, 1),
        "passed": passed_count,
        "total": len(results),
        "criticalFailures": critical_failures,
        "promotionGatePassed": promoted,
        "categories": category_scores,
        "results": results,
    }

    output = Path(args.output) if args.output else ROOT / "artifacts" / "ai" / f"{args.profile}-evaluation.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ["profile", "model", "score", "threshold", "criticalFailures", "promotionGatePassed"]}, indent=2, ensure_ascii=False))

    if not promoted:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
