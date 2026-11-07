"""Private Kaggle campaign: one profile, three preregistered seeds, no promotion."""
from pathlib import Path
import os,sys,json,hashlib,time,subprocess,shutil,gc,random
os.environ.update(CUDA_VISIBLE_DEVICES='0',TOKENIZERS_PARALLELISM='false',WANDB_DISABLED='true',USE_TF='0',USE_FLAX='0')
PROFILE=os.environ.get('EDUAI_CAMPAIGN_PROFILE',globals().get('CAMPAIGN_PROFILE','eduai-lite'))
ROOT=Path('/kaggle/working/eduai-campaign')/PROFILE;ROOT.mkdir(parents=True,exist_ok=True);os.chdir(ROOT)
subprocess.run([sys.executable,'-m','pip','install','--quiet','transformers==4.57.2','peft==0.17.1','accelerate==1.11.0','datasets==4.3.0','bitsandbytes==0.48.2','safetensors==0.6.2'],check=True)
import torch
from huggingface_hub import HfApi
from transformers import AutoTokenizer,AutoModelForCausalLM,BitsAndBytesConfig,set_seed
from peft import PeftModel
sys.path.insert(0,str(ROOT/'training/eduai-local/campaign'))
sys.path.insert(0,str(ROOT/'training/eduai-local'))
import dataset as campaign_data
from campaign_metrics import paired_comparison,summarize
from challenge_cases import cases as transfer_cases
# Avoid colliding with the standard library statistics module already imported by Transformers.
from evaluate_openai_compatible import evaluate_checks
from tokenizer_loader import load_tokenizer
from model_loader import load_native_model
from assistant_labels import build_assistant_only_labels
if not torch.cuda.is_available(): raise RuntimeError('CUDA is required')
CONFIG=json.loads((ROOT/'training/eduai-local/campaign/config.json').read_text())
PROFILES=json.loads((ROOT/'training/eduai-local/profiles.json').read_text())
MODEL=PROFILES[PROFILE]['baseModel'];REVISION=CONFIG['revisions'][PROFILE]
OUTPUT=Path('/kaggle/working')/PROFILE;OUTPUT.mkdir(parents=True,exist_ok=True);DATA=ROOT/'dataset';manifest=campaign_data.build(DATA)
if manifest['datasetId']!=os.environ.get('EDUAI_DATASET_ID',globals().get('EXPECTED_DATASET_ID')): raise RuntimeError('Dataset fingerprint differs from the registered campaign')
START=time.monotonic();DEADLINE=START+CONFIG['maxMinutesPerProfile']*60

def check_budget():
    if time.monotonic()>DEADLINE: raise RuntimeError('Profile GPU budget exhausted')

