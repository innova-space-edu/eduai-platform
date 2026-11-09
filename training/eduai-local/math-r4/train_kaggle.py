"""EDUAI R4 Kaggle runner. Reuses Nano/Lite R2 LoRA, 3 TRAINING seeds, no auto promotion.

Put this as main.py alongside generate.py; attach private input dataset
esthefano/eduai-nano-lite-adapters-r2 and enable T4 + Internet.
"""
from __future__ import annotations
import gc, importlib.metadata, inspect, json, math, os, random, re, shutil, subprocess, sys, time, traceback
from collections import Counter, defaultdict
from fractions import Fraction
from pathlib import Path
from generate import generate, save, TRAIN_SEEDS, TEST_SEEDS
from challenge import build_challenges
from evaluation import summarize, objective, validation_gate

os.environ["TOKENIZERS_PARALLELISM"]="false"
os.environ["WANDB_DISABLED"]="true"
ROOT=Path("/kaggle/working")
PROFILES=(
 {"name":"nano","model":"LiquidAI/LFM2.5-350M","revision":None,"max_tokens":384,"lr":1.2e-5,
  "focus":("algebra","recurrence"),"min_score":{"algebra":0.40,"recurrence":0.30}},
 {"name":"lite","model":"LiquidAI/LFM2.5-1.2B-Instruct","revision":"b9d816ab510f9a28dca37cb182e9da8b0226e13c",
  "max_tokens":448,"lr":1.0e-5,"focus":("algebra","recurrence","euler"),
  "min_score":{"algebra":0.45,"recurrence":0.35,"euler":0.35}},
)
def write(path,obj):
 path.parent.mkdir(exist_ok=True,parents=True)
 path.write_text(json.dumps(obj,indent=2,ensure_ascii=False),encoding="utf-8")
def read(path):return json.loads(path.read_text(encoding="utf-8"))
def as_ids(v):
 if isinstance(v,dict):v=v["input_ids"]
 elif hasattr(v,"ids"):v=v.ids
 elif hasattr(v,"input_ids"):v=v.input_ids
 elif hasattr(v,"tolist"):v=v.tolist()
 if len(v)==1 and isinstance(v[0],(list,tuple)):v=v[0]
 if not isinstance(v,(list,tuple)) or not all(isinstance(i,int) for i in v):raise RuntimeError("BAD_TOKENIZER_IDS")
 return list(v)
def runtime():
 # Pin the pair already exercised by EDUAI R3 on Kaggle. Never reinstall torch
 # (the CUDA wheel supplied by Kaggle is much larger and can break GPU support).
 versions={"transformers":"5.20.2","peft":"0.21.2"}
 mismatched=[]
 for name,wanted in versions.items():
  try:installed=importlib.metadata.version(name)
  except importlib.metadata.PackageNotFoundError:installed=None
  if installed!=wanted:mismatched.append(name+"=="+wanted)
 try:v=importlib.metadata.version("torchao")
 except importlib.metadata.PackageNotFoundError:v=None
 if v and v.startswith("0.10."):
  subprocess.check_call([sys.executable,"-m","pip","uninstall","-y","torchao"])
 if mismatched:
  print("PINNED_DEPENDENCIES_INSTALLING",mismatched,flush=True)
  subprocess.check_call([sys.executable,"-m","pip","install","--no-cache-dir",
     "--disable-pip-version-check",*mismatched])
 import torch,transformers,peft
 if not torch.cuda.is_available():raise RuntimeError("CUDA_REQUIRED")
 if transformers.__version__!=versions["transformers"] or peft.__version__!=versions["peft"]:
  raise RuntimeError("DEPENDENCY_VERSION_MISMATCH")
 print("RUNTIME_OK",torch.__version__,transformers.__version__,peft.__version__,flush=True)
