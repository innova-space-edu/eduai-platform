"""Compare recorded campaigns without selecting hyperparameters on test results."""
import argparse,json,statistics
from pathlib import Path

def compare(reports):
    rows=[]
    for report in reports:
        seeds=report.get('seeds',[])
        row={'profile':report['profile'],'status':report['status'],'seedsCompleted':len(seeds),'productionReady':False,'humanReview':report.get('humanReview','pending')}
        if seeds:
            row.update(baselineMacro=report['baseline']['macroAccuracy'],trainedMacroMean=statistics.mean(s['summary']['macroAccuracy'] for s in seeds),
                       gainMean=statistics.mean(s['comparison']['macroGainPoints'] for s in seeds),
                       gainRange=[min(s['comparison']['macroGainPoints'] for s in seeds),max(s['comparison']['macroGainPoints'] for s in seeds)],
                       criticalFailures=[s['criticalFailures'] for s in seeds],
                       statisticallyPositiveSeeds=sum(s['comparison']['gain95CI'][0]>0 for s in seeds))
        rows.append(row)
    return {'profiles':rows,'automaticPromotion':False,'note':'Foundation scores are not a certification of pedagogical quality; human and target-hardware review remain required.'}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('reports',nargs='+');p.add_argument('--output',required=True);a=p.parse_args()
    Path(a.output).write_text(json.dumps(compare([json.loads(Path(path).read_text()) for path in a.reports]),ensure_ascii=False,indent=2))
