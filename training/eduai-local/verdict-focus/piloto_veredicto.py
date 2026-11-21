"""EDUAI: piloto focalizado en veredicto, con evaluación matemática flexible."""
from __future__ import annotations
import ast, contextlib, hashlib, importlib.metadata, json, math, os, random, re
import shutil, subprocess, sys, threading, time, unicodedata, uuid, zipfile
from pathlib import Path
from fractions import Fraction
from collections import Counter
from collections.abc import Mapping
MODEL="Qwen/Qwen3-4B-Instruct-2507"
REVISION="cdbee75f17c01a7cc42f958dc650907174af0554"
PARENT_SHA="e25109f5a904c3b23beccf8c43ba9e970fb7be351ebdaceea14cd17d56c3aca6"
PARENT_PROTOCOL="b4b51c850477bace100e537ab97327da1d7e293b7a9f2816e106411c3a2b2958"
SYSTEM="Responde en español y respeta el formato solicitado. El intento propuesto puede contener errores; los datos originales tienen prioridad."
ROOT=Path("/kaggle/working/eduai-qwen-veredicto-foco")
SEED=616421
CFG={"version":"verdict-focus-v1","steps":8,"accumulation":16,"lr":1e-5,"rank":4,
     "alpha":8,"max_length":512,"max_new_tokens":128,"verdict_weight":4.0,"sign_weight":2.0}
class UnsupportedMath(ValueError):pass
def norm(s):
 return "".join(c for c in unicodedata.normalize("NFD",s.lower().replace("−","-")) if unicodedata.category(c)!="Mn")
class Expr:
 def __init__(self,s):
  if not isinstance(s,str):raise UnsupportedMath()
  s=unicodedata.normalize("NFKC",s).strip()
  if s.startswith("**") and s.endswith("**"):s=s[2:-2].strip()
  if s.startswith("$") and s.endswith("$"):s=s[1:-1]
  if s.startswith(r"\(") and s.endswith(r"\)"):s=s[2:-2]
  for a,b in [("−","-"),("–","-"),("×","*"),("·","*"),("÷","/"),("^","**"),("[","("),("]",")"),("{","("),("}",")")]:s=s.replace(a,b)
  if ".." in s:raise UnsupportedMath()
  s=s.rstrip().removesuffix(".").strip()
  if not s or len(s)>300 or not re.fullmatch(r"[0-9+\-*/().\s]+",s):raise UnsupportedMath()
  self.text=s
  try:self.node=ast.parse(s,mode="eval").body
  except (SyntaxError,RecursionError) as e:raise UnsupportedMath() from e
  if len(list(ast.walk(self.node)))>100:raise UnsupportedMath()
  self.value=self.ev(self.node)
 def ev(self,n,depth=0):
  if depth>24:raise UnsupportedMath()
  if isinstance(n,ast.Constant) and type(n.value) in (int,float):
   s=ast.get_source_segment(self.text,n)
   if not re.fullmatch(r"[0-9]{1,18}(?:\.[0-9]{0,8})?|\.[0-9]{1,8}",s or ""):raise UnsupportedMath()
   v=Fraction(s)
  elif isinstance(n,ast.UnaryOp) and isinstance(n.op,(ast.UAdd,ast.USub)):
   v=self.ev(n.operand,depth+1)*(-1 if isinstance(n.op,ast.USub) else 1)
  elif isinstance(n,ast.BinOp) and isinstance(n.op,(ast.Add,ast.Sub,ast.Mult,ast.Div,ast.Pow)):
   a,b=self.ev(n.left,depth+1),self.ev(n.right,depth+1)
   if isinstance(n.op,ast.Add):v=a+b
   elif isinstance(n.op,ast.Sub):v=a-b
   elif isinstance(n.op,ast.Mult):v=a*b
   elif isinstance(n.op,ast.Div):
    if not b:raise UnsupportedMath()
    v=a/b
   else:
    if b.denominator!=1 or abs(b.numerator)>12 or (not a and b<=0):raise UnsupportedMath()
    v=a**int(b)
  else:raise UnsupportedMath()
  if abs(v.numerator)>10**24 or v.denominator>10**24:raise UnsupportedMath()
  return v
 def terms(self,n=None,sign=1):
  n=self.node if n is None else n
  if isinstance(n,ast.UnaryOp) and isinstance(n.op,(ast.UAdd,ast.USub)):return self.terms(n.operand,sign*(-1 if isinstance(n.op,ast.USub) else 1))
  if isinstance(n,ast.BinOp) and isinstance(n.op,(ast.Add,ast.Sub)):return self.terms(n.left,sign)+self.terms(n.right,sign*(-1 if isinstance(n.op,ast.Sub) else 1))
  return [sign*self.ev(n)]
 def sig(self):return Counter(v for v in self.terms() if v)
