"""One private GPU launch for all three profiles and nine seed runs."""
from pathlib import Path
import argparse,json,hashlib,importlib.util
ROOT=Path(__file__).resolve().parents[3]
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--preflight',action='store_true');a=p.parse_args()
spec=importlib.util.spec_from_file_location('campaign_data',Path(__file__).with_name('dataset.py'));data=importlib.util.module_from_spec(spec);spec.loader.exec_module(data)
manifest=data.build(ROOT/'data/eduai-training/foundation-v1')
paths=['training/eduai-local/model_loader.py','training/eduai-local/tokenizer_loader.py','training/eduai-local/train_lora.py','training/eduai-local/assistant_labels.py','training/eduai-local/profiles.json','training/eduai-local/evaluate_openai_compatible.py','training/eduai-local/eval-cases.jsonl',
       'training/eduai-local/campaign/challenge_cases.py','training/eduai-local/campaign/dataset.py','training/eduai-local/campaign/campaign_metrics.py','training/eduai-local/campaign/config.json','training/eduai-local/campaign/blind_cases.json']
files={name:(ROOT/name).read_text() for name in paths}
prefix='from pathlib import Path\nimport json,os,sys,subprocess,hashlib,shutil\n'
prefix+='FILES=json.loads('+repr(json.dumps(files,ensure_ascii=False))+')\n'
prefix+='EXPECTED_DATASET_ID='+repr(manifest['datasetId'])+'\n'
if a.preflight:
 code=prefix+'''os.environ['USE_TF']='0'
os.environ['USE_FLAX']='0'
subprocess.run([sys.executable,'-m','pip','install','--quiet','transformers==4.57.2'],check=True)
base=Path('/kaggle/working/preflight')
for name,content in FILES.items():
    path=base/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(content)
sys.path.insert(0,str(base/'training/eduai-local'))
sys.path.insert(0,str(base/'training/eduai-local/campaign'))
from tokenizer_loader import load_tokenizer
from assistant_labels import build_assistant_only_labels
from transformers import AutoConfig
from huggingface_hub import HfApi
import dataset
rows=dataset.build_rows();profiles=json.loads(FILES['training/eduai-local/profiles.json']);report=[]
for profile,config in profiles.items():
    try:
        revision=HfApi().model_info(config['baseModel']).sha
        tokenizer=load_tokenizer(config['baseModel'],revision)
        lengths=[len(tokenizer.apply_chat_template(r['messages'],tokenize=True,add_generation_prompt=False)) for r in rows]
        for row in rows[:10]:
            ids=tokenizer.apply_chat_template(row['messages'],tokenize=True,add_generation_prompt=False)
            if not any(x!=-100 for x in build_assistant_only_labels(tokenizer,row['messages'],ids)): raise RuntimeError('No assistant labels')
        model_config=AutoConfig.from_pretrained(config['baseModel'],revision=revision,trust_remote_code=False)
        if max(lengths)>1536 or tokenizer.eos_token_id is None: raise RuntimeError('Invalid tokenizer budget')
        record={'profile':profile,'revision':revision,'maxTokens':max(lengths),'eos':tokenizer.eos_token_id,'architecture':model_config.model_type}
        if tokenizer.eos_token_id!=model_config.eos_token_id: raise RuntimeError('EOS differs from model checkpoint')
        report.append(record);print(json.dumps(record),flush=True)
    except Exception as error:
        record={'profile':profile,'error':type(error).__name__+': '+str(error)}
        report.append(record);print(json.dumps(record),flush=True)
Path('/kaggle/working/preflight-report.json').write_text(json.dumps(report,indent=2))
'''
else:
 prefix+='RUNNER='+repr(Path(__file__).with_name('runner.py').read_text())+'\n'
 code=prefix+'''base=Path('/kaggle/working/eduai-campaign')
runner=Path('/kaggle/working/campaign-entrypoint.py');runner.write_text(RUNNER)
profiles=json.loads(FILES['training/eduai-local/campaign/config.json'])['profiles']
status={'datasetId':EXPECTED_DATASET_ID,'profiles':[],'productionReady':False}
for profile in profiles:
    root=base/profile
    for name,content in FILES.items():
        file=root/name;file.parent.mkdir(parents=True,exist_ok=True);file.write_text(content)
    environment={**os.environ,'EDUAI_CAMPAIGN_PROFILE':profile,'EDUAI_DATASET_ID':EXPECTED_DATASET_ID}
    print('MATRIX_START',profile,flush=True)
    process=subprocess.run([sys.executable,str(runner)],env=environment)
    report=Path('/kaggle/working')/profile/'campaign-report.json'
    if report.exists():
        summary=json.loads(report.read_text())
        if process.returncode and summary['status']=='running':
            summary['status']='failed';summary['exitCode']=process.returncode;report.write_text(json.dumps(summary,indent=2))
        shutil.copy2(report,Path('/kaggle/working')/('report-'+profile+'.json'))
    else:summary={'status':'failed_before_report','productionReady':False}
    status['profiles'].append({'profile':profile,'exitCode':process.returncode,'status':summary['status']})
    Path('/kaggle/working/matrix-report.json').write_text(json.dumps(status,indent=2))
    print('MATRIX_END',profile,process.returncode,flush=True)
print(json.dumps(status),flush=True)
'''
Path(a.output).write_text(code)
print(json.dumps({'bytes':len(code.encode()),'sha256':hashlib.sha256(code.encode()).hexdigest(),'preflight':a.preflight}))
