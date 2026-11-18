"""Reproducible historical null comparison; not evidence of future predictive power."""
import argparse
import json
import random
from pathlib import Path
from benchmark import benchmark
from exact_stats import exact_main_upper_tail, exact_chance_upper_tail


def assess(csv_path, holdout=300, simulations=2000, seed=20261118):
    if not 100 <= simulations <= 100000:
        raise ValueError('simulations must be between 100 and 100000')
    result = benchmark(csv_path, holdout=holdout, seed=seed)
    # For each actual winning draw, a uniformly random 5-number ticket has
    # a hypergeometric intersection distribution, regardless of its numbers.
    # Chance is an independent uniform 1-in-10 event.
    rng = random.Random(seed + 1)
    null_main, null_chance = [], []
    for _ in range(simulations):
        total = 0
        c_total = 0
        for _draw in range(holdout):
            total += sum(x < 5 for x in rng.sample(range(49), 5))
            c_total += (rng.randrange(10) == 0)
        null_main.append(total)
        null_chance.append(c_total)
    null_main.sort(); null_chance.sort()
    observed = result['main_hits']['froids300']
    observed_chance = result['chance_hits']['froids300']
    return {
        'kind': 'historical_monte_carlo_null_comparison_not_prospective',
        'csv_sha256': result['csv_sha256'], 'draws': holdout,
        'simulations': simulations, 'seed': seed,
        'froids300_main_hits': observed,
        'main_exact_one_sided_p_greater_or_equal': exact_main_upper_tail(holdout, observed),
        'random_main_expected': result['theoretical_main_hits'],
        'random_main_95pct_interval': [null_main[int(.025*simulations)], null_main[min(simulations-1,int(.975*simulations))]],
        'main_one_sided_p_greater_or_equal': (1 + sum(x >= observed for x in null_main))/(simulations+1),
        'froids300_chance_hits': observed_chance,
        'chance_exact_one_sided_p_greater_or_equal': exact_chance_upper_tail(holdout, observed_chance),
        'random_chance_expected': result['theoretical_chance_hits'],
        'random_chance_95pct_interval': [null_chance[int(.025*simulations)],null_chance[min(simulations-1,int(.975*simulations))]],
        'chance_one_sided_p_greater_or_equal': (1 + sum(x >= observed_chance for x in null_chance))/(simulations+1),
        'caveat': 'Historical comparison only. No independent prospective proof, no correction for model selection or repeated testing, no demonstrated predictive edge.'
    }

if __name__ == '__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--csv',default='loto_201911.csv')
    ap.add_argument('--holdout',type=int,default=300)
    ap.add_argument('--simulations',type=int,default=2000)
    ap.add_argument('--output',default='audit_robustesse.json')
    args=ap.parse_args()
    data=assess(Path(args.csv),args.holdout,args.simulations)
    Path(args.output).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in data.items() if k not in ('csv_sha256','caveat')},ensure_ascii=False))
