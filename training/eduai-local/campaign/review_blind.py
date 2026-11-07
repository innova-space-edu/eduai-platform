"""Aggregate completed blind rubrics. Never invents human scores or promotes models."""
import argparse,csv,json,statistics
from pathlib import Path
CRITERIA=['exactitud','alineacion_objetivo','pertinencia_nivel','detalle_aplicable','evaluacion_alineada','seguridad']

def aggregate(pairs,key,scores):
    cases={p['pairId']:p for p in pairs};mapping={k['pairId']:k for k in key}
    if set(cases)!=set(mapping): raise ValueError('Blind key does not match cases')
    grouped={pid:[] for pid in cases};seen=set()
    for row in scores:
        pid=row['pairId'];reviewer=row['reviewer'].strip()
        if pid not in cases or not reviewer or (pid,reviewer) in seen: raise ValueError('Invalid/duplicate reviewer row')
        seen.add((pid,reviewer));normalized={'reviewer':reviewer}
        for side in ['A','B']:
            values=[int(row[side+'_'+c]) for c in CRITERIA]
            if any(v<1 or v>5 for v in values): raise ValueError('Rubric out of range')
            critical=int(row['critical_'+side])
            if critical not in [0,1]: raise ValueError('Critical flag must be 0/1')
            normalized[side]=statistics.mean(values);normalized['critical_'+side]=critical
        grouped[pid].append(normalized)
    if any(len(values)<2 for values in grouped.values()): raise ValueError('Two independent reviewers required for every pair')
    results=[]
    for pid,values in grouped.items():
        trained=mapping[pid]['trainedSide'];base='B' if trained=='A' else 'A'
        results.append({'pairId':pid,'caseId':cases[pid]['caseId'],'withProvidedContext':cases[pid]['withProvidedContext'],
                        'trainedMean':statistics.mean(v[trained] for v in values),'baselineMean':statistics.mean(v[base] for v in values),
                        'trainedCriticalFlags':sum(v['critical_'+trained] for v in values),'reviewers':len(values)})
    return {'status':'reviewed','productionReady':False,'pairs':results,'trainedMean':statistics.mean(v['trainedMean'] for v in results),
            'baselineMean':statistics.mean(v['baselineMean'] for v in results),'trainedCriticalFlags':sum(v['trainedCriticalFlags'] for v in results),
            'note':'Scores are human judgments on a small sample; combine with automatic tests, hardware benchmark and explicit approval.'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--pairs',required=True);p.add_argument('--key');p.add_argument('--scores');p.add_argument('--output',required=True);a=p.parse_args()
    pairs=json.loads(Path(a.pairs).read_text())
    if not a.scores:
        with Path(a.output).open('w',newline='') as f:
            columns=['pairId','reviewer']+[side+'_'+c for side in ['A','B'] for c in CRITERIA]+['critical_A','critical_B']
            writer=csv.DictWriter(f,fieldnames=columns);writer.writeheader()
            for pair in pairs:
                for reviewer in ['docente_1','docente_2']:writer.writerow({'pairId':pair['pairId'],'reviewer':reviewer})
    else:
        if not a.key: raise ValueError('Admin-only key required after blind scores are locked')
        report=aggregate(pairs,json.loads(Path(a.key).read_text()),list(csv.DictReader(Path(a.scores).open())))
        Path(a.output).write_text(json.dumps(report,ensure_ascii=False,indent=2))
