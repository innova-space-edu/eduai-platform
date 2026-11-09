"""CPU-only regression for the Kaggle R5 TrainingArguments compatibility issue."""
import inspect
import pathlib
import sys
import unittest

sys.path.insert(0,str(pathlib.Path(__file__).parent))
from train_kaggle import args

BASE={
  "output_dir", "max_steps", "num_train_epochs",
  "per_device_train_batch_size", "per_device_eval_batch_size",
  "gradient_accumulation_steps", "learning_rate", "lr_scheduler_type",
  "fp16","bf16","logging_steps","save_strategy","report_to","seed",
  "data_seed","dataloader_num_workers","remove_unused_columns",
  "optim","gradient_checkpointing","max_grad_norm",
}
class AcceptArgs:
    def __init__(self,**kwargs):
        self.kwargs=kwargs
        for k,v in kwargs.items():
            setattr(self,k,v)
    @classmethod
    def variant(cls,version):
        allowed=set(BASE)
        allowed.update({"eval_strategy","train_sampling_strategy","warmup_steps"}
                       if version=="v5" else
                       {"evaluation_strategy","group_by_length","warmup_ratio"})
        parameters=[inspect.Parameter(n,inspect.Parameter.KEYWORD_ONLY,default=None)
                    for n in sorted(allowed)]
        class Probe(AcceptArgs):
            __signature__=inspect.Signature(parameters)
        return Probe

PROFILE={"lr":1.0e-5}
class TrainingArgumentsCompatibility(unittest.TestCase):
    def test_transformers_5_20_2(self):
        result=args(AcceptArgs.variant("v5"),PROFILE,pathlib.Path("/tmp/preflight"),41011,1,2.0)
        self.assertEqual(result.kwargs["warmup_steps"],0.06)
        self.assertNotIn("warmup_ratio",result.kwargs)
        self.assertEqual(result.kwargs["train_sampling_strategy"],"group_by_length")
        self.assertEqual(result.kwargs["eval_strategy"],"no")
        self.assertEqual(result.kwargs["num_train_epochs"],2.0)
    def test_legacy_version_is_still_compatible(self):
        result=args(AcceptArgs.variant("v4"),PROFILE,pathlib.Path("/tmp/preflight"),41011,1,2.0)
        self.assertEqual(result.kwargs["warmup_ratio"],0.06)
        self.assertEqual(result.kwargs["evaluation_strategy"],"no")
        self.assertTrue(result.kwargs["group_by_length"])
    def test_no_supported_warmup_fails_before_training(self):
        class Bad:
            __signature__=inspect.Signature([])
        with self.assertRaisesRegex(RuntimeError,"UNSUPPORTED_WARMUP_ARGS"):
            args(Bad,PROFILE,pathlib.Path("/tmp/preflight"),41011,1,2.0)

if __name__=="__main__":
    unittest.main()
