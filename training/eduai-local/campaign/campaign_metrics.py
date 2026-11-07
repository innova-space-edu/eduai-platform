"""Paired, task-clustered reporting. Never treats template variants as independent."""
from collections import defaultdict
import random,statistics

def summarize(results):
    categories=defaultdict(list)
    for r in results: categories[r['category']].append(int(r['passed']))
    scores={name:100*sum(values)/len(values) for name,values in categories.items()}
    times=sorted(r['seconds'] for r in results)
    return {'count':len(results),'microAccuracy':100*sum(r['passed'] for r in results)/len(results),
            'macroAccuracy':statistics.mean(scores.values()),'categories':scores,
            'latencyMedianSeconds':statistics.median(times),'latencyP95Seconds':times[min(len(times)-1,int(len(times)*.95))],
            'generatedTokens':sum(r['tokens'] for r in results),'generationSeconds':sum(times)}

def paired_comparison(baseline,candidate,repeats=2000):
    base={r['id']:r for r in baseline}
    if set(base)!={r['id'] for r in candidate}: raise ValueError('Unpaired results')
    families=defaultdict(list)
    for r in candidate:
        if r['family']!=base[r['id']]['family']: raise ValueError('Mismatched family')
        families[r.get('correlationGroup',r['category'] if r['category']!='transfer_math' else r['family'])].append(int(r['passed'])-int(base[r['id']]['passed']))
    deltas=[sum(v)/len(v) for _,v in sorted(families.items())]
    rng=random.Random(9182)
    samples=sorted(100*statistics.mean(rng.choices(deltas,k=len(deltas))) for _ in range(repeats))
    return {'pairedCases':len(candidate),'correlationClusters':len(deltas),
            'macroGainPoints':100*statistics.mean(deltas),'gain95CI':[samples[int(repeats*.025)],samples[min(repeats-1,int(repeats*.975))]],
            'method':'paired_task_cluster_bootstrap_conservative','bootstrapRepeats':repeats}
