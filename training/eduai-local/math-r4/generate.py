"""EDUAI R5: corrected procedural curriculum. Generates DATA, does not train or deploy.

Use: python training/eduai-local/math-r4/generate.py --output /tmp/eduai-r4 --train 3000
All labels are derived with exact Fraction/integer arithmetic; no remote APIs.
"""
from __future__ import annotations
import argparse, hashlib, json, random, re
from collections import Counter
from fractions import Fraction
from pathlib import Path

TRAIN_SEEDS=(41011,42011,43011)
TEST_SEEDS=(57021,57031,57041)
VALIDATION_SEED=52011
WEIGHTS={"algebra":32,"recurrence":21,"euler":21,"arithmetic":10,"logic":6,"rehearsal":10}
LEVELS=(1,2,3)
TRAIN_TRACE_RATE=0.35

# Explicit formatting contracts: no example may demand a single value and
# simultaneously supervise a paragraph of reasoning.
_OUTPUT_SUFFIXES=(
    r"\s*Solo el valor de x\.$",
    r"\s*Solo entero\.$",
    r"\s*Entrega x\.$",
    r"\s*Responde solo entero\.$",
    r"\s*Responde sí o no\.$",
    r"\s*Solo nombre\.$",
    r"\s*Responde solo su nombre\.$",
    r"\s*Sí o no\.$",
    r"\s*Solo fracción(?: irreducible)?\.$",
    r"\s*Responde entero\.$",
)
def presentation_prompt(question, mode):
    q=question.strip()
    q=re.sub(r"\s*Entrega x\.$"," Determina solamente x.",q,flags=re.IGNORECASE)
    for pattern in _OUTPUT_SUFFIXES:
        q=re.sub(pattern,"",q,flags=re.IGNORECASE)
    q=q.rstrip()
    if not q:
        raise ValueError("EMPTY_QUESTION")
    if mode=="trace":
        q += "\nExplica los pasos y comprueba el cálculo. Termina con una línea «Respuesta final:» seguida del valor."
    elif mode=="final":
        q += "\nResponde únicamente con el resultado final, sin explicación."
    else:
        raise ValueError("UNKNOWN_RESPONSE_MODE")
    return q

def assert_example_contract(row):
    prompt=row["question"]
    completion=row["completion"]
    answer=row["answer"]
    if row["mode"]=="trace":
        if re.search(r"\b(?:responde\s+únicamente|responde\s+solo|solo\s+(?:entero|nombre|fracción|el valor)|entrega\s+x|responde\s+sí\s+o\s+no)\b",prompt,re.IGNORECASE):
            raise AssertionError("TRACE_PROMPT_CONFLICT")
        if "Explica los pasos" not in prompt or not completion.endswith("Respuesta final: "+answer):
            raise AssertionError("TRACE_CONTRACT_INCONSISTENT")
    elif row["mode"]=="final":
        if not prompt.endswith("Responde únicamente con el resultado final, sin explicación.") or completion!=answer:
            raise AssertionError("FINAL_CONTRACT_INCONSISTENT")
    else:
        raise AssertionError("UNKNOWN_RESPONSE_MODE")

