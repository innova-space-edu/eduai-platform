"""Optional GRPO reward primitives (not enabled in R4 SFT).

Use on independently generated *training* prompts only. Never feed the final test
answers into the policy optimizer. This module intentionally has no TRL import.
"""
from __future__ import annotations
import re
from fractions import Fraction

def text_of_completion(item):
    if isinstance(item,str):return item.strip()
    if isinstance(item,list) and item and isinstance(item[-1],dict):
        return str(item[-1].get("content","")).strip()
    if isinstance(item,dict):return str(item.get("content","")).strip()
    return ""

def final_answer(item):
    value=text_of_completion(item)
    if len(value)>4096:return ""
    match=re.search(r"(?is)respuesta final\s*:\s*([^\n]+)",value)
    if match:return match.group(1).strip().strip(" .")
    return value.strip().strip(" .")

def equivalent(actual,expected):
    a=final_answer(actual).lower().replace("−","-").replace("í","i")
    e=str(expected).lower().replace("−","-").replace("í","i").strip()
    if a==e:return True
    if e in ("si","no","estable","inestable"):return False
    try:return Fraction(a)==Fraction(e)
    except (ValueError,ZeroDivisionError):return False

def correctness_reward(completions,answer,**kwargs):
    """TRL-style reward function. Exact-answer reward, never prose similarity."""
    if len(completions)!=len(answer):raise ValueError("REWARD_BATCH_MISMATCH")
    return [1.0 if equivalent(c,e) else 0.0 for c,e in zip(completions,answer)]

def format_reward(completions,**kwargs):
    """Small optional bonus for an explicit final answer, not proof of correctness."""
    return [0.1 if re.search(r"(?i)respuesta final\s*:",text_of_completion(c)) else 0.0 for c in completions]
