"""References from SciPy for the simple hypothesis tests (binomTest, poissonTest, varTest, bartlettTest, mcnemarTest),
used until the R fixtures exist and alongside them afterwards. Writes test/fixtures/htest_<name>.scipy.json.

    python3 -I scripts/mpmath/htest_scipy.py

binomTest: scipy.stats.binomtest (p-value with the same 1e-7 relative slack; Clopper-Pearson interval).
poissonTest: one sample from the definition (sum of the Poisson probabilities no larger than the observed one, at 50
digits with mpmath) and gamma quantiles; two samples through scipy's binomtest.
varTest, bartlettTest, mcnemarTest: the formulas with scipy.stats distributions (bartlett: scipy.stats.bartlett).
"""
import json, math, os, random, sys
import mpmath as mp
import numpy as np
import scipy
from scipy import stats

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "test", "fixtures")
ALTS = ["two.sided", "less", "greater"]
SCIPY_ALT = {"two.sided": "two-sided", "less": "less", "greater": "greater"}


def s(v):
    return "%.17g" % float(v)


def write(name, cases):
    path = os.path.join(OUT, "htest_%s.scipy.json" % name)
    with open(path, "w") as f:
        json.dump({"function": name, "generator": "scipy %s" % scipy.__version__, "cases": cases}, f, indent=1)
    print("htest_%s: %d cases" % (name, len(cases)))


def binom(rng):
    cases = []
    for _ in range(300):
        n = int(10 ** rng.uniform(0, 3.5))
        p = rng.choice([0.5, rng.uniform(0, 1), 10 ** rng.uniform(-4, 0)])
        x = int(stats.binom.ppf(rng.uniform(0.001, 0.999), n, p)) if rng.random() < 0.8 else rng.randint(0, n)
        alt = rng.choice(ALTS)
        conf = rng.choice([0.95, 0.9, 0.99, rng.uniform(0.5, 0.999)])
        r = stats.binomtest(x, n, p, alternative=SCIPY_ALT[alt])
        ci = r.proportion_ci(confidence_level=conf, method="exact")
        cases.append({"args": {"x": x, "n": n, "p": s(p), "alternative": alt, "confLevel": s(conf)},
                      "expected": {"pValue": s(r.pvalue), "confInt": [s(ci.low), s(ci.high)]}})
    return cases


def pois_two_sided(x, m):
    with mp.workdps(50):
        m = mp.mpf(m)
        pmf = lambda k: mp.exp(k * mp.log(m) - m - mp.loggamma(k + 1)) if k > 0 else mp.exp(-m)
        d = pmf(x)
        if x == m:
            return mp.mpf(1)
        thr = d * (1 + mp.mpf(1e-7))
        total = mp.mpf(0)
        # every count whose probability is <= d (1 + 1e-7): sum over the support up to far beyond the mean
        hi = int(m + 40 * mp.sqrt(m) + 2 * x + 100)
        for k in range(0, hi + 1):
            pk = pmf(k)
            if pk <= thr:
                total += pk
        return min(mp.mpf(1), total)


def poisson(rng):
    cases = []
    for _ in range(200):
        T = rng.choice([1.0, round(10 ** rng.uniform(-1, 2), 4)])
        r = rng.choice([1.0, round(10 ** rng.uniform(-1, 2), 4)])
        m = r * T
        x = int(stats.poisson.ppf(rng.uniform(0.001, 0.999), m * 10 ** rng.uniform(-0.5, 0.5)))
        alt = rng.choice(ALTS)
        conf = rng.choice([0.95, 0.9, 0.99])
        if alt == "less":
            pv = stats.poisson.cdf(x, m)
            lo, hi = 0.0, stats.gamma.ppf(conf, x + 1)
        elif alt == "greater":
            pv = stats.poisson.sf(x - 1, m)
            lo, hi = (0.0 if x == 0 else stats.gamma.ppf(1 - conf, x)), math.inf
        else:
            pv = pois_two_sided(x, m)
            a = (1 - conf) / 2
            lo, hi = (0.0 if x == 0 else stats.gamma.ppf(a, x)), stats.gamma.ppf(1 - a, x + 1)
        cases.append({"args": {"x": [x], "T": [s(T)], "r": s(r), "alternative": alt, "confLevel": s(conf)},
                      "expected": {"pValue": s(pv), "confInt": [s(lo / T), s(hi / T) if hi != math.inf else "Inf"],
                                   "estimate": s(x / T)}})
    for _ in range(100):
        T1, T2 = round(10 ** rng.uniform(0, 3), 2), round(10 ** rng.uniform(0, 3), 2)
        r = rng.choice([1.0, round(10 ** rng.uniform(-1, 1), 3)])
        x1, x2 = rng.randint(0, 60), rng.randint(0, 60)
        if x1 + x2 == 0:
            continue
        alt = rng.choice(ALTS)
        conf = rng.choice([0.95, 0.9, 0.99])
        p0 = r * T1 / (r * T1 + T2)
        b = stats.binomtest(x1, x1 + x2, p0, alternative=SCIPY_ALT[alt])
        ci = b.proportion_ci(confidence_level=conf, method="exact")
        ratio = lambda p: p / (1 - p) * T2 / T1 if p < 1 else math.inf
        cases.append({"args": {"x": [x1, x2], "T": [s(T1), s(T2)], "r": s(r), "alternative": alt, "confLevel": s(conf)},
                      "expected": {"pValue": s(b.pvalue), "parameter": s((x1 + x2) * p0),
                                   "confInt": [s(ratio(ci.low)), "Inf" if ci.high == 1 else s(ratio(ci.high))]}})
    return cases