def source(profile):
 n=profile["name"]
 matches=[p.parent for p in Path("/kaggle/input").glob("**/"+n+"_adapter_model.safetensors")
    if p.parent.joinpath(n+"_adapter_config.json").exists() and p.parent.joinpath(n+"_report_r2.json").exists()]
 if len(matches)!=1:raise RuntimeError("R2_ADAPTER_DATASET_REQUIRED "+n+" count "+str(len(matches)))
 folder=matches[0];report=read(folder/(n+"_report_r2.json"))
 if report.get("status")!="completed" or report.get("model")!=profile["model"]:raise RuntimeError("R2_SOURCE_MISMATCH")
 protected={}
 for tag,length in (("new",80 if n=="nano" else 100),("v4",64 if n=="nano" else 80)):
  p=folder/(n+"_test_after_"+tag+"_r2.json")
  rows=read(p)["responses"]
  if len(rows)!=length:raise RuntimeError("PROTECTED_TEST_MISSING "+n+" "+tag)
  protected[tag]=[{"category":r["category"],"question":r["question"],"answer":r["answer"]}
      for r in rows]
 return folder,protected
def args(cls,profile,output,seed,stage,epochs):
 opts={"output_dir":str(output/("tmp-"+str(seed)+"-"+str(stage))),
  "max_steps":-1,"num_train_epochs":epochs,
  "per_device_train_batch_size":2,"per_device_eval_batch_size":2,"gradient_accumulation_steps":4,
  "learning_rate":profile["lr"],"lr_scheduler_type":"cosine","fp16":True,"bf16":False,
  "logging_steps":30,"save_strategy":"no","report_to":[],"seed":seed,"data_seed":seed,
  "dataloader_num_workers":0,"remove_unused_columns":False,"optim":"adamw_torch",
  "gradient_checkpointing":False,"max_grad_norm":0.7}
 signature=set(inspect.signature(cls).parameters)
 if "warmup_ratio" in signature:opts["warmup_ratio"]=0.06
 else:raise RuntimeError("UNSUPPORTED_WARMUP")
 if "eval_strategy" in signature:opts["eval_strategy"]="no"
 elif "evaluation_strategy" in signature:opts["evaluation_strategy"]="no"
 else:raise RuntimeError("UNSUPPORTED_EVALUATION_OPTION")
 if "train_sampling_strategy" in signature:opts["train_sampling_strategy"]="group_by_length"
 elif "group_by_length" in signature:opts["group_by_length"]=True
 else:raise RuntimeError("UNSUPPORTED_SAMPLING_OPTION")
 unknown=set(opts)-signature
 if unknown:raise RuntimeError("UNSUPPORTED_TRAINING_ARGUMENTS "+str(unknown))
 return cls(**opts)
