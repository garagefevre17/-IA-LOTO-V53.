"""Exact null probabilities for independent, uniformly random LOTO tickets.

Under the fair-draw null, overlap of two 5-number sets drawn from 49
has a hypergeometric distribution. This measures evidence, not prediction.
"""
from math import comb, fsum


def main_hit_distribution(draws):
    if type(draws) is not int or draws < 0:
        raise ValueError('draws must be a nonnegative integer')
    base = [comb(5, k) * comb(44, 5-k) / comb(49, 5) for k in range(6)]
    # Truncated polynomial convolution, with mass conservation per iteration.
    probs = [1.0]
    for _ in range(draws):
        nxt = [0.0] * (len(probs) + 5)
        for i, p in enumerate(probs):
            if p:
                for k, q in enumerate(base):
                    nxt[i+k] += p*q
        probs = nxt
    return probs


def exact_main_upper_tail(draws, hits):
    if type(draws) is not int or draws < 0 or type(hits) is not int or hits < 0:
        raise ValueError('draws/hits must be nonnegative integers')
    if hits > 5*draws:
        return 0.0
    return min(1.0, max(0.0, fsum(main_hit_distribution(draws)[hits:])))


def exact_chance_upper_tail(draws, hits):
    if type(draws) is not int or draws < 0 or type(hits) is not int or hits < 0:
        raise ValueError('invalid draws/hits')
    if hits > draws:
        return 0.0
    return min(1.0, fsum(comb(draws,k)*(.1**k)*(.9**(draws-k)) for k in range(hits,draws+1)))