def var(rng):
    cases = []
    for _ in range(200):
        nx, ny = rng.randint(2, 60), rng.randint(2, 60)
        sx, sy = 10 ** rng.uniform(-3, 3), 10 ** rng.uniform(-3, 3)
        x = [round(rng.gauss(0, sx), 6) for _ in range(nx)]
        y = [round(rng.gauss(5, sy), 6) for _ in range(ny)]
        ratio = rng.choice([1.0, round(10 ** rng.uniform(-2, 2), 4)])
        alt = rng.choice(ALTS)
        conf = rng.choice([0.95, 0.9, 0.99])
        with mp.workdps(50):
            vx = mp.fsum([(mp.mpf(v) - mp.fsum(map(mp.mpf, x)) / nx) ** 2 for v in x]) / (nx - 1)
            vy = mp.fsum([(mp.mpf(v) - mp.fsum(map(mp.mpf, y)) / ny) ** 2 for v in y]) / (ny - 1)
            est = vx / vy
        F = float(est / ratio)
        d1, d2 = nx - 1, ny - 1
        lo_p, up_p = stats.f.cdf(F, d1, d2), stats.f.sf(F, d1, d2)
        if alt == "less":
            pv, ci = lo_p, [0.0, float(est) / stats.f.ppf(1 - conf, d1, d2)]
        elif alt == "greater":
            pv, ci = up_p, [float(est) / stats.f.ppf(conf, d1, d2), math.inf]
        else:
            b = (1 - conf) / 2
            pv, ci = min(1, 2 * min(lo_p, up_p)), [float(est) / stats.f.ppf(1 - b, d1, d2), float(est) / stats.f.ppf(b, d1, d2)]
        cases.append({"args": {"x": [s(v) for v in x], "y": [s(v) for v in y], "ratio": s(ratio), "alternative": alt,
                               "confLevel": s(conf)},
                      "expected": {"statistic": s(F), "estimate": s(est), "pValue": s(pv),
                                   "confInt": [s(c) if c != math.inf else "Inf" for c in ci]}})
    return cases


def bartlett(rng):
    cases = []
    for _ in range(150):
        k = rng.randint(2, 7)
        groups = []
        for _ in range(k):
            n = rng.randint(2, 40)
            sd = 10 ** rng.uniform(-1, 1) * (1 if rng.random() < 0.6 else 10 ** rng.uniform(-2, 2))
            groups.append([round(rng.gauss(3, sd), 6) for _ in range(n)])
        st, pv = stats.bartlett(*groups)
        cases.append({"args": {"groups": [[s(v) for v in g] for g in groups]},
                      "expected": {"statistic": s(st), "parameter": s(k - 1), "pValue": s(pv)}})
    return cases


def mcnemar(rng):
    cases = []
    for _ in range(150):
        r = rng.choice([2, 2, 2, 3, 4, 5])
        t = [[rng.randint(0, 200) if rng.random() < 0.9 else rng.randint(1, 5) for _ in range(r)] for _ in range(r)]
        if any(t[i][j] + t[j][i] == 0 for i in range(r) for j in range(i + 1, r)):
            continue
        correct = rng.random() < 0.6
        if correct and r == 2:
            b, c = t[0][1], t[1][0]
            st = (abs(b - c) - 1) ** 2 / (b + c)
        else:
            st = sum((t[i][j] - t[j][i]) ** 2 / (t[i][j] + t[j][i]) for i in range(r) for j in range(i + 1, r))
        df = r * (r - 1) // 2
        cases.append({"args": {"x": [[s(v) for v in row] for row in t], "correct": correct},
                      "expected": {"statistic": s(st), "parameter": s(df), "pValue": s(stats.chi2.sf(st, df))}})
    return cases


if __name__ == "__main__":
    for i, (name, f) in enumerate([("binomTest", binom), ("poissonTest", poisson), ("varTest", var),
                                   ("bartlettTest", bartlett), ("mcnemarTest", mcnemar)]):
        write(name, f(random.Random(20261023 + i)))