def run(profile,training,validation,tests,challenges):
 import torch
 from peft import PeftModel
 from transformers import AutoTokenizer,AutoModelForCausalLM,Trainer,TrainingArguments,DataCollatorForSeq2Seq
 name=profile["name"];folder=ROOT/("eduai-"+name+"-math-r5");folder.mkdir(exist_ok=True,parents=True)
 src,protected=source(profile)
 old_questions={r["question"] for data in protected.values() for r in data}
 for rows in [training,validation,*tests,challenges]:
  if any(r["question"] in old_questions or r.get("raw_question") in old_questions for r in rows):
   raise RuntimeError("PROTECTED_PROMPT_LEAKAGE")
 template=AutoTokenizer.from_pretrained(profile["model"],revision=profile["revision"],trust_remote_code=False)
 if template.pad_token_id is None:template.pad_token=template.eos_token
 def prompt(q):
  if template.chat_template:return as_ids(template.apply_chat_template([{"role":"user","content":q}],tokenize=True,add_generation_prompt=True))
  return as_ids(template.encode("Usuario: "+q+"\nAsistente:",add_special_tokens=True))
 def encode(row):
  prefix=prompt(row["question"]);answer=as_ids(template.encode(row["completion"],add_special_tokens=False))
  if template.eos_token_id is not None:answer.append(template.eos_token_id)
  cap=profile["max_tokens"]
  if len(answer)>=cap:raise RuntimeError("ANSWER_EXCEEDS_TOKEN_LIMIT")
  if len(prefix)+len(answer)>cap:raise RuntimeError("EXAMPLE_EXCEEDS_TOKEN_LIMIT")
  return {"input_ids":prefix+answer,"attention_mask":[1]*(len(prefix)+len(answer)),"labels":[-100]*len(prefix)+answer}
 class Samples(torch.utils.data.Dataset):
  def __init__(self,rows):self.rows=[encode(r) for r in rows]
  def __len__(self):return len(self.rows)
  def __getitem__(self,i):return self.rows[i]
 def load():
  base=AutoModelForCausalLM.from_pretrained(profile["model"],revision=profile["revision"],device_map={"":0},dtype=torch.float16,trust_remote_code=False)
  p=folder/"source-adapter";p.mkdir(exist_ok=True)
  shutil.copy2(src/(name+"_adapter_model.safetensors"),p/"adapter_model.safetensors")
  shutil.copy2(src/(name+"_adapter_config.json"),p/"adapter_config.json")
  model=PeftModel.from_pretrained(base,str(p),is_trainable=True)
  if not any(t.requires_grad for t in model.parameters()):raise RuntimeError("NO_TRAINABLE_ADAPTER")
  model.config.use_cache=False
  return base,model
 collator=DataCollatorForSeq2Seq(tokenizer=template,label_pad_token_id=-100,pad_to_multiple_of=8)
 def evaluate(model,rows):
  model.eval()
  model.config.use_cache=True
  responses=[]
  max_tokens=128
  for r in rows:
   ids=prompt(r["question"])
   v=torch.tensor([ids],dtype=torch.long,device="cuda")
   with torch.inference_mode():
    out=model.generate(input_ids=v,attention_mask=torch.ones_like(v),do_sample=False,
       max_new_tokens=max_tokens,pad_token_id=template.pad_token_id,eos_token_id=template.eos_token_id)
   new_ids=out[0,len(ids):]
   end_token=int(new_ids[-1]) if len(new_ids) else -1
   eos_ids={int(template.eos_token_id)} if template.eos_token_id is not None else set()
   cfg_eos=getattr(model.generation_config,"eos_token_id",None)
   if isinstance(cfg_eos,list):eos_ids.update(int(i) for i in cfg_eos)
   elif cfg_eos is not None:eos_ids.add(int(cfg_eos))
   responses.append({"text":template.decode(new_ids,skip_special_tokens=True).strip(),
       "tokens":len(new_ids),"max_new_tokens":max_tokens,"eos_seen":end_token in eos_ids})
  model.config.use_cache=False
  return summarize(rows,responses)

 # Validation-only checkpoint ranking, never from old R2/V4 or held-out tests.
 # Balanced 300-example validation: 50 examples for each of six skills.
 by_validation_category=defaultdict(list)
 for row in validation:
  by_validation_category[row["category"]].append(row)
 select_validation=[]
 for key in sorted(by_validation_category):
  selected=by_validation_category[key][:50]
  if len(selected)<50:raise RuntimeError("INSUFFICIENT_VALIDATION_CATEGORY "+key)
  select_validation.extend(selected)
 if len(select_validation)!=300:raise RuntimeError("INVALID_VALIDATION_SPLIT")
 base_for_validation, baseline_model_validation=load()
 baseline_validation=evaluate(baseline_model_validation,select_validation)
 base_objective=objective(baseline_validation,profile["focus"])
 del baseline_model_validation,base_for_validation
 gc.collect();torch.cuda.empty_cache()
 best_rank=None;best_seed=None;best_stage=None;best_loss=float("inf")
 best_validation=None;best_validation_gate=False;trials=[]
 for seed in TRAIN_SEEDS:
  torch.manual_seed(seed);torch.cuda.manual_seed_all(seed);random.seed(seed)
  base,model=load();phases=[]
  for stage,levels,epochs in ((1,(1,2),2.0),(2,(2,3),2.0)):
   stage_rows=[r for r in training if r["difficulty"] in levels]
   if not stage_rows:raise RuntimeError("EMPTY_STAGE")
   # At least one full shuffled pass, preferably two; computed before GPU steps.
   per_step=2*4  # batch size x gradient accumulation, single Kaggle GPU
   steps_per_epoch=math.ceil(len(stage_rows)/per_step)
   estimated_steps=math.ceil(steps_per_epoch*epochs)
   if estimated_steps>800:raise RuntimeError("STAGE_GPU_BUDGET_EXCEEDED "+str(estimated_steps))
   a_stage=args(TrainingArguments,profile,folder,seed,stage,epochs)
   trainer=Trainer(model=model,args=a_stage,train_dataset=Samples(stage_rows),
                  data_collator=collator)
   start=time.monotonic();stats=trainer.train()
   actual_steps=int(trainer.state.global_step)
   if actual_steps<steps_per_epoch:raise RuntimeError("INCOMPLETE_STAGE_DATA_COVERAGE")
   del trainer
   valid=evaluate(model,select_validation)
   scoring=objective(valid,profile["focus"])
   accepted=validation_gate(valid,baseline_validation,profile["focus"])
   phase={"stage":stage,"epochsRequested":epochs,"examples":len(stage_rows),
          "optimizerStepsExpected":estimated_steps,"optimizerStepsActual":actual_steps,
          "completedAtLeastOneEpoch":actual_steps>=steps_per_epoch,
          "trainLoss":float(stats.training_loss),"validationScore":scoring,
          "validationGatePassed":accepted,
          "validationExactCorrect":valid["correct"],
          "validationSemanticCorrect":valid["semanticCorrect"],
          "validationFormatErrors":valid["formatErrors"],
          "validationTruncated":valid["truncated"],
          "seconds":round(time.monotonic()-start,2)}
   phases.append(phase)
   # Eligibility precedes score. Loss is only a tie-breaker.
   rank=(int(accepted),scoring["score"],scoring["criticalMacro"],-float(stats.training_loss))
   if best_rank is None or rank>best_rank:
    best_rank=rank;best_seed=seed;best_stage=stage
    best_loss=float(stats.training_loss)
    best_validation=valid;best_validation_gate=accepted
    chosen=folder/"selected-adapter"
    if chosen.exists():shutil.rmtree(chosen)
    model.save_pretrained(str(chosen),safe_serialization=True)
    template.save_pretrained(str(chosen))
   print("VALIDATION_CHECKPOINT",name,seed,stage,"rank",rank,flush=True)
  trials.append({"seed":seed,"stages":phases})
  print("TRAINING_SEED_COMPLETED",name,seed,flush=True)
  del model,base;gc.collect();torch.cuda.empty_cache()
 if best_seed is None:raise RuntimeError("NO_VALIDATION_CHECKPOINT")
 write(folder/"validation-selection.json",{
   "baseline":baseline_validation,"baselineObjective":base_objective,
   "selected":best_validation,"selectedSeed":best_seed,"selectedStage":best_stage,
   "passedGate":best_validation_gate,"selectionMetric":"validationExactAnswerObjective"})
 print("SELECTED_BY_VALIDATION_ACCURACY",name,best_seed,best_stage,
       best_rank,"gate",best_validation_gate,flush=True)
 # Evaluate baseline and the single selected candidate on independent sets.
 baseline_base,baseline_model=load()
 baseline=[evaluate(baseline_model,rows) for rows in tests]
 baseline_legacy={k:evaluate(baseline_model,v) for k,v in protected.items()}
 baseline_cross_family=evaluate(baseline_model,challenges)
 del baseline_base,baseline_model;gc.collect();torch.cuda.empty_cache()
 selected_base=AutoModelForCausalLM.from_pretrained(profile["model"],revision=profile["revision"],device_map={"":0},dtype=torch.float16,trust_remote_code=False)
 selected_model=PeftModel.from_pretrained(selected_base,str(folder/"selected-adapter"),is_trainable=False)
 candidate=[evaluate(selected_model,rows) for rows in tests]
 candidate_legacy={k:evaluate(selected_model,v) for k,v in protected.items()}
 candidate_cross_family=evaluate(selected_model,challenges)
 del selected_base,selected_model;gc.collect();torch.cuda.empty_cache()
 cats=sorted({r["category"] for rows in tests for r in rows})
 by_cat={}
 for cat in cats:
  def acc(items):
   correct=sum(it["categories"].get(cat,{}).get("correct",0) for it in items)
   total=sum(it["categories"].get(cat,{}).get("total",0) for it in items)
   return round(100*correct/total,2),correct,total
  before,_,_=acc(baseline);after,correct,total=acc(candidate)
  by_cat[cat]={"before":before,"after":after,"deltaPoints":round(after-before,2),
              "correct":correct,"total":total}
 before=sum(v["correct"] for v in baseline);after=sum(v["correct"] for v in candidate)
 total=sum(v["total"] for v in candidate)
 legacy_retained=all(candidate_legacy[k]["correct"]>=baseline_legacy[k]["correct"] for k in protected)
 thresholds=all(by_cat[k]["after"]>=100*v for k,v in profile["min_score"].items())
 no_critical_regressions=all(by_cat[k]["deltaPoints"]>=0 for k in profile["focus"])
 improvements=after>before
 preferred=bool(best_validation_gate and improvements and thresholds and legacy_retained and no_critical_regressions)
 report={"campaign":"eduai-math-r5-preflight","profile":name,"model":profile["model"],"status":"completed",
   "productionReady":False,"selectedSeed":best_seed,"selectionMetric":"validationExactAnswerObjective",
   "selectedStage":best_stage,"baselineValidation":base_objective,
   "selectedValidation":objective(best_validation,profile["focus"]),
   "preferredOnValidation":best_validation_gate,
   "trainSeeds":list(TRAIN_SEEDS),"testSeeds":list(TEST_SEEDS),"trainTrials":trials,
   "newEvaluation":{"beforeCorrect":before,"afterCorrect":after,"total":total,
                    "beforePct":round(100*before/total,2),"afterPct":round(100*after/total,2)},
   "byCategory":by_cat,"legacy":{k:{"before":baseline_legacy[k]["correct"],"after":candidate_legacy[k]["correct"],
         "total":candidate_legacy[k]["total"]} for k in protected},
   "independentFamilyBenchmark":False,
   "crossFamilyDiagnostic":{"baseline":baseline_cross_family,"candidate":candidate_cross_family,
     "usedForCheckpointSelection":False,"synthetic":True},
   "preferredOnSyntheticGate":preferred,
   "productionGate":"BLOCKED: external human validation and broader problem families"}
 write(folder/"report.json",report)
 write(folder/"eval-baseline.json",baseline);write(folder/"eval-candidate.json",candidate)
 print("PROFILE_COMPLETED",name,report["newEvaluation"],"preferred",preferred,flush=True)
 return {"profile":name,"completed":True,"preferred":preferred,"before":report["newEvaluation"]["beforePct"],
         "after":report["newEvaluation"]["afterPct"]}
