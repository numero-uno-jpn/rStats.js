"""Reference values for the exact Ansari-Bradley distribution (src/htest/core/ansari.ts; see _common.py).

Counts of m-subsets of the ranks with each score sum, in exact integer arithmetic (checked against brute-force
enumeration for small samples).
"""
import sys, os, random, itertools
from fractions import Fraction
from math import comb
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import write_fixture


def counts(m, n):
    N = m + n
    scores = [min(i, N + 1 - i) for i in range(1, N + 1)]
    # c[r][s] = number of r-subsets of the positions seen so far with score sum s
    c = [dict() for _ in range(m + 1)]
    c[0][0] = 1
    for a in scores:
        for r in range(m - 1, -1, -1):
            for s, v in list(c[r].items()):
                c[r + 1][s + a] = c[r + 1].get(s + a, 0) + v
    return c[m]


def brute(m, n):
    N = m + n
    scores = [min(i, N + 1 - i) for i in range(1, N + 1)]
    out = {}
    for sub in itertools.combinations(range(N), m):
        s = sum(scores[i] for i in sub)
        out[s] = out.get(s, 0) + 1
    return out


if __name__ == "__main__":
    mp.mp.dps = 50
    for m in range(1, 7):
        for n in range(1, 7):
            assert counts(m, n) == brute(m, n)
    print("counting agrees with brute force")
    rng = random.Random(20261024)
    sizes = [(1, 1), (1, 4), (2, 3), (5, 5), (4, 9), (10, 10), (12, 20), (25, 25), (30, 47), (50, 50), (13, 87)]
    sizes += [(rng.randint(1, 60), rng.randint(1, 60)) for _ in range(15)]
    dcases, pcases, qcases = [], [], []
    for m, n in sizes:
        c = counts(m, n)
        total = comb(m + n, m)
        vals = sorted(c)
        cum = 0
        cdf = {}
        for v in vals:
            cum += c[v]
            cdf[v] = cum
        lo, hi = vals[0], vals[-1]
        picks = sorted(set([lo, hi, lo - 1, hi + 1, (lo + hi) // 2] + [rng.randint(lo, hi) for _ in range(6)]))
        for q in picks:
            le = Fraction(sum(c[v] for v in vals if v <= q), total)
            dv = Fraction(c.get(q, 0), total)
            dcases.append(({"x": q, "m": m, "n": n}, mp.mpf(dv.numerator) / dv.denominator, None))
            for lower in (True, False):
                v = le if lower else 1 - le
                pcases.append(({"q": q, "m": m, "n": n, "lowerTail": lower}, mp.mpf(v.numerator) / v.denominator, None))
        for p in [0, 1e-10, 0.001, 0.025, 0.5, 0.975, 0.999, 1] + [rng.random() for _ in range(4)]:
            P = Fraction(p)
            q = next(v for v in vals if Fraction(cdf[v], total) >= P)
            qcases.append(({"p": p, "m": m, "n": n}, q, None))
    write_fixture("dansari_exact", dcases)
    write_fixture("pansari_exact", pcases)
    write_fixture("qansari_exact", qcases)
