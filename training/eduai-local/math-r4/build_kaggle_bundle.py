"""Build a single-file script for the EXISTING Kaggle notebook (no new slug)."""
from __future__ import annotations
import argparse, json, pathlib, re

def bundle(where: pathlib.Path):
    root=pathlib.Path(__file__).resolve().parent
    generator=(root/"generate.py").read_text(encoding="utf-8")
    trainer=(root/"train_kaggle.py").read_text(encoding="utf-8")
    generator=generator.split('if __name__=="__main__":')[0]
    generator=generator.replace("from __future__ import annotations","")
    trainer=trainer.replace("from __future__ import annotations","")
    trainer=trainer.replace("from generate import generate, save, TRAIN_SEEDS, TEST_SEEDS","")
    code=("from __future__ import annotations\n"
          "# Single-file EDUAI R4. Data generator and trainer are bundled offline.\n"
          +generator+"\n"+trainer)
    compile(code,str(where/"main.py"),"exec")
    where.mkdir(parents=True,exist_ok=True)
    (where/"main.py").write_text(code,encoding="utf-8")
    metadata={
        "id":"esthefano/eduai-nano-lite-refuerzo-corto-v4",
        "title":"EDUAI Nano Lite Refuerzo Corto V4",
        "code_file":"main.py",
        "language":"python",
        "kernel_type":"script",
        "is_private":True,
        "enable_gpu":True,
        "enable_internet":True,
        "accelerator":"NvidiaTeslaT4",
        "dataset_sources":["esthefano/eduai-nano-lite-adapters-r2"],
        "kernel_sources":[],
        "competition_sources":[],
        "model_sources":[]
    }
    (where/"kernel-metadata.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding="utf-8")
    print("READY_SAME_NOTEBOOK",metadata["id"],"bytes",len(code.encode()))

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--out",type=pathlib.Path,required=True)
    args=p.parse_args()
    bundle(args.out)