def main():
 # CPU preflight: protected adapter available and no unrelated corpus mixing.
 for p in PROFILES:source(p)
 print("R2_ADAPTER_PREFLIGHT_OK",flush=True)
 train,val,tests=generate(train_count=3000,validation_count=500,test_count=600)
 challenges=build_challenges()
 save(ROOT/"eduai-math-r5-data",train,val,tests)
 write(ROOT/"eduai-math-r5-data"/"cross-family-diagnostic.json",challenges)
 runtime()
 done=[];errors=[]
 for profile in PROFILES:
  try:done.append(run(profile,train,val,tests,challenges))
  except Exception as exc:
   traceback.print_exc();errors.append({"profile":profile["name"],"error":repr(exc)})
   write(ROOT/("eduai-"+profile["name"]+"-math-r5")/"error.json",errors[-1])
  finally:
   gc.collect()
   try:
    import torch
    torch.cuda.empty_cache()
   except Exception:pass
 write(ROOT/"campaign-summary.json",{"campaign":"eduai-math-r5-preflight","completedProfiles":done,"errors":errors,
    "productionReady":False,"trainingSeeds":list(TRAIN_SEEDS),"evaluationSeeds":list(TEST_SEEDS)})
 if errors:raise RuntimeError("R4_PROFILES_FAILED "+str(errors))
if __name__=="__main__":main()