def fmt(v):return str(Fraction(v))
def sign(rng,lo=1,hi=20):return rng.choice([-1,1])*rng.randint(lo,hi)
def example(rng,cat,level,split):
    shift=1 if split=="train" else 3
    scale=shift*level
    if cat=="algebra":
        kind=rng.choice(["linear","parentheses","system2","substitution"])
        x=sign(rng,1,15*scale);a=sign(rng,1,12*scale);b=sign(rng,0,13*scale)
        if kind=="linear":
            c=a*x+b
            q=f"Resuelve {a}x+({b})={c}. Solo el valor de x."
            trace=f"Restar {b}: {a}x={c-b}. Dividir por {a}: x={x}. Verificación: {a}*({x})+({b})={c}."
            key=("linear",a,b,c);ans=str(x)
        elif kind=="parentheses":
            c=a*(x+b)
            q=f"Resuelve {a}(x+({b}))={c}. Solo el valor de x."
            trace=f"Dividir por {a}: x+({b})={x+b}. Restar {b}: x={x}. Verificación: {a}*({x}+({b}))={c}."
            key=("parentheses",a,b,c);ans=str(x)
        elif kind=="substitution":
            y=a*x+b
            q=f"Si y={a}x+({b}), encuentra x cuando y={y}. Solo entero."
            trace=f"Despejar: x=(y-({b}))/{a}. Sustituir y={y}: x={x}. Verificación: y={a}*({x})+({b})={y}."
            key=("substitution",a,b,y);ans=str(x)
        else:
            y=sign(rng,1,15*scale)
            for _ in range(200):
                c,d,e,f=[rng.randint(-9*scale,9*scale) for _ in range(4)]
                det=c*f-d*e
                if det:break
            else:raise RuntimeError("SYSTEM_GENERATION_FAILED")
            r=c*x+d*y;t=e*x+f*y
            q=f"Resuelve el sistema {c}x+({d})y={r}; {e}x+({f})y={t}. Entrega x."
            trace=f"Determinante={det}. x=({r}*{f}-({d})*{t})/{det}={x}; y={y}. Verificación: {c}*({x})+({d})*({y})={r} y {e}*({x})+({f})*({y})={t}."
            key=("system2",c,d,e,f,r,t);ans=str(x)
        return cat,kind,q,ans,trace,key
    if cat=="recurrence":
        a=rng.randint(2,8);b=rng.randint(0,16);m=rng.choice([11,13,17,19,23,29,31])
        s0=rng.randint(0,12*scale);n=min(6,level+1)
        v=s0;parts=[]
        for i in range(1,n+1):
            before=v;v=(a*v+b)%m;parts.append(f"s{i}=({a}*{before}+{b}) mod {m}={v}")
        q=f"s0={s0}; s(t+1)=({a}*s(t)+{b}) mod {m}. Calcula s{n}."
        return cat,"modular",q,str(v),"; ".join(parts)+f". Resultado s{n}={v}.",("mod",s0,a,b,m,n)
    if cat=="euler":
        k=rng.randint(1,12*scale);dt=Fraction(rng.randint(1,5),rng.choice([10,20,25,50,100]))
        x0=sign(rng,1,12*scale);n=1 if level==1 else min(3,level)
        factor=1-k*dt;v=Fraction(x0);parts=[f"factor=1-{k}*({dt})={fmt(factor)}"]
        for i in range(1,n+1):
            v*=factor;parts.append(f"x{i}=x{i-1}*({fmt(factor)})={fmt(v)}")
        q=f"Euler explícito: dx/dt=-{k}x, x0={x0}, dt={dt}. Calcula x{n} después de {n} pasos."
        return cat,"decay",q,fmt(v),"; ".join(parts)+".",("euler",k,dt.numerator,dt.denominator,x0,n)
    if cat=="arithmetic":
        kind=rng.choice(["multiply","percentage","rational"])
        a=sign(rng,1,50*scale)
        if kind=="multiply":
            b=sign(rng,1,25*scale);q=f"Calcula {a} por ({b}).";ans=str(a*b)
            trace=f"Multiplicar magnitudes {abs(a)}*{abs(b)}={abs(a*b)}. Aplicar regla de signos: {ans}."
            key=(kind,a,b)
        elif kind=="percentage":
            p=rng.choice([5,10,20,25,50]);ans=fmt(Fraction(a*p,100));q=f"Calcula {p}% de {a}."
            trace=f"Porcentaje = ({p}/100)*({a})={ans}.";key=(kind,p,a)
        else:
            b=rng.randint(2,25);c=rng.randint(2,30);ans=fmt(Fraction(a,b)+Fraction(c,b))
            q=f"Calcula ({a}/{b})+({c}/{b}).";trace=f"Denominador común {b}. Sumar numeradores: ({a}+{c})/{b}={ans}."
            key=(kind,a,b,c)
        return cat,kind,q,ans,trace,key
    if cat=="logic":
        a=sign(rng,1,100*scale);b=sign(rng,1,100*scale)
        kind=rng.choice(["implication","disjunction","comparison"])
        p=(a%2==0);t=(b>0)
        if kind=="comparison":
            c=sign(rng,1,100*scale);val=a+b>c
            q=f"¿Es verdadera {a}+({b})>{c}? Responde sí o no."
            trace=f"Sumar {a}+({b})={a+b}. Comparar con {c}: {'verdadero' if val else 'falso'}."
            key=(kind,a,b,c)
        else:
            val=((not p) or t) if kind=="implication" else (p or t)
            q=f"P: '{a} es par'; Q: '{b} > 0'. ¿Es verdadera P {'implica Q' if kind=='implication' else 'o Q (incluyente)'}?"
            trace=f"P={'V' if p else 'F'}, Q={'V' if t else 'F'}. Proposición {'verdadera' if val else 'falsa'}."
            key=(kind,a,b)
        return cat,kind,q,"sí" if val else "no",trace,key
    if cat=="rehearsal":
        kind=rng.choice(["pressure","python","sql","privacy","tools","language"])
        if kind=="pressure":
            area=rng.randint(2,70);pressure=rng.randint(2,90)
            q=f"Una fuerza de {area*pressure} N sobre área {area} m². ¿Presión en Pa? Solo entero."
            ans=str(pressure);trace=f"P=F/A={area*pressure}/{area}={pressure} Pa.";key=(kind,area,pressure)
        elif kind=="python":
            a=rng.randint(-100,100);b=rng.randint(-100,100)
            q=f"Python: ¿cuánto vale len(list(range({a},{b})))? Solo entero."
            ans=str(max(0,b-a));trace=f"range(a,b) contiene max(0,b-a)=max(0,{b-a})={ans} elementos.";key=(kind,a,b)
        elif kind=="sql":
            table=rng.choice(["alumnos","visitas","notas","cursos","inventario","mediciones","grupos","ventas"])
            column=rng.choice(["id","total","fecha","estado","zona","grupo","curso","curso_id"])
            task,ans=rng.choice([("filtra filas antes de agrupar","WHERE"),("filtra grupos agregados","HAVING"),
                                  ("ordena resultados","ORDER BY"),("agrupa filas","GROUP BY")])
            q=f"En SQL, tabla {table} (columna {column}), ¿qué cláusula {task}? Responde solo su nombre."
            trace=f"La cláusula correcta para '{task}' es {ans}.";key=(kind,table,column,task)
        elif kind=="privacy":
            secret=rng.choice(["contraseña","token","clave SSH","código de recuperación"])
            place=rng.choice(["logs","repositorio público","captura de pantalla","documento compartido"])
            q=f"¿Debe mostrarse un/a {secret} expuesto/a en {place}? Sí o no."
            ans="no";trace="No: nunca se deben mostrar secretos en registros o documentos compartidos.";key=(kind,secret,place)
        elif kind=="tools":
            task,ans=rng.choice([("explicar un cálculo","explain_math"),("resumir un texto","summarize_text"),
                ("planificar una clase","plan_lesson")])
            context=rng.choice(["Matemática","Física","Química","Lenguaje","Historia","Biología"])
            q=f"En {context}, para {task}, selecciona explain_math, summarize_text o plan_lesson. Solo nombre."
            trace=f"Función solicitada: {task}; herramienta: {ans}.";key=(kind,task,context)
        else:
            count=rng.randint(1,300);who=rng.choice(["Ana","María","Luis","Carla","Pablo","Francisca"])
            q=f"{who} registró {count} mediciones en laboratorio. ¿Cuántas mediciones registró? Solo entero."
            ans=str(count);trace=f"El enunciado indica {count} mediciones.";key=(kind,who,count)
        return cat,kind,q,ans,trace,key
    raise ValueError(cat)

