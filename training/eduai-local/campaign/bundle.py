"""Emit one self-contained Kaggle script. Data is built on Kaggle, not downloaded."""
from pathlib import Path
import argparse,importlib.util,json,hashlib
ROOT=Path(__file__).resolve().parents[3]
p=argparse.ArgumentParser();p.add_argument('--profile',required=True,choices=['eduai-nano','eduai-lite','eduai-performance']);p.add_argument('--output',required=True);a=p.parse_args()
spec=importlib.util.spec_from_file_location('campaign_data',Path(__file__).with_name('dataset.py'));data=importlib.util.module_from_spec(spec);spec.loader.exec_module(data)
manifest=data.build(ROOT/'data/eduai-training/foundation-v1')
paths=['training/eduai-local/model_loader.py','training/eduai-local/tokenizer_loader.py','training/eduai-local/train_lora.py','training/eduai-local/assistant_labels.py','training/eduai-local/profiles.json','training/eduai-local/evaluate_openai_compatible.py','training/eduai-local/eval-cases.jsonl',
       'training/eduai-local/campaign/challenge_cases.py','training/eduai-local/campaign/dataset.py','training/eduai-local/campaign/campaign_metrics.py','training/eduai-local/campaign/config.json','training/eduai-local/campaign/blind_cases.json']
files={name:(ROOT/name).read_text() for name in paths}
prefix='from pathlib import Path\nimport json\nROOT=Path("/kaggle/working/eduai-campaign")\n'
prefix+='ROOT=ROOT/'+repr(a.profile)+'\n'
prefix+='CAMPAIGN_PROFILE='+repr(a.profile)+'\nEXPECTED_DATASET_ID='+repr(manifest['datasetId'])+'\n'
prefix+='FILES=json.loads('+repr(json.dumps(files,ensure_ascii=False))+')\n'
prefix+='for name,content in FILES.items():\n    path=ROOT/name\n    path.parent.mkdir(parents=True,exist_ok=True)\n    path.write_text(content,encoding="utf-8")\n'
code=prefix+Path(__file__).with_name('runner.py').read_text()
Path(a.output).write_text(code)
print(json.dumps({'profile':a.profile,'datasetId':manifest['datasetId'],'scriptSha256':hashlib.sha256(code.encode()).hexdigest(),'bytes':len(code.encode()),'output':a.output}))
