"""Private Kaggle entrypoint, bundled by build_kaggle_bundle.py. No EduAI credentials."""
from pathlib import Path
import os, sys, json, hashlib, time, importlib.util, subprocess
os.environ['CUDA_VISIBLE_DEVICES'] = '0'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
os.environ['WANDB_DISABLED'] = 'true'
ROOT = Path('/kaggle/working/eduai')
ROOT.mkdir(parents=True, exist_ok=True)
os.chdir(ROOT)
subprocess.run([sys.executable, '-m', 'pip', 'install', '--quiet', 'transformers==4.57.2', 'peft==0.17.1', 'accelerate==1.11.0', 'datasets==4.3.0', 'bitsandbytes==0.48.2', 'safetensors==0.6.2'], check=True)
import torch
from huggingface_hub import HfApi
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig, set_seed
from peft import PeftModel
sys.path.insert(0,str(ROOT/'training/eduai-local'))
from tokenizer_loader import load_tokenizer
from model_loader import load_native_model
if not torch.cuda.is_available():
    raise RuntimeError('GPU no disponible: no iniciar entrenamiento en CPU')
set_seed(42)
PROFILE = globals().get('EDUAI_RUN_PROFILE','eduai-lite')
MAX_STEPS = globals().get('EDUAI_MAX_STEPS',24)
profile = json.loads((ROOT/'training/eduai-local/profiles.json').read_text())[PROFILE]
MODEL = profile['baseModel']
REVISION = HfApi().model_info(MODEL).sha
OUT = ROOT / profile['output']
DATA = ROOT / 'training/eduai-local/run-train.jsonl'
CASES = ROOT / 'training/eduai-local/eval-cases.jsonl'
rows = [json.loads(x) for x in DATA.read_text().splitlines() if x.strip()]
cases = [json.loads(x) for x in CASES.read_text().splitlines() if x.strip()]
validation_path = ROOT / 'training/eduai-local/run-validation.jsonl'
validation = [json.loads(x) for x in validation_path.read_text().splitlines() if x.strip()] if validation_path.exists() else []
# Fail rather than leak the exact held-out prompts into training.
prompts = {c['prompt'].strip().casefold() for c in cases}
if any(m.get('content','').strip().casefold() in prompts for r in rows for m in r['messages'] if m['role']=='user'):
    raise RuntimeError('Contaminación de evaluación')
spec = importlib.util.spec_from_file_location('eduai_evaluate', ROOT / 'training/eduai-local/evaluate_openai_compatible.py')
evaluator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluator)
quant = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type='nf4', bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.float16)
tokenizer = load_tokenizer(MODEL,REVISION)

def evaluate(adapter=None):
    model = load_native_model(MODEL,REVISION,quantization_config=quant,device_map={'':0})
    if adapter: model = PeftModel.from_pretrained(model, str(adapter))
    model.eval()
    results = []
    for case in cases:
        messages = [{'role':'system','content':case['system']},{'role':'user','content':case['prompt']}]
        inputs = tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=True, return_tensors='pt').to('cuda')
        started = time.time()
        with torch.inference_mode():
            output = model.generate(inputs, attention_mask=torch.ones_like(inputs), max_new_tokens=192, do_sample=False, pad_token_id=tokenizer.eos_token_id)
        text = tokenizer.decode(output[0,inputs.shape[-1]:], skip_special_tokens=True)
        passed, failures = evaluator.evaluate_checks(text,case['checks'])
        results.append({'id':case['id'],'critical':case['critical'],'passed':passed,'failures':failures,'text':text,'seconds':round(time.time()-started,2)})
        print('EVAL', 'adapter' if adapter else 'base',case['id'],passed,flush=True)
    validation_losses = []
    from assistant_labels import build_assistant_only_labels
    for row in validation[:50]:
        ids = tokenizer.apply_chat_template(row['messages'],tokenize=True,add_generation_prompt=False)
        labels = build_assistant_only_labels(tokenizer,row['messages'],ids)
        if len(ids)>1024 or not any(label!=-100 for label in labels): continue
        with torch.inference_mode():
            loss = model(input_ids=torch.tensor([ids],device='cuda'),labels=torch.tensor([labels],device='cuda')).loss.item()
        validation_losses.append(loss)
    del model
    import gc
    gc.collect(); torch.cuda.empty_cache()
    return {'score':round(100*sum(r['passed'] for r in results)/len(results),2),'criticalFailures':sum(r['critical'] and not r['passed'] for r in results),'results':results,'validationExamples':len(validation_losses),'validationLoss':sum(validation_losses)/len(validation_losses) if validation_losses else None}

baseline = evaluate()
(ROOT/'baseline-evaluation.json').write_text(json.dumps(baseline,ensure_ascii=False,indent=2))
# One process per phase releases CUDA state and keeps dependency setup separate.
subprocess.run([sys.executable, 'training/eduai-local/train_lora.py', '--profile',PROFILE,'--dataset',str(DATA),'--output',str(OUT),'--revision',REVISION,'--load-in-4bit','--batch-size','1','--grad-accum','4','--max-length','1024','--epochs','2','--max-steps',str(MAX_STEPS),'--learning-rate','0.0001'], check=True)
candidate = evaluate(OUT)
(ROOT/'candidate-evaluation.json').write_text(json.dumps(candidate,ensure_ascii=False,indent=2))
# Technical pilot is deliberately never promoted, even if the keyword checks pass.
report = {'status':'pilot_completed','productionReady':False,'promotion':'requires_reviewed_dataset_and_pedagogical_benchmark','profile':PROFILE,'model':MODEL,'revision':REVISION,'examples':len(rows),'datasetSha256':hashlib.sha256(DATA.read_bytes()).hexdigest(),'baselineScore':baseline['score'],'candidateScore':candidate['score'],'criticalFailures':candidate['criticalFailures'],'nonRegression':candidate['score']>=baseline['score'] and candidate['criticalFailures']<=baseline['criticalFailures'],'gpu':torch.cuda.get_device_name(0),'artifactFiles':[]}
for file in sorted(OUT.glob('*')):
    if file.is_file(): report['artifactFiles'].append({'name':file.name,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
(ROOT/'run-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report),flush=True)

# The bridge reader accepts report basenames; expose small reports at output root.
import shutil
for name in ['run-report.json','baseline-evaluation.json','candidate-evaluation.json']:
    shutil.copy2(ROOT/name,Path('/kaggle/working')/name)