def write(name,obj):
    (OUTPUT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def load_rows(name): return [json.loads(line) for line in (DATA/(name+'.jsonl')).read_text().splitlines() if line.strip()]
if hashlib.sha256(json.dumps(transfer_cases(),ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()!=CONFIG['transferCasesSha256']: raise RuntimeError('Transfer cases changed')
TEST=load_rows('test')+transfer_cases();TRAIN=load_rows('train');VALIDATION=load_rows('validation')
for name,rows in [('train',TRAIN),('validation',VALIDATION)]:
    (DATA/(name+'-messages.jsonl')).write_text(''.join(campaign_data.dumps({'messages':r['messages']})+'\n' for r in rows))
SAFETY=[json.loads(line) for line in (ROOT/'training/eduai-local/eval-cases.jsonl').read_text().splitlines() if line.strip()]
BLIND=json.loads((ROOT/'training/eduai-local/campaign/blind_cases.json').read_text())
TOKENIZER=load_tokenizer(MODEL,REVISION)
# Fail before any training rather than silently truncate source instructions.
lengths=[len(TOKENIZER.apply_chat_template(r['messages'],tokenize=True,add_generation_prompt=False)) for r in TRAIN+VALIDATION]
if max(lengths)>CONFIG['maxLength']: raise RuntimeError('Dataset exceeds fixed context budget: '+str(max(lengths)))
QUANT=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_use_double_quant=True,bnb_4bit_compute_dtype=torch.float16)

def load_model(adapter=None):
    model=load_native_model(MODEL,REVISION,quantization_config=QUANT,device_map={'':0})
    if adapter: model=PeftModel.from_pretrained(model,str(adapter))
    model.eval();return model

def release(model):
    del model
    gc.collect();torch.cuda.empty_cache()

def generate(model,messages,max_tokens):
    check_budget()
    ids=TOKENIZER.apply_chat_template(messages,tokenize=True,add_generation_prompt=True,return_tensors='pt').to('cuda')
    started=time.monotonic();torch.cuda.reset_peak_memory_stats()
    with torch.inference_mode():
        generated=model.generate(ids,attention_mask=torch.ones_like(ids),max_new_tokens=max_tokens,do_sample=False,pad_token_id=TOKENIZER.eos_token_id)
    seconds=time.monotonic()-started
    return TOKENIZER.decode(generated[0,ids.shape[-1]:],skip_special_tokens=True),len(generated[0])-ids.shape[-1],seconds,torch.cuda.max_memory_allocated()

def evaluate(adapter=None,label='base'):
    model=load_model(adapter);results=[];safety=[]
    for index,r in enumerate(TEST):
        # Both baseline and trained models get the same task-specific budget.
        budget=min(384,max(64,len(TOKENIZER.encode(r['messages'][-1]['content']))+48))
        text,tokens,seconds,memory=generate(model,r['messages'][:-1],budget)
        results.append({'id':r['id'],'family':r['family'],'category':r['category'],'passed':campaign_data.grade(text,r['expected']),'text':text,'tokens':int(tokens),'seconds':seconds,'peakAllocatedBytes':memory})
        if index%50==0: print('TEST',label,index,flush=True)
    for case in SAFETY:
        text,tokens,seconds,memory=generate(model,[{'role':'system','content':case['system']},{'role':'user','content':case['prompt']}],256)
        passed,failures=evaluate_checks(text,case['checks'])
        safety.append({'id':case['id'],'passed':passed,'critical':case['critical'],'failures':failures,'text':text})
    validation_losses=[]
    for row in VALIDATION:
        check_budget()
        ids=TOKENIZER.apply_chat_template(row['messages'],tokenize=True,add_generation_prompt=False)
        labels=build_assistant_only_labels(TOKENIZER,row['messages'],ids)
        with torch.inference_mode():
            loss=model(input_ids=torch.tensor([ids],device='cuda'),labels=torch.tensor([labels],device='cuda'),use_cache=False).loss.item()
        validation_losses.append(loss)
    result={'validationLossMeanByExample':sum(validation_losses)/len(validation_losses),'results':results,'summary':summarize(results),'safety':safety,'criticalFailures':sum(r['critical'] and not r['passed'] for r in safety)}
    write(label+'-evaluation.json',result)
    del model;gc.collect();torch.cuda.empty_cache()
    return result

def blind_outputs(adapter=None):
    model=load_model(adapter);outputs=[]
    for case in BLIND:
        for with_context in [False,True]:
            prompt=case['prompt']+' Nivel: '+case['level']
            if with_context: prompt+='\nContexto de referencia fijo:\n'+case['context']
            text,tokens,seconds,memory=generate(model,[{'role':'system','content':'Eres EDUAI, asistente pedagógico. No atribuyas códigos oficiales que no se hayan proporcionado.'},{'role':'user','content':prompt}],512)
            outputs.append({'caseId':case['id'],'withProvidedContext':with_context,'prompt':prompt,'text':text,'tokens':int(tokens),'seconds':seconds})
    del model;gc.collect();torch.cuda.empty_cache();return outputs

report={'campaign':CONFIG['id'],'profile':PROFILE,'status':'running','productionReady':False,'model':MODEL,'revision':REVISION,'dataset':manifest,'config':CONFIG,'seeds':[],
        'sourceSha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'training/eduai-local').rglob('*.py')},'runtime':{'torch':torch.__version__,'cuda':torch.version.cuda,'gpu':torch.cuda.get_device_name(0)},'humanReview':'pending','testUsedForSelection':False,'scope':'synthetic_foundation_not_full_pedagogy'}
write('campaign-report.json',report)
base=evaluate();report['baseline']=base['summary'];report['baselineValidationLoss']=base['validationLossMeanByExample'];report['baselineCriticalFailures']=base['criticalFailures'];write('campaign-report.json',report)
try:
    for seed in CONFIG['seeds']:
        check_budget();adapter=ROOT/f'adapter-{seed}'
        command=[sys.executable,'training/eduai-local/train_lora.py','--profile',PROFILE,'--dataset',str(DATA/'train-messages.jsonl'),'--validation-dataset',str(DATA/'validation-messages.jsonl'),
                 '--output',str(adapter),'--revision',REVISION,'--seed',str(seed),'--load-in-4bit','--batch-size',str(CONFIG['batchSize']),'--grad-accum',str(CONFIG['gradientAccumulation']),
                 '--max-length',str(CONFIG['maxLength']),'--strict-length','--epochs',str(CONFIG['epochs']),'--learning-rate',str(CONFIG['learningRate']),
                 '--eval-steps',str(CONFIG['evaluationSteps']),'--early-stopping-patience',str(CONFIG['earlyStoppingPatience'])]
        subprocess.run(command,check=True,timeout=max(1,int(DEADLINE-time.monotonic())))
        training=json.loads((adapter/'eduai-training-manifest.json').read_text())
        if training['initialTrainableSha256']==training['finalTrainableSha256']: raise RuntimeError('No trainable parameter change')
        # Final adapter is the validation-selected checkpoint; optimizer states are no longer needed.
        for checkpoint in adapter.glob('checkpoint-*'): shutil.rmtree(checkpoint)
        result=evaluate(adapter,'seed-'+str(seed))
        record={'seed':seed,'validationLoss':training['bestValidationLoss'],'parametersChanged':True,'training':training,'summary':result['summary'],
                'criticalFailures':result['criticalFailures'],'validationLossMeanByExample':result['validationLossMeanByExample'],'comparison':paired_comparison(base['results'],result['results'])}
        report['seeds'].append(record);write('campaign-report.json',report)
    # Selection is based EXCLUSIVELY on validation loss, not the final test scores above.
    best=min(report['seeds'],key=lambda r:r['validationLoss'])
    selected=ROOT/f"adapter-{best['seed']}"
    before=blind_outputs();after=blind_outputs(selected)
    pairs=[];key=[];rng=random.Random(63821)
    for b,a in zip(before,after):
        swap=rng.choice([False,True]);pair_id=hashlib.sha256((PROFILE+b['caseId']+str(b['withProvidedContext'])).encode()).hexdigest()[:12]
        pairs.append({'pairId':pair_id,'caseId':b['caseId'],'withProvidedContext':b['withProvidedContext'],'prompt':b['prompt'],'A':a['text'] if swap else b['text'],'B':b['text'] if swap else a['text'],
                      'rubric':['exactitud','alineacion_objetivo','pertinencia_nivel','detalle_aplicable','evaluacion_alineada','seguridad'],'scoreRange':[1,5]})
        key.append({'pairId':pair_id,'trainedSide':'A' if swap else 'B','profile':PROFILE,'seed':best['seed']})
    write('blind-review.json',pairs);write('blind-key-ADMIN-ONLY.json',key)
    artifact=OUTPUT/'selected-adapter';shutil.copytree(selected,artifact,dirs_exist_ok=True)
    report['selectedSeed']=best['seed'];report['selectionCriterion']='validation_loss_only';report['artifacts']=[]
    for file in sorted(artifact.glob('*')):
        if file.is_file(): report['artifacts'].append({'name':file.name,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
    report['repeatability']={'seedsCompleted':len(report['seeds']),'allMacroGainsPositive':all(r['comparison']['macroGainPoints']>0 for r in report['seeds']),
                            'allCriticalChecksPassed':all(r['criticalFailures']==0 for r in report['seeds'])}
    report['automaticEvidence']={'allSeedsAboveProfileThreshold':all(r['summary']['macroAccuracy']>=PROFILES[PROFILE]['evaluationThreshold'] for r in report['seeds']),
      'allSeedsPositiveClusterCI':all(r['comparison']['gain95CI'][0]>0 for r in report['seeds']),
      'categoryRegressions':[{ 'seed':r['seed'],'category':c,'changePoints':score-base['summary']['categories'][c]} for r in report['seeds'] for c,score in r['summary']['categories'].items() if score<base['summary']['categories'][c]-CONFIG['promotion']['regressionTolerancePoints']]}
    report['status']='completed';report['humanReview']='pending';report['productionReady']=False
    # Only selected weights are exported; reports preserve every seed's measurements.
    for seed in CONFIG['seeds']: shutil.rmtree(ROOT/f'adapter-{seed}')
except Exception as error:
    report['status']='failed';report['errorType']=type(error).__name__;report['error']=str(error)[:1000]
    write('campaign-report.json',report);raise
finally:
    report['durationSeconds']=time.monotonic()-START;write('campaign-report.json',report)
print(json.dumps({'status':report['status'],'profile':PROFILE,'productionReady':False,'selectedSeed':report.get('selectedSeed')}),flush=True)
