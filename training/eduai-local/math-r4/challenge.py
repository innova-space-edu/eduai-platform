"""R4 diagnostic-only synthetic cross-family probes (NEVER used for training/selection)."""
from __future__ import annotations
from fractions import Fraction
from hashlib import sha256
import json
import random
CATEGORIES=("algebra","recurrence","euler","logic","arithmetic")
def build_challenges(seed=66101,per_family=24):
    rng=random.Random(seed)
    out=[];seen=set()
    for category in CATEGORIES:
        for i in range(per_family):
            if category=="algebra":
                a=rng.randint(-30,30);b=rng.choice([-9,-7,-4,3,5,8]);c=rng.randint(-25,25)
                answer=str(a+b*c)
                question=f"Si (x-({a}))/({b})={c}, despeja x. Responde solo entero."
                subtype="inverse_nested"
            elif category=="recurrence":
                a=rng.randint(2,8);b=rng.randint(1,22);m=rng.choice([11,13,17,19,23,29,31])
                s0=rng.randint(0,85);n=rng.randint(2,5);state=s0
                for _ in range(n):state=(a*state-b)%m
                question=f"La sucesión inicia en u0={s0} y sigue u(t+1)=({a}u(t)-{b}) mod {m}. ¿Cuánto vale u{n}? Responde entero."
                answer=str(state);subtype="recurrence_subtract"
            elif category=="euler":
                k=rng.randint(1,7);step=Fraction(rng.randint(1,3),rng.choice([10,20,25]))
                initial=rng.randint(-10,10) or 1;n=rng.randint(1,3)
                result=Fraction(initial)*(1+k*step)**n
                question=f"Aplica Euler explícito {n} pasos a dx/dt={k}x, con x0={initial} y h={step}. ¿Valor de x{n}? Solo fracción."
                answer=str(result);subtype="growth"
            elif category=="logic":
                a=rng.randint(-100,100);b=rng.randint(-100,100)
                question=f"Sea P: '{a} es par' y Q: '{b} es positivo'. ¿P y Q es verdadera? Solo sí o no."
                answer="sí" if a%2==0 and b>0 else "no";subtype="conjunction"
            else:
                a=rng.randint(-40,40);b=rng.randint(2,19);c=rng.randint(-40,40);d=rng.randint(2,17)
                while b==d:d=rng.randint(2,17)
                question=f"Calcula la suma exacta ({a}/{b})+({c}/{d}). Solo fracción irreducible."
                answer=str(Fraction(a,b)+Fraction(c,d));subtype="different_denominators"
            if question in seen:raise RuntimeError("DUPLICATE_CROSS_FAMILY_PROBE")
            seen.add(question)
            out.append({"category":category,"subtype":subtype,"difficulty":3,
                        "question":question,"answer":answer,
                        "id":sha256(question.encode("utf-8")).hexdigest(),
                        "diagnosticOnly":True})
    return out