def fields(text):
 labels=r"(minuendo|sustraendo|candidato|comprobaci[oó]n|veredicto|resultado|operaci[oó]n|transformaci[oó]n)"
 text=re.sub(r"\*\*\s*"+labels+r"\s*:\s*\*\*",r"\1:",text,flags=re.I)
 text=re.sub(r";\s*(?="+labels+r"\s*:)", "\n",text,flags=re.I)
 out={}
 for k,v in re.findall(r"(?mi)^\s*(?:[-*]|[0-9]+[.)])?\s*"+labels+r"\s*:\s*([^\n]+?)\s*$",text):
  k=norm(k)
  if k in out:raise UnsupportedMath()
  out[k]=v.strip()
 return out
def anchored(s,terms):
 e=Expr(s);return e.value==sum(map(Fraction,terms),Fraction()) and e.sig()==Counter(Fraction(v) for v in terms if v)
def grade(row,text):
 a,b=row["a"],row["b"];kind=row["kind"]
 m={"correct":False,"parsed":False,"evaluation_version":"math-equivalence-v2"}
 try:f=fields(text)
 except UnsupportedMath:return m
 def value(k):
  try:return Expr(f[k]).value
  except (KeyError,UnsupportedMath):return None
 if kind=="roles":
  x,y=value("minuendo"),value("sustraendo")
  return {**m,"correct":(x,y)==(a,b),"parsed":x is not None and y is not None}
 if kind=="solve":
  v=value("resultado");m["numeric_correct"]=v==a-b
  try:
   op=anchored(f["operacion"],[a,-b]);tr=anchored(f["transformacion"],[a,-b])
   m.update(correct=op and tr and v==a-b,parsed=True)
  except (KeyError,UnsupportedMath):pass
  return m
 c=row["candidate"];truth="correcto" if c+b==a else "incorrecto"
 words=set(re.findall(r"\b(correcto|incorrecto)\b",norm(f.get("veredicto",""))))
 verdict=next(iter(words)) if len(words)==1 else None
 m.update(verdict_correct=verdict==truth,false_acceptance=truth=="incorrecto" and verdict=="correcto")
 if kind=="judge":return {**m,"correct":verdict==truth,"parsed":verdict is not None}
 anchors=all(k not in f or value(k)==v for k,v in [("minuendo",a),("sustraendo",b),("candidato",c)])
 try:
  raw=f["comprobacion"]
  if "==" in raw or any(x in raw for x in ("<",">","!=")):raise UnsupportedMath()
  parts=raw.split("=")
  if not 2<=len(parts)<=5:raise UnsupportedMath()
  chain=[Expr(s) for s in parts]
  good=all(e.value==c+b for e in chain) and any(e.sig()==Counter(Fraction(x) for x in (c,b) if x) for e in chain)
  m.update(correct=anchors and good and verdict==truth,math_correct=good,anchors_correct=anchors,parsed=verdict is not None)
 except (KeyError,UnsupportedMath):pass
 return m
def messages(r):return [{"role":"system","content":SYSTEM},{"role":"user","content":r["prompt"]}]
def ids(v):
 if isinstance(v,Mapping):v=v["input_ids"]
 if hasattr(v,"tolist"):v=v.tolist()
 if len(v)==1 and isinstance(v[0],list):v=v[0]
 if not isinstance(v,list) or not all(type(x) is int for x in v):raise RuntimeError("TOKEN_FORMAT")
 return v
