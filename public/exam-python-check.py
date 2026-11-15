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
    return (ab[0],ad[0],bc[0],bc[1])

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
        valid=all(v==vals[0] for v in vals)
        if valid:
            message="Igualdad numérica exacta"
        else:
            def show(v):
                return str(v.numerator) if v.denominator==1 else r"\frac{"+str(v.numerator)+"}{"+str(v.denominator)+"}"
            message="La igualdad no se cumple. El primer miembro vale $"+show(vals[0])+"$; los miembros siguientes valen "+", ".join("$"+show(v)+"$" for v in vals[1:])+". Revisa cuál corresponde al enunciado y sustituye el cálculo incorrecto."
        checks.append({"label":label,"valid":valid,"message":message})
    return checks

def verify_question(q):
    checks=[]
    for label,field in (("Respuesta",q.get("modelAnswer")),("Resultado final",q.get("expectedLatex")),("Explicación",q.get("explanation"))):
        checks+=inspect_field(field,label)
    for i,criterion in enumerate((q.get("rubric") or [])[:30]):
        if isinstance(criterion,dict): checks+=inspect_field(criterion.get("criteria"),"Criterio "+str(i+1))
    for i,step in enumerate((q.get("solutionSteps") or [])[:30]):
        checks+=inspect_field(step,"Paso "+str(i+1))
    ref=tales_reference(q.get("question"))
    if ref:
        ab,ad,bc,unit=ref
        expected=(ab-ad)*bc/ab
        fields=[("Respuesta esperada",q.get("modelAnswer")),("Resultado final",q.get("expectedLatex")),("Explicación",q.get("explanation"))]
        fields += [("Paso "+str(i+1),step) for i,step in enumerate((q.get("solutionSteps") or [])[:30])]
        fields += [("Rúbrica · criterio "+str(i+1),r.get("criteria")) for i,r in enumerate((q.get("rubric") or [])[:30]) if isinstance(r,dict)]
        found=False
        for label,field in fields:
            # A field-level diagnostic identifies the exact contradiction instead of
            # asking the teacher to search the entire answer.
            matches=[]
            for m in re.finditer(r"\bBE\s*(?:=|:|mide)\s*([0-9.]+|\(\([0-9.]+\)/\([0-9.]+\)\))\s*(cm|mm|m)\b",clean(field),re.I):
                if m[2].lower()==unit:
                    try: matches.append(number(m[1]))
                    except (ValueError,SyntaxError,ZeroDivisionError,OverflowError): pass
            if matches:
                found=True
                wrong=[v for v in matches if abs(v-expected)>Fraction(51,10000)]
                message="BE = "+str(expected)+" "+unit
                if wrong: message="Contiene BE = "+", ".join(str(v) for v in wrong)+" "+unit+"; debe ser "+message+"."
                else: message+=" (coincide)."
                checks.append({"label":label+" · Tales","valid":not wrong,"message":message})
        if not found:
            checks.append({"label":"Resultado independiente de Tales","valid":None,"message":"BE = "+str(expected)+" "+unit+"; no se identificó una respuesta explícita comparable."})
    failed=any(c["valid"] is False for c in checks)
    # Only generate an exact proposal for a supported construction. Preserve the rubric
    # and its points; flag any criterion for manual review rather than rewriting it.
    proposal=None
    draft_text=" ".join(str(q.get(k,"")) for k in ("modelAnswer","expectedLatex","explanation","solutionSteps"))
    draft_error=bool(re.search(r"borrador mental|paso \d+ corregido|CORRECCI[ÓO]N:|espera, el enunciado|revisi[oó]n del c[aá]lculo anterior",draft_text,re.I))
    wrong_triangle=bool(re.search(r"(?:tri[aá]ngulo\s+|\\+triangle\s*)ADE\b",draft_text,re.I))
    if draft_error:
        checks.append({"label":"Pauta","valid":False,"message":"Contiene autocorrecciones o texto de borrador."})
    if ref and wrong_triangle:
        checks.append({"label":"Semejanza","valid":False,"message":"La configuración garantiza semejanza entre DBE y ABC, no ADE."})
    if ref and (failed or draft_error or wrong_triangle) and q.get("type")=="development" and q.get("responseMode")!="short_text":
        def tex(v):
            return str(v.numerator) if v.denominator==1 else r"\frac{"+str(v.numerator)+"}{"+str(v.denominator)+"}"
        def f(s): return "$"+s+"$"
        def length(v): return tex(v)+r"\,\text{"+unit+"}"
        bd=ab-ad
        k=bd/ab
        be=bd*bc/ab
        steps=[
            "Calcular "+f("BD=AB-AD="+tex(ab)+"-"+tex(ad)+"="+length(bd))+".",
            "Como "+f(r"DE\parallel AC")+", los triángulos "+f(r"\triangle DBE")+". y "+f(r"\triangle ABC")+" son semejantes por AA.",
            "La homotecia con centro en "+f("B")+" tiene razón "+f("k="+r"\frac{BD}{BA}="+tex(k))+"; transforma A en D y C en E.",
            "Aplicar "+f(r"\frac{BE}{BC}=\frac{BD}{BA}")+" y sustituir: "+f("BE="+tex(bc)+r"\times "+tex(k)+"="+length(be))+".",
            "Comprobar la proporción: "+f(r"\frac{BE}{BC}="+tex(k)+r"=\frac{BD}{BA}")+"."
        ]
        steps[1]=steps[1].replace("$. y","$ y")
        proposal={"source":"python-tales-exact","fields":{"modelAnswer":"\n".join(str(i+1)+". "+step for i,step in enumerate(steps)),"expectedLatex":f("BE="+length(be)),"explanation":steps[1]+" "+steps[2]+" "+steps[4],"solutionSteps":steps},"notes":["Sustituye respuesta esperada, resultado final, explicación y procedimiento.","Comprueba que la rúbrica y el puntaje respondan a todos los apartados del enunciado. No se modifican automáticamente."]}
    failed=any(c["valid"] is False for c in checks)
    return {"id":str(q.get("id","")),"status":"incorrect" if failed else "partial" if checks else "unsupported","checks":checks[:60],"proposal":proposal}
