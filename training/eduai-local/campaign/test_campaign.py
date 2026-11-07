import importlib.util,json,tempfile,sys
from pathlib import Path
ROOT=Path(__file__).parent
sys.path.insert(0,str(ROOT))
import dataset
from campaign_metrics import paired_comparison
splits=dataset.partition(dataset.build_rows())
assert {k:len(v) for k,v in splits.items()}=={'train':1400,'validation':300,'test':300}
assert all(dataset.grade(r['messages'][-1]['content'],r['expected']) for values in splits.values() for r in values)
assert not dataset.grade('RESULTADO: 1.5\nPROCEDIMIENTO: 2 - 1 = 1',{'kind':'arithmetic_text','result':1,'proof':'2 - 1 = 1'})
assert not dataset.grade('{"resultado":true}',{'kind':'json','value':{'resultado':1}})
assert dataset.grade('RESULTADO: 10\nPROCEDIMIENTO: 2 × 5 = 10',{'kind':'arithmetic_text','result':10,'proof':'2 * 5 = 10'})
bad={k:list(v) for k,v in splits.items()};bad['test'].append(bad['train'][0])
try:dataset.validate(bad);raise AssertionError('Leakage was not detected')
except ValueError:pass
base=[{'id':str(i),'family':str(i//2),'category':'synthetic','correlationGroup':str(i//2),'passed':False} for i in range(20)]
after=[{**r,'passed':True} for r in base]
stats=paired_comparison(base,after)
assert stats['gain95CI']==[100,100] and stats['correlationClusters']==10
with tempfile.TemporaryDirectory() as directory:
    one=dataset.build(directory);two=dataset.build(directory);assert one==two
print('Campaign: 2000 verified references, 100 disjoint families, exact 70/15/15, typed oracles, leakage guards, reproducible hashes and paired cluster statistics passed')

from review_blind import aggregate
pair=[{'pairId':'p','caseId':'c','withProvidedContext':True}]
key=[{'pairId':'p','trainedSide':'A'}]
try:aggregate(pair,key,[]);raise AssertionError('Missing human reviews accepted')
except ValueError:pass

# Native model config normalization can be tested without downloading weights.
import types
sys.path.insert(0,str(ROOT.parent))
import model_loader
config=types.SimpleNamespace(model_type='lfm2',rope_parameters={'rope_type':'default','rope_theta':1000000},rope_theta=10000)
class FakeConfig:
    @staticmethod
    def from_pretrained(*a,**kw):return config
class FakeModel:
    @staticmethod
    def from_pretrained(*a,**kw):
        assert kw['config'].rope_theta==1000000 and kw['trust_remote_code'] is False
        return object(),{'missing_keys':[],'unexpected_keys':[],'mismatched_keys':[]}
sys.modules['transformers']=types.SimpleNamespace(AutoConfig=FakeConfig,AutoModelForCausalLM=FakeModel)
assert model_loader.load_native_model('test','revision') is not None
print('Native model loader: checkpoint RoPE preservation passed')
from challenge_cases import cases
assert all(dataset.grade(r['messages'][-1]['content'],r['expected']) for r in cases())
assert not {r['messages'][1]['content'] for r in cases()} & {r['messages'][1]['content'] for values in splits.values() for r in values}
