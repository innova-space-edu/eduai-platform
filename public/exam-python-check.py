"""Bounded exact exam verification. User/AI text is data, never executable code."""
import ast
import re
from fractions import Fraction

def clean(s):
    s = str(s or "")[:12000]
    s = re.sub(r"\\{2,}(?=[A-Za-z])", lambda _: "\\", s)
    s = re.sub(r"\\(?:text|mathrm)\s*\{([^{}]*)\}", r"\1", s)
    for _ in range(4):
        s = re.sub(r"\\(?:dfrac|tfrac|frac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}", r"((\1)/(\2))", s)
    s = re.sub(r"\\(?:times|cdot)\b|[×·]", "*", s)
    s = re.sub(r"\\div\b|÷", "/", s)
    s = re.sub(r"\\[,;!]", " ", s)
    return s.replace("−", "-").replace(",", ".").replace("$", "")

def number(s):
    s = s.strip()
    s = re.sub(r"\s*(?:cm|mm|km|m|kg|g|s)\s*$", "", s)
    s = s.replace("^", "**").replace("{", "(").replace("}", ")")
    if len(s) > 120 or not re.fullmatch(r"[0-9.\s()+*/-]+", s):
        raise ValueError("unsupported")
    if any(len(n) > 12 for n in re.findall(r"\d+", s)):
        raise ValueError("too large")
    root = ast.parse(s.strip(), mode="eval")
    if sum(1 for _ in ast.walk(root)) > 50:
        raise ValueError("complex")
    def calc(n):
        if isinstance(n, ast.Constant) and type(n.value) in (int, float):
            value = Fraction(str(n.value))
        elif isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.UAdd, ast.USub)):
            value = calc(n.operand) * (-1 if isinstance(n.op, ast.USub) else 1)
        elif isinstance(n, ast.BinOp):
            a, b = calc(n.left), calc(n.right)
            if isinstance(n.op, ast.Add): value = a+b
            elif isinstance(n.op, ast.Sub): value = a-b
            elif isinstance(n.op, ast.Mult): value = a*b
            elif isinstance(n.op, ast.Div): value = a/b
            elif isinstance(n.op, ast.Pow) and b.denominator == 1 and abs(b) <= 12: value = a**int(b)
            else: raise ValueError("unsupported")
        else: raise ValueError("unsupported")
        if value.numerator.bit_length() > 512 or value.denominator.bit_length() > 512:
            raise ValueError("too large")
        return value
    return calc(root.body)

def tales_reference(q):
    stem = clean(q)
    if not all(re.search(p, stem, re.I) for p in (
        r"tales", r"\bD\b[\s\S]{0,65}\bAB\b|\bAB\b[\s\S]{0,65}\bD\b",
        r"\bparalela\b[\s\S]{0,35}\bAC\b|\bDE\s*(?:∥|\\parallel)\s*AC\b",
        r"\bBC\b[\s\S]{0,45}\bE\b|\bE\b[\s\S]{0,45}\bBC\b",
        r"(?:determina|calcula|longitud|hallar|valor|segmento)\b[\s\S]{0,65}\bBE\b")):
        return None
    def get(name):
        m = re.search(r"\b"+name+r"\s*=\s*(\d+(?:\.\d+)?)\s*(cm|mm|m)\b",stem,re.I)
        return (Fraction(m[1]),m[2].lower()) if m else None
    ab,ad,bc = (get(k) for k in ("AB","AD","BC"))
    if not ab or not ad or not bc or len({ab[1],ad[1],bc[1]})!=1 or not 0<ad[0]<ab[0] or bc[0]<=0:
        return None
    return ((ab[0]-ad[0])*bc[0]/ab[0],bc[1])

def inspect_field(text, label):
    checks=[]
    # Only explicit delimited formula chains, not numbers inferred from prose.
    source=str(text or "")[:12000]
    formulas=[m[1] if m[1] is not None else m[2] for m in list(re.finditer(r"\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$",source))[:30]]
    if not formulas and re.fullmatch(r"[0-9.\s()+*/=^−×÷-]+",source.strip()): formulas=[source]
    for raw in formulas:
        formula=clean(raw)
        if "=" not in formula or "approx" in formula or "≈" in formula: continue
        parts=formula.split("=")
        if re.fullmatch(r"\s*[A-Za-z]{1,3}\s*",parts[0]): parts=parts[1:]
        if len(parts)<2: continue
        try: vals=[number(part) for part in parts]
        except (ValueError,SyntaxError,ZeroDivisionError,OverflowError): continue
        checks.append({"label":label,"valid":all(v==vals[0] for v in vals),"message":"Igualdad numérica exacta" if all(v==vals[0] for v in vals) else "La igualdad numérica no se cumple"})
    return checks

def verify_question(q):
    checks=[]
    for label,field in (("Respuesta",q.get("modelAnswer")),("Resultado final",q.get("expectedLatex")),("Explicación",q.get("explanation"))):
        checks+=inspect_field(field,label)
    for i,step in enumerate((q.get("solutionSteps") or [])[:30]):
        checks+=inspect_field(step,"Paso "+str(i+1))
    ref=tales_reference(q.get("question"))
    if ref:
        expected,unit=ref
        matches=[]
        for field in (q.get("modelAnswer"),q.get("expectedLatex")):
            # Parse explicit values, including simple fractions converted by clean().
            for m in re.finditer(r"\bBE\s*(?:=|:|mide)\s*([0-9.]+|\(\([0-9.]+\)/\([0-9.]+\)\))\s*(cm|mm|m)\b",clean(field),re.I):
                if m[2].lower()==unit:
                    try: matches.append(number(m[1]))
                    except (ValueError,SyntaxError,ZeroDivisionError,OverflowError): pass
        if matches:
            valid=all(abs(v-expected)<=Fraction(51,10000) for v in matches)
            checks.append({"label":"Resultado independiente de Tales","valid":valid,"message":"BE = "+str(expected)+" "+unit+(" (coincide)" if valid else " (no coincide con la pauta)")})
        else:
            checks.append({"label":"Resultado independiente de Tales","valid":None,"message":"BE = "+str(expected)+" "+unit+"; no se identificó una respuesta explícita comparable."})
    failed=any(c["valid"] is False for c in checks)
    return {"id":str(q.get("id","")),"status":"incorrect" if failed else "partial" if checks else "unsupported","checks":checks[:60]}