def encode(tok,row):
 prefix=ids(tok.apply_chat_template(messages(row),tokenize=True,add_generation_prompt=True))
 allmsg=messages(row)+[{"role":"assistant","content":row["target"]}]
 full=ids(tok.apply_chat_template(allmsg,tokenize=True,add_generation_prompt=False))
 ptext=tok.apply_chat_template(messages(row),tokenize=False,add_generation_prompt=True)
 text=tok.apply_chat_template(allmsg,tokenize=False,add_generation_prompt=False)
 if full[:len(prefix)]!=prefix or not text.startswith(ptext+row["target"]):raise RuntimeError("TEMPLATE_BOUNDARY")
 if not 0<len(prefix)<len(full)<=CFG["max_length"]:raise RuntimeError("CONTEXT_LIMIT "+row["id"])
 offsets=tok(text,add_special_tokens=False,return_offsets_mapping=True)
 if ids(offsets)!=full:raise RuntimeError("OFFSET_ALIGNMENT")
 weights=[0.0]*len(prefix)+[1.0]*(len(full)-len(prefix));spans=[]
 for label,weight in [("Sustraendo:",CFG["sign_weight"]),("Comprobación:",CFG["sign_weight"]),("Veredicto:",CFG["verdict_weight"])]:
  start=row["target"].find(label)
  if start<0:continue
  start+=len(label);end=row["target"].find("\n",start)
  if end<0:end=len(row["target"])
  spans.append((len(ptext)+start,len(ptext)+end,weight))
 for i,(a,b) in enumerate(offsets["offset_mapping"]):
  if i<len(prefix):continue
  for left,right,w in spans:
   if b>left and a<right:weights[i]=max(weights[i],w)
 labels=[-100]*len(prefix)+full[len(prefix):]
 if row["kind"] in ("verify","judge") and not any(w==4 for w in weights):raise RuntimeError("VERDICT_MASK_EMPTY")
 assert all(w==0 for w in weights[:len(prefix)])
 return {"input_ids":full,"labels":labels,"weights":weights,"boundary":len(prefix)}
def fmt(n,style):
 if style==0:return f"({n})"
 if style==1:return str(n)
 return f"({n:+d})"
def question(a,b,family,style):
 a,b=fmt(a,style),fmt(b,(style+1)%3)
 return [f"Resta {b} de {a}.",f"Quita {b} a {a}.",f"A {a} réstale {b}.",f"Parte de {a} y resta {b}.",f"Sustrae {b} del número {a}.",f"Disminuye {a} en {b}."][family]
def record(identifier,a,b,kind,family,style,c=None):
 q=question(a,b,family,style);r={"id":identifier,"a":a,"b":b,"candidate":c,"kind":kind,"question":q}
 if kind in ("verify","judge"):
  verdict="correcto" if c+b==a else "incorrecto"
  prompt=q+f"\nCandidato a evaluar: ({c}).\nUn intento propone ({c})+({a-c})=({a}). Esa comprobación puede cambiar los datos originales."
  if kind=="judge":
   prompt+="\nEvalúa el candidato usando los operandos ORIGINALES. Responde una línea: Veredicto: correcto o incorrecto."
   target="Veredicto: "+verdict
  else:
   prompt+="\nIdentifica los operandos ORIGINALES y comprueba el candidato, sin sustituirlo. Responde cinco líneas: Minuendo, Sustraendo, Candidato, Comprobación, Veredicto."
   target=f"Minuendo: {a}\nSustraendo: {b}\nCandidato: {c}\nComprobación: {fmt(c,style)}+{fmt(b,(style+1)%3)}=({c+b})\nVeredicto: {verdict}"
 elif kind=="roles":
  prompt=q+"\nIdentifica sin calcular. Responde solo dos líneas:\nMinuendo: entero\nSustraendo: entero"
  target=f"Minuendo: {a}\nSustraendo: {b}"
 else:
  prompt=q+"\nResuelve respetando los signos originales. Responde solo tres líneas:\nOperación: (minuendo)-(sustraendo)\nTransformación: (minuendo)+(opuesto del sustraendo)\nResultado: entero"
  target=f"Operación: {fmt(a,style)}-({b})\nTransformación: {fmt(a,(style+1)%3)}+({-b})\nResultado: {a-b}"
 return dict(r,prompt=prompt,target=target)
def make_data(excluded):
 rng=random.Random(SEED);used=set(excluded)|{(b,a) for a,b in excluded}
 def draw(group):
  for _ in range(10000):
   x,y=rng.randint(100,999),rng.randint(100,999)
   a,b=[(x,y),(-x,-y),(x,-y),(0,x),(0,-x),(x,0)][group%6]
   if group%6==2 and rng.randrange(2):a,b=b,a
   if a!=b and (a,b) not in used and (b,a) not in used:
    used.update(((a,b),(b,a)));return a,b
  raise RuntimeError("PAIR_EXHAUSTED")
 train=[]
 for kind,count in [("verify",24),("judge",16)]:
  for i in range(count):
   a,b=draw(i)
   for wrong in (False,True):
    c=a+b if wrong and b else a+1 if wrong else a-b
    train.append(record(f"train-{kind}-{i}-{int(wrong)}",a,b,kind,i%6,i%3,c))
 for kind in ("roles","solve"):
  for i in range(24):
   a,b=draw(i);train.append(record(f"train-{kind}-{i}",a,b,kind,i%6,i%3))
 rng.shuffle(train);test=[]
 for i in range(12):
  a,b=draw(i)
  for wrong in (False,True):
   c=a+b if wrong and b else a+1 if wrong else a-b
   test.append(record(f"test-verify-{i}-{int(wrong)}",a,b,"verify",i%6,i%3,c))
 for kind in ("roles","solve"):
  for i in range(6):
   a,b=draw(i);test.append(record(f"test-{kind}-{i}",a,b,kind,i%6,i%3))
 assert len(train)==128 and len(test)==36
 assert not {(r["a"],r["b"]) for r in train}&{(r["a"],r["b"]) for r in test}
 assert all(grade(r,r["target"])["correct"] for r in train+test)
 return train,test