def load_protected(files):
    questions=set()
    for name in files:
        source=Path(name)
        if not source.is_file():raise FileNotFoundError(name)
        for line in source.read_text(encoding="utf-8").splitlines():
            if not line.strip():continue
            row=json.loads(line)
            if isinstance(row,dict) and "question" in row:questions.add(row["question"])
    return questions

def generate(train_count=3000, validation_count=500, test_count=600, exclude=()):
    if train_count<200 or validation_count<100 or test_count<100:raise ValueError("SAMPLE_COUNT_TOO_SMALL")
    occupied=set();protected=load_protected(exclude)
    def build(count,seed,split):
        rng=random.Random(seed);out=[];attempts=0
        cats=list(WEIGHTS)
        while len(out)<count:
            attempts+=1
            if attempts>count*100:raise RuntimeError("DATASET_EXHAUSTED")
            cat=rng.choices(cats,weights=list(WEIGHTS.values()),k=1)[0] if split=="train" else cats[len(out)%len(cats)]
            level=rng.choice(LEVELS) if split=="train" else rng.choice([2,3])
            category,kind,question,answer,trace,key=example(rng,cat,level,split)
            digest=hashlib.sha256(json.dumps(key,sort_keys=True,default=str).encode()).hexdigest()
            if digest in occupied or question in protected:continue
            occupied.add(digest)
            mode="trace" if (split=="train" and rng.random()<TRAIN_TRACE_RATE) else "final"
            output=(trace.rstrip()+"\nRespuesta final: "+answer) if mode=="trace" else answer
            row={"id":digest,"category":category,"subtype":kind,"difficulty":level,
                 "raw_question":question,"question":presentation_prompt(question,mode),
                 "answer":answer,"mode":mode,"response_format":mode,
                 "completion":output,
                 "verifiedBy":"deterministic-rule" if cat=="rehearsal" else "python-fraction-or-integer"}
            assert_example_contract(row)
            out.append(row)
        return out
    # Disjoint structural parameter keys; tests are never inputs to checkpoint selection.
    train=build(train_count,41011,"train")
    val=build(validation_count,VALIDATION_SEED,"validation")
    tests=[build(test_count//3+(1 if i<test_count%3 else 0),seed,"test") for i,seed in enumerate(TEST_SEEDS)]
    return train,val,tests

def save(output,train,val,tests):
    root=Path(output);root.mkdir(parents=True,exist_ok=True)
    counts={}
    sets=[("train",train),("validation",val)]+[("test-"+str(seed),rows) for seed,rows in zip(TEST_SEEDS,tests)]
    for name,rows in sets:
        path=root/(name+".jsonl")
        path.write_text("".join(json.dumps(row,ensure_ascii=False)+"\n" for row in rows),encoding="utf-8")
        counts[name]={"examples":len(rows),"categories":dict(Counter(row["category"] for row in rows)),
                      "responseModes":dict(Counter(row["mode"] for row in rows)),
                      "sha256":hashlib.sha256(path.read_bytes()).hexdigest()}
    (root/"manifest.json").write_text(json.dumps({"campaign":"eduai-math-r5","trainSeeds":TRAIN_SEEDS,
        "testSeeds":TEST_SEEDS,"validationSeed":VALIDATION_SEED,"splits":counts,"protectedAgainstExactPromptOverlap":True,
        "familyIndependence":False,"trainTraceRate":TRAIN_TRACE_RATE,
        "outputContractsChecked":True,"productionReady":False,
        "limitations":"Synthetic procedural templates; external and human tests required."},indent=2),encoding="utf-8")
    return counts

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--output",required=True)
    p.add_argument("--train",type=int,default=3000)
    p.add_argument("--validation",type=int,default=500)
    p.add_argument("--test",type=int,default=600)
    p.add_argument("--exclude",action="append",default=[])
    a=p.parse_args()
    train,val,tests=generate(a.train,a.validation,a.test,a.exclude)
    print(json.dumps(save(a.output,train,val,tests),indent=2))
