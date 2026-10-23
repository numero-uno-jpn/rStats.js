"""Reference values for the exact Mantel-Haenszel distribution (src/htest/core/mantelhaen.ts; see _common.py).

The distribution of S, the sum of the (1, 1) cells of K 2 x 2 tables with fixed margins, in exact rational
arithmetic (convolution of hypergeometric probabilities, reweighted by a rational odds ratio psi), and the exact
conditional MLE and confidence limits (roots found with mpmath at 50 digits; the implementation reproduces R's
uniroot-based values, which differ from the exact roots by up to about 1e-4).
"""
import sys, os, random
from fractions import Fraction
from math import comb
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import write_fixture


def dist(strata):
    probs = {0: Fraction(1)}
    for (a, b), (c, d) in strata:
        m, n, k = a + c, b + d, a + b
        lo, hi = max(0, k - n), min(k, m)
        p = {x: Fraction(comb(m, x) * comb(n, k - x), comb(m + n, k)) for x in range(lo, hi + 1)}
        q = {}
        for s, v in probs.items():
            for x, w in p.items():
                q[s + x] = q.get(s + x, 0) + v * w
        probs = q
    return probs


def weighted(probs, psi):
    w = {s: v * psi ** s for s, v in probs.items()}
    tot = sum(w.values())
    return {s: v / tot for s, v in w.items()}


def to_mp(f):
    return mp.mpf(f.numerator) / f.denominator


if __name__ == "__main__":
    mp.mp.dps = 50
    rng = random.Random(20261024)
    dcases, ccases, mcases, ecases = [], [], [], []
    for t in range(40):
        K = rng.randint(1, 6)
        big = rng.random() < 0.3
        strata = []
        for _ in range(K):
            cells = [rng.randint(0, 60 if big else 12) for _ in range(4)]
            strata.append(((cells[0], cells[1]), (cells[2], cells[3])))
        probs = dist(strata)
        lo, hi = min(probs), max(probs)
        s_obs = sum(st[0][0] for st in strata)
        flat = [v for st in strata for row in st for v in row]
        for psi in [Fraction(1), Fraction(1, 3), Fraction(5, 2), Fraction(1, 100), Fraction(40)]:
            d = weighted(probs, psi)
            for s in sorted(set([lo, hi, s_obs, (lo + hi) // 2, rng.randint(lo, hi)])):
                dcases.append(({"strata": flat, "s": s, "psi": float(psi)}, to_mp(d.get(s, Fraction(0))), None))
                le = sum(v for k, v in d.items() if k <= s)
                ge = sum(v for k, v in d.items() if k >= s)
                ccases.append(({"strata": flat, "s": s, "psi": float(psi), "upper": False}, to_mp(le), None))
                ccases.append(({"strata": flat, "s": s, "psi": float(psi), "upper": True}, to_mp(ge), None))
            mean = sum(k * v for k, v in d.items())
            mcases.append(({"strata": flat, "psi": float(psi)}, to_mp(mean), None))
        # exact conditional MLE and 95% limits (for the loose check)
        if lo < s_obs < hi:
            P = {s: to_mp(v) for s, v in probs.items()}

            def mean_at(lp):
                psi = mp.exp(lp)
                w = {s: v * psi ** s for s, v in P.items()}
                tot = mp.fsum(w.values())
                return mp.fsum(s * v for s, v in w.items()) / tot

            def tail_at(lp, upper):
                psi = mp.exp(lp)
                w = {s: v * psi ** s for s, v in P.items()}
                tot = mp.fsum(w.values())
                return mp.fsum(v for s, v in w.items() if (s >= s_obs if upper else s <= s_obs)) / tot
            def bisect(f, a=-200, b=200):
                # f increasing in log psi on [a, b]
                fa = f(mp.mpf(a))
                lo_, hi_ = mp.mpf(a), mp.mpf(b)
                for _ in range(400):
                    mid = (lo_ + hi_) / 2
                    if (f(mid) > 0) == (fa > 0):
                        lo_ = mid
                    else:
                        hi_ = mid
                return mp.exp((lo_ + hi_) / 2)
            mle = bisect(lambda lp: mean_at(lp) - s_obs)
            up = bisect(lambda lp: mp.mpf("0.025") - tail_at(lp, False))
            low = bisect(lambda lp: tail_at(lp, True) - mp.mpf("0.025"))
            ecases.append(({"strata": flat, "what": "mle"}, mle, None))
            ecases.append(({"strata": flat, "what": "upper"}, up, None))
            ecases.append(({"strata": flat, "what": "lower"}, low, None))
    write_fixture("mh_density", dcases)
    write_fixture("mh_cdf", ccases)
    write_fixture("mh_mean", mcases)
    write_fixture("mh_estimates", ecases)
