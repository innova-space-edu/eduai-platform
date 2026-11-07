"""Build a self-contained private Kaggle script without credentials or repo access."""
import argparse, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser()
p.add_argument('--output', required=True)
p.add_argument('--export', dest='dataset_export')
a = p.parse_args()
paths = ['train_lora.py','assistant_labels.py','profiles.json','eval-cases.jsonl','evaluate_openai_compatible.py']
files = {'training/eduai-local/'+name:(ROOT/'training/eduai-local'/name).read_text() for name in paths}
if a.dataset_export:
    bundle = json.loads(Path(a.dataset_export).read_text())
    if bundle.get('format') != 'eduai-training-v1' or not bundle.get('reviewedOnly'): raise ValueError('Se requiere exportación revisada')
    rows = bundle['train']
    validation = bundle.get('validation',[])
    if any(row['messages'][1]['content'].strip().casefold() in {r['messages'][1]['content'].strip().casefold() for r in rows} for row in validation): raise ValueError('Fuga entre entrenamiento y validación')
    files['training/eduai-local/run-validation.jsonl']=''.join(json.dumps(row,ensure_ascii=False)+'\n' for row in validation)
    if not rows: raise ValueError('No hay ejemplos de entrenamiento')
else:
    rows = [json.loads(x) for x in (ROOT/'training/eduai-local/example-instructions.jsonl').read_text().splitlines() if x.strip()]
files.setdefault('training/eduai-local/run-validation.jsonl','')
files['training/eduai-local/run-train.jsonl']=''.join(json.dumps(row,ensure_ascii=False)+'\n' for row in rows)
prefix = 'from pathlib import Path\nimport json\nROOT=Path("/kaggle/working/eduai")\n'
prefix += 'FILES=json.loads('+repr(json.dumps(files,ensure_ascii=False))+')\n'
prefix += 'for name,content in FILES.items():\n    file=ROOT/name\n    file.parent.mkdir(parents=True,exist_ok=True)\n    file.write_text(content,encoding="utf-8")\n'
Path(a.output).write_text(prefix+(ROOT/'training/eduai-local/kaggle_runner.py').read_text())
print(json.dumps({'output':a.output,'examples':len(rows),'credentialsIncluded':False}))