def digest(o):return hashlib.sha256(json.dumps(o,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def atomic(path,o):
 tmp=path.with_suffix(".tmp");tmp.write_text(json.dumps(o,ensure_ascii=False,indent=2));os.replace(tmp,path)
def scores(records,lookup):
 result={}
 for phase in ("validation","test"):
  result[phase]={}
  for who in ("original","parent","candidate"):
   rows=[r for r in records if r["phase"]==phase and r["who"]==who]
   ver=[r for r in rows if lookup[r["id"]]["kind"]=="verify"];ret=[r for r in rows if lookup[r["id"]]["kind"]!="verify"]
   result[phase][who]={"completed":len(rows),"verification_correct":sum(r["metrics"]["correct"] for r in ver),"verification_total":len(ver),
    "false_acceptances":sum(r["metrics"].get("false_acceptance",False) for r in ver),"retention_correct":sum(r["metrics"]["correct"] for r in ret),"retention_total":len(ret)}
 return result
def gate(summary,phase):
 a=summary[phase]["original"];b=summary[phase]["candidate"]
 return a["completed"]==b["completed"]==36 and b["verification_correct"]>=22 and b["verification_correct"]>a["verification_correct"] and b["false_acceptances"]==0 and b["retention_correct"]>=max(10,a["retention_correct"])
@contextlib.contextmanager
def stage(label):
 start=time.monotonic();stop=threading.Event();print("INICIO",label,flush=True)
 def heartbeat():
  while not stop.wait(30):print("EN_CURSO",label,round(time.monotonic()-start),"s",flush=True)
 thread=threading.Thread(target=heartbeat,daemon=True);thread.start()
 try:yield
 finally:stop.set();thread.join(timeout=1);print("FIN",label,round(time.monotonic()-start,1),"s",flush=True)
def bootstrap():
 packages={"transformers":"5.20.2","peft":"0.21.2","accelerate":"1.11.0","bitsandbytes":"0.48.1","safetensors":"0.8.0"};needed=[]
 for name,version in packages.items():
  try:current=importlib.metadata.version(name)
  except importlib.metadata.PackageNotFoundError:current=None
  if current!=version:needed.append(name+"=="+version)
 if needed:subprocess.check_call([sys.executable,"-m","pip","install","--disable-pip-version-check",*needed])
 try:importlib.metadata.version("torchao")
 except importlib.metadata.PackageNotFoundError:return
 subprocess.check_call([sys.executable,"-m","pip","uninstall","-y","torchao"])

def load_source():
 root=Path(os.environ.get("EDUAI_FOCUS_INPUT_ROOT","/kaggle/input"));candidates=[]
 for p in root.glob("**/diagnostico_payload.json"):
  d=json.loads(p.read_text())
  if d.get("pilot_fingerprint")==PARENT_PROTOCOL and d.get("adapter_sha256")==PARENT_SHA:
   weight=p.parent/"adapter_model.safetensors"
   if weight.is_file() and sha(weight)==PARENT_SHA:candidates.append((d,weight.read_bytes()))
 if not candidates:
  for p in root.glob("**/EDUAI_DIAGNOSTICO_DATOS_PRIVADOS.zip"):
   with zipfile.ZipFile(p) as z:
    d=json.loads(z.read("diagnostico_payload.json"));raw=z.read("adapter_model.safetensors")
    if d.get("pilot_fingerprint")==PARENT_PROTOCOL and hashlib.sha256(raw).hexdigest()==PARENT_SHA:candidates.append((d,raw))
 if not candidates:raise RuntimeError("FALTA_INPUT: añade el MISMO dataset privado del diagnóstico, con diagnostico_payload.json y adapter_model.safetensors. No empieces otro entrenamiento ni uses Lite R2.")
 return candidates[0]
def summarize(s,lookup):
 s["summary"]=scores(s["responses"],lookup)
def persist(s,lookup):
 summarize(s,lookup);atomic(ROOT/"pilot_state.json",s)
 with zipfile.ZipFile(ROOT/"informe_veredicto.zip.tmp","w",zipfile.ZIP_DEFLATED) as z:z.write(ROOT/"pilot_state.json","pilot_state.json")
 os.replace(ROOT/"informe_veredicto.zip.tmp",ROOT/"informe_veredicto.zip")
def checkpoint_meta(folder,fp,step):
 m=json.loads((folder/"checkpoint_state.json").read_text())
 if m["fingerprint"]!=fp or m["step"]!=step:raise RuntimeError("CHECKPOINT_PROTOCOL")
 required={"adapter_model.safetensors","adapter_config.json","optimizer.pt","scaler.pt","rng.pt"}
 if not required<=set(m["hashes"]):raise RuntimeError("CHECKPOINT_INCOMPLETE")
 for name,value in m["hashes"].items():
  if Path(name).name!=name or sha(folder/name)!=value:raise RuntimeError("CHECKPOINT_HASH")
 return m
def recover(fp):
 choices=[];bad=[]
 paths=([ROOT/"pilot_state.json"] if (ROOT/"pilot_state.json").exists() else [])+sorted(Path("/kaggle/input").glob("**/pilot_state.json"))
 for path in paths:
  d=json.loads(path.read_text())
  if d.get("fingerprint")!=fp:
   if path.parent==ROOT:raise RuntimeError("Otra prueba ocupa working. No se sobrescribe.")
   continue
  folder=path.parent/f"step-{d['new_steps']:03d}" if d["new_steps"] else None
  try:
   if folder:checkpoint_meta(folder,fp,d["new_steps"])
   choices.append((d,folder))
  except (OSError,ValueError,KeyError,RuntimeError):bad.append(d["new_steps"])
 for p in list(ROOT.glob("step-*/checkpoint_state.json"))+list(Path("/kaggle/input").glob("**/checkpoint_state.json")):
  if not re.fullmatch(r"step-[0-9]{3}",p.parent.name):continue
  m=json.loads(p.read_text())
  if m.get("fingerprint")!=fp:continue
  try:
   checkpoint_meta(p.parent,fp,m["step"]);d=m["state"]
   assert d["new_steps"]==m["step"]
   choices.append((d,p.parent))
  except (OSError,ValueError,KeyError,RuntimeError):bad.append(m["step"])
 if bad and max(bad)>max((d["new_steps"] for d,p in choices),default=-1):
  raise RuntimeError("Falta checkpoint u optimizador. Adjunta TODA la carpeta de salida; el informe solo no reanuda entrenamiento. No se reiniciará desde cero.")
 if not choices:return None,None
 s,folder=max(choices,key=lambda x:(x[0]["new_steps"],len(x[0]["responses"]),x[0].get("complete",False)))
 if folder and folder.parent!=ROOT:
  dest=ROOT/folder.name
  if not dest.exists():
   temp=ROOT/("copy-"+uuid.uuid4().hex);shutil.copytree(folder,temp);checkpoint_meta(temp,fp,s["new_steps"]);os.replace(temp,dest)
  checkpoint_meta(dest,fp,s["new_steps"]);folder=dest
 return s,folder
def self_test():
 for text,want in [("2-3",-1),("(5)-2",3),("(-5)+(2)",-3),("-(5-2)",-3),("5-(-2)",7),("-5^2",-25),("(-5)^2",25)]:
  assert Expr(text).value==want
 for a in range(-5,6):
  for b in range(-5,6):
   r=record("test",a,b,"solve",0,1);assert grade(r,r["target"])["correct"]
 row={"kind":"verify","a":39,"b":35,"candidate":74}
 result=grade(row,"Comprobación: 74-35=39\nVeredicto: correcto")
 assert result["false_acceptance"] and not result["correct"]
 assert grade(row,"Comprobación: 74+35=109\nVeredicto: incorrecto")["correct"]
 assert grade({"kind":"verify","a":39,"b":35,"candidate":4},"Comprobación: 35+4=39\nVeredicto: correcto")["correct"]
 for text in ["__import__('os')","1/0","2**100000","0**0","1//2"]:
  try:Expr(text)
  except UnsupportedMath:pass
  else:raise AssertionError("Unsafe expression accepted")
 train,test=make_data({(0,150),(39,35)})
 assert len(train)==128 and len(test)==36
 ver=[r for r in train if r["kind"] in ("judge","verify")]
 assert len(ver)==80 and sum(r["candidate"]+r["b"]==r["a"] for r in ver)==40
 assert sum(r["kind"]=="judge" for r in train)==32
 assert sum(r["kind"]=="verify" for r in train)==48
 assert sum(r["kind"]=="roles" for r in train)==sum(r["kind"]=="solve" for r in train)==24
 assert digest(make_data({(0,150),(39,35)}))==digest((train,test))
 print("SELF_TEST_OK: 128 train, 36 test; signos, formatos, equilibrio y exclusión; sin GPU ni entrenamiento.")
class BudgetStop(Exception):pass
def main():
 if "--self-test" in sys.argv:
  self_test();return
 data,parent_raw=load_source();ROOT.mkdir(parents=True,exist_ok=True)
 validation=[r for r in data["rows"] if r["split"]=="validation"]
 if len(validation)!=36:raise RuntimeError("VALIDATION_INPUT")
 excluded={(r["a"],r["b"]) for r in data["rows"]}
 train,test=make_data(excluded);lookup={r["id"]:r for r in validation+test}
 for r in validation:assert grade(r,r["target"])["correct"]
 source_lookup={r["id"]:r for r in validation}
 cached=[]
 for old in data["saved_validation_responses"]:
  who="original" if old["condition"]=="before" else "parent"
  if old["id"] not in source_lookup:raise RuntimeError("CACHED_ID")
  cached.append({"id":old["id"],"phase":"validation","who":who,"text":old["response"],
                 "metrics":grade(source_lookup[old["id"]],old["response"]),"source":"saved-pilot"})
 if len(cached)!=72 or len({(r["id"],r["who"]) for r in cached})!=72:raise RuntimeError("CACHED_RESPONSES")
 fp=digest({"version":CFG,"parent":PARENT_SHA,"train":train,"test":test,"validation":validation,
            "model":MODEL,"revision":REVISION,"system":SYSTEM})
 state,checkpoint=recover(fp)
 if state is None:
  state={"fingerprint":fp,"training":True,"productionReady":False,"complete":False,"new_steps":0,
   "parent_step":8,"parent_sha256":PARENT_SHA,"responses":cached,"training_log":[],
   "config":CFG,"train":train,"validation":validation,"test":test,
   "caveat":"Validación ya observada para desarrollo. Solo el test nuevo queda reservado; no prueba generalización amplia."}
 state["training_log"]=[r for r in state["training_log"] if r["step"]<=state["new_steps"]]
 keys=set()
 for r in state["responses"]:
  key=(r["phase"],r["who"],r["id"])
  if key in keys or r["metrics"]!=grade(lookup[r["id"]],r["text"]):raise RuntimeError("RESUME_RESPONSE_MISMATCH")
  keys.add(key)
 persist(state,lookup)
 print("RECUPERADO",state["new_steps"],"/8 actualizaciones nuevas; padre=8.",flush=True)
 print("BASELINES",json.dumps(state["summary"]["validation"],ensure_ascii=False),flush=True)
 if state["complete"]:
  print(state["decision"]);return
 with stage("dependencias"):bootstrap()
 import torch,numpy as np,transformers,peft
 from transformers import AutoTokenizer,AutoModelForCausalLM,BitsAndBytesConfig,set_seed
 from peft import prepare_model_for_kbit_training,get_peft_model,LoraConfig,get_peft_model_state_dict,set_peft_model_state_dict
 from safetensors.torch import load_file,load as load_safetensors
 if not torch.cuda.is_available():raise RuntimeError("Activa GPU T4 e Internet.")
 env={"torch":torch.__version__,"transformers":transformers.__version__,"peft":peft.__version__,
      "bitsandbytes":importlib.metadata.version("bitsandbytes"),"cuda":torch.version.cuda,"gpu":torch.cuda.get_device_name(0)}
 if env!=data["pilot_environment"]:raise RuntimeError("Se exige el mismo entorno/T4 del diagnóstico: "+json.dumps(env))
 if state.get("environment") and state["environment"]!=env:raise RuntimeError("RESUME_ENVIRONMENT")
 state["environment"]=env;set_seed(SEED)
 with stage("tokenizer"):
  tok=AutoTokenizer.from_pretrained(MODEL,revision=REVISION,trust_remote_code=False)
 if tok.pad_token_id is None:tok.pad_token=tok.eos_token
 encoded=[encode(tok,r) for r in train]
 for r in validation+test:encode(tok,r)
 state["mask_audit"]={"prompt_loss_ignored":True,"truncated":False,"examples":len(encoded),
 "max_sequence":max(len(r["input_ids"]) for r in encoded),
 "verdict_weighted_examples":sum(any(w==4 for w in r["weights"]) for r in encoded)}
 if state["mask_audit"]["verdict_weighted_examples"]!=80:raise RuntimeError("VERDICT_MASK_COUNT")
 persist(state,lookup);print("MASK_AUDIT",state["mask_audit"],flush=True)
 quant=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type="nf4",bnb_4bit_use_double_quant=True,bnb_4bit_compute_dtype=torch.float16)
 with stage("descarga/carga Qwen 4B"):
  base=AutoModelForCausalLM.from_pretrained(MODEL,revision=REVISION,quantization_config=quant,device_map={"":0},dtype=torch.float16,trust_remote_code=False,attn_implementation="eager")
 base=prepare_model_for_kbit_training(base,use_gradient_checkpointing=True,gradient_checkpointing_kwargs={"use_reentrant":False})
 model=get_peft_model(base,LoraConfig(task_type="CAUSAL_LM",r=4,lora_alpha=8,lora_dropout=0.0,target_modules=["q_proj","v_proj"],bias="none"))
 weights=load_file(str(checkpoint/"adapter_model.safetensors")) if checkpoint else load_safetensors(parent_raw)
 expected=get_peft_model_state_dict(model)
 if weights.keys()!=expected.keys() or any(weights[k].shape!=expected[k].shape for k in weights):raise RuntimeError("ADAPTER_SHAPE")
 set_peft_model_state_dict(model,weights)
 if any(not torch.equal(v.detach().cpu(),weights[k]) for k,v in get_peft_model_state_dict(model).items()):raise RuntimeError("ADAPTER_LOAD")
 named=[(n,p) for n,p in model.named_parameters() if p.requires_grad]
 if not named or any("lora_" not in n for n,p in named):raise RuntimeError("BASE_NOT_FROZEN")
 state["trainable_parameters"]=sum(p.numel() for n,p in named)
 optimizer=torch.optim.AdamW([p for n,p in named],lr=CFG["lr"],weight_decay=0.0)
 scaler=torch.amp.GradScaler("cuda",init_scale=1024.0)
 if checkpoint:
  optimizer.load_state_dict(torch.load(checkpoint/"optimizer.pt",map_location="cpu",weights_only=True))
  scaler_state=torch.load(checkpoint/"scaler.pt",map_location="cpu",weights_only=True)
  scaler_state["scale"]=min(float(scaler_state["scale"]),1024.0)
  scaler.load_state_dict(scaler_state)
  rng=torch.load(checkpoint/"rng.pt",map_location="cpu",weights_only=True)
  torch.set_rng_state(rng["torch"]);torch.cuda.set_rng_state(rng["cuda"],0);random.setstate(rng["python"])
  ns=rng["numpy"];np.random.set_state((ns[0],np.array(ns[1],dtype="uint32"),ns[2],ns[3],ns[4]))
 minutes=float(os.environ.get("EDUAI_FOCUS_MINUTES","20"))
 if not 5<=minutes<=60:raise RuntimeError("Presupuesto permitido: 5 a 60 minutos después de carga.")
 deadline=time.monotonic()+minutes*60
 def budget():
  if time.monotonic()>deadline:raise BudgetStop()
 def save_step(step):
  temp=ROOT/("pending-"+uuid.uuid4().hex);temp.mkdir()
  model.save_pretrained(temp,safe_serialization=True)
  torch.save(optimizer.state_dict(),temp/"optimizer.pt");torch.save(scaler.state_dict(),temp/"scaler.pt")
  ns=np.random.get_state()
  torch.save({"torch":torch.get_rng_state(),"cuda":torch.cuda.get_rng_state(0),"python":random.getstate(),
  "numpy":(ns[0],ns[1].tolist(),ns[2],ns[3],ns[4])},temp/"rng.pt")
  snapshot=dict(state,new_steps=step)
  meta={"fingerprint":fp,"step":step,"state":snapshot,"hashes":{p.name:sha(p) for p in temp.iterdir() if p.is_file()}}
  (temp/"checkpoint_state.json").write_text(json.dumps(meta,ensure_ascii=False))
  dest=ROOT/f"step-{step:03d}"
  if dest.exists():raise RuntimeError("No se sobrescribe un checkpoint.")
  os.replace(temp,dest);checkpoint_meta(dest,fp,step)
  state["new_steps"]=step;persist(state,lookup)
 def evaluate(rows,phase,who):
  model.eval();model.config.use_cache=True
  done={(r["phase"],r["who"],r["id"]) for r in state["responses"]}
  cm=model.disable_adapter() if who=="original" else contextlib.nullcontext()
  with cm:
   for r in rows:
    if (phase,who,r["id"]) in done:continue
    budget();set_seed(SEED)
    inputs=tok.apply_chat_template(messages(r),tokenize=True,add_generation_prompt=True,return_dict=True,return_tensors="pt").to("cuda")
    with torch.inference_mode():
     out=model.generate(**inputs,max_new_tokens=128,do_sample=False,pad_token_id=tok.pad_token_id)
    tokens=out[0,inputs["input_ids"].shape[1]:];text=tok.decode(tokens,skip_special_tokens=True).strip()
    state["responses"].append({"id":r["id"],"phase":phase,"who":who,"text":text,"metrics":grade(r,text),
                             "output_tokens":len(tokens),"truncated":len(tokens)>=128,"source":"new-generation"})
    persist(state,lookup);print("EVAL",phase,who,sum(x["phase"]==phase and x["who"]==who for x in state["responses"]),"/36",flush=True)
 try:
  state["status"]="running";state.pop("error",None);state["phase"]="training";persist(state,lookup)
  model.train();model.config.use_cache=False
  for step in range(state["new_steps"],8):
   # Retry the same accumulation after FP16 overflow; never advance on a skipped update.
   for attempt in range(12):
    budget();optimizer.zero_grad(set_to_none=True);weighted=[];ordinary=[]
    scale_before=float(scaler.get_scale())
    for item in encoded[step*16:(step+1)*16]:
     budget()
     x=torch.tensor([item["input_ids"]],device="cuda")
     labels=torch.tensor(item["labels"][1:],device="cuda");w=torch.tensor(item["weights"][1:],device="cuda")
     active=labels!=-100
     with torch.autocast("cuda",dtype=torch.float16):
      logits=model(input_ids=x,attention_mask=torch.ones_like(x),use_cache=False).logits[0,:-1]
      ce=torch.nn.functional.cross_entropy(logits[active].float(),labels[active],reduction="none")
      loss=(ce*w[active]).sum()/w[active].sum()
     if not torch.isfinite(loss):raise RuntimeError("NONFINITE_LOSS")
     weighted.append(float(loss.detach()));ordinary.append(float(ce.mean().detach()))
     scaler.scale(loss/16).backward()
    scaler.unscale_(optimizer)
    grads=[p.grad for n,p in named if p.grad is not None]
    if not grads:raise RuntimeError("MISSING_GRADIENT")
    finite=all(bool(torch.isfinite(g).all()) for g in grads)
    norm=torch.nn.utils.clip_grad_norm_([p for n,p in named],1.0) if finite else None
    if not finite or not bool(torch.isfinite(norm)):
     lower=max(1.0,scale_before*0.5)
     scaler.update(new_scale=lower)
     optimizer.zero_grad(set_to_none=True)
     print("FP16_OVERFLOW",step+1,"retry",attempt+1,"scale",scale_before,"->",lower,flush=True)
     if scale_before<=1.0:raise RuntimeError("NONFINITE_GRADIENT_AT_MIN_SCALE")
     continue
    if float(norm)==0:raise RuntimeError("ZERO_GRADIENT")
    scaler.step(optimizer);scaler.update();optimizer.zero_grad(set_to_none=True)
    state["training_log"].append({"step":step+1,"weighted_loss":sum(weighted)/16,"unweighted_loss":sum(ordinary)/16,"grad_norm":float(norm),"examples":16,"fp16_scale":scale_before,"overflow_retries":attempt})
    break
   else:raise RuntimeError("GRADIENT_RETRY_LIMIT")
   save_step(step+1);print("CHECKPOINT_GUARDADO",step+1,"/8 nuevas actualizaciones",flush=True)
  state["phase"]="validation";persist(state,lookup);evaluate(validation,"validation","candidate")
  persist(state,lookup);state["validation_passed"]=gate(state["summary"],"validation")
  if not state["validation_passed"]:
   state.update(complete=True,status="complete",decision="RECHAZADO_NO_DESPLEGAR")
   persist(state,lookup);print(json.dumps(state["summary"],ensure_ascii=False,indent=2));print(state["decision"]);return
  state["phase"]="test_reserved";persist(state,lookup)
  evaluate(test,"test","original");evaluate(test,"test","candidate");persist(state,lookup)
  state.update(complete=True,status="complete",decision="CANDIDATO_PARA_REPLICA" if gate(state["summary"],"test") else "RECHAZADO_NO_DESPLEGAR")
  persist(state,lookup);print(json.dumps(state["summary"],ensure_ascii=False,indent=2));print(state["decision"])
 except BudgetStop:
  optimizer.zero_grad(set_to_none=True);state["status"]="paused";persist(state,lookup)
  print("PAUSADO_CON_GUARDADO: conserva carpeta completa, no solo informe.",flush=True)
 except BaseException as exc:
  state["status"]="interrupted";state["error"]=type(exc).__name__+": "+str(exc)[:300];persist(state,lookup);raise
if __name__=="__main__":main()
