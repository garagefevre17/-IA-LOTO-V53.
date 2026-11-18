"""Deterministic, leakage-free rolling historical benchmark. Not prospective evidence."""
import argparse
import datetime as dt
import json
import random
from collections import Counter
from pathlib import Path
from forecast import load_draws


def benchmark(path, holdout=300, seed=20261118):
    draws, dates, digest = load_draws(path, dt.date.today() + dt.timedelta(days=2))
    if not 1 <= holdout <= len(dates)-300:
        raise ValueError('holdout must leave at least 300 prior draws')
    rng = random.Random(seed)
    hits = {'froids300': 0, 'random': 0}
    chance_hits = {'froids300': 0, 'random': 0}
    rows = []
    for i in range(len(dates)-holdout, len(dates)):
        train = dates[i-300:i]
        f = Counter(n for d in train for n in draws[d][0]); c = Counter(draws[d][1] for d in train)
        cold = sorted(sorted(range(1,50), key=lambda n:(f[n],n))[:5]); cold_c = min(range(1,11),key=lambda n:(c[n],n))
        random_grid = rng.sample(range(1,50),5); random_c = rng.randint(1,10)
        winning, winning_c = draws[dates[i]]
        row={'date':dates[i].isoformat(),'froids300_hits':len(set(cold)&set(winning)), 'random_hits':len(set(random_grid)&set(winning)), 'froids300_chance':int(cold_c==winning_c),'random_chance':int(random_c==winning_c)}
        rows.append(row)
        hits['froids300'] += row['froids300_hits']; hits['random'] += row['random_hits']
        chance_hits['froids300'] += row['froids300_chance'];chance_hits['random'] += row['random_chance']
    return {'kind':'historical_walk_forward_not_prospective','draws':holdout,'csv_sha256':digest,'seed':seed,'main_hits':hits,'chance_hits':chance_hits,'theoretical_main_hits':holdout*25/49,'theoretical_chance_hits':holdout/10,'per_draw':rows,'advantage_proven':False}

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--csv',default='loto_201911.csv');ap.add_argument('--holdout',type=int,default=300);ap.add_argument('--output',default='audit_backtest.json');args=ap.parse_args()
    result=benchmark(Path(args.csv),args.holdout)
    Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Historical test:',result['main_hits'],'chance:',result['chance_hits'],'theory:',result['theoretical_main_hits'])
