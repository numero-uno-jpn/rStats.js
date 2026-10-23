"""References from SciPy for the simple hypothesis tests (binomTest, poissonTest, varTest, bartlettTest, mcnemarTest),
used until the R fixtures exist and alongside them afterwards. Writes test/fixtures/htest_<name>.scipy.json.

    python3 -I scripts/mpmath/htest_scipy.py

binomTest: scipy.stats.binomtest (p-value with the same 1e-7 relative slack; Clopper-Pearson interval).
poissonTest: one sample from the definition (sum of the Poisson probabilities no larger than the observed one, at 50
digits with mpmath) and gamma quantiles; two samples through scipy's binomtest.
varTest, bartlettTest, mcnemarTest: the formulas with scipy.stats distributions (bartlett: scipy.stats.bartlett).
kruskalTest, friedmanTest, flignerTest, moodTest, onewayTest, shapiroTest: scipy.stats kruskal, friedmanchisquare,
fligner (center="median"), mood (ties per Mielke), f_oneway (equal_var True and False) and shapiro.
quadeTest: Conover's formulas computed directly (SciPy has no Quade test).
propTest: equality of k proportions through scipy.stats.chi2_contingency (with its Yates correction for 2 x 2, which
reduces each |O - E| by at most 1/2); one proportion and the intervals (Wilson with continuity correction, Wald for a
difference) from the formulas.
mantelhaenTest: 2 x 2 x K asymptotic test, pooled odds ratio and its Robins-Breslow-Greenland interval from statsmodels
(StratifiedTable; cases whose |sum a - sum E| < 1/2 with the correction are left out, as statsmodels then still
subtracts 1/2); the exact conditional p-values with exact rational arithmetic; I x J x K from the formula at 40 digits.
ansariTest: exact cases (below 55 values per sample, no ties) by counting subsets in exact integers (scipy's exact
p-values are good to about 1e-8 only); the normal approximation from scipy.stats.ansari.
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


def tied_sample(rng, n, kind):
    if kind == 0:
        return [round(rng.gauss(0, 1), 6) for _ in range(n)]
    if kind == 1:
        return [float(rng.randint(0, 6)) for _ in range(n)]  # many ties
    return [round(rng.expovariate(1) * 10 ** rng.uniform(-3, 3), 4) for _ in range(n)]


def groups_cases(rng, count, kmin=2, kmax=6, nmin=2, nmax=30):
    out = []
    for _ in range(count):
        k = rng.randint(kmin, kmax)
        kind = rng.randint(0, 2)
        out.append([[v + j * rng.uniform(0, 0.5) for v in tied_sample(rng, rng.randint(nmin, nmax), kind)]
                    for j in range(k)])
    return out


def g_args(groups):
    return {"groups": [[s(v) for v in g] for g in groups]}


def kruskal(rng):
    cases = []
    for gs in groups_cases(rng, 150):
        if len(set(v for g in gs for v in g)) < 2:
            continue
        st, pv = stats.kruskal(*gs)
        cases.append({"args": g_args(gs), "expected": {"statistic": s(st), "parameter": s(len(gs) - 1), "pValue": s(pv)}})
    return cases


def blocks(rng, count):
    out = []
    for _ in range(count):
        b, k = rng.randint(2, 25), rng.randint(2, 6)
        kind = rng.randint(0, 2)
        out.append([[v + j * rng.uniform(0, 0.8) for j, v in enumerate(tied_sample(rng, k, kind))] for _ in range(b)])
    return out


def friedman(rng):
    cases = []
    for y in blocks(rng, 150):
        k = len(y[0])
        if k < 3:
            continue  # scipy.stats.friedmanchisquare needs at least 3 treatments
        if all(len(set(r)) == 1 for r in y):
            continue
        st, pv = stats.friedmanchisquare(*[[r[j] for r in y] for j in range(k)])
        cases.append({"args": {"y": [[s(v) for v in r] for r in y]},
                      "expected": {"statistic": s(st), "parameter": s(k - 1), "pValue": s(pv)}})
    return cases


def quade(rng):
    cases = []
    for y in blocks(rng, 150):
        b, k = len(y), len(y[0])
        q = stats.rankdata([max(r) - min(r) for r in y])
        S = [[q[i] * (rr - (k + 1) / 2) for rr in stats.rankdata(y[i])] for i in range(b)]
        with mp.workdps(40):
            A = mp.fsum(mp.mpf(v) ** 2 for row in S for v in row)
            B = mp.fsum(mp.fsum(mp.mpf(S[i][j]) for i in range(b)) ** 2 for j in range(k)) / b
            if A == B:
                continue
            F = (b - 1) * B / (A - B)
        d1, d2 = k - 1, (b - 1) * (k - 1)
        cases.append({"args": {"y": [[s(v) for v in r] for r in y]},
                      "expected": {"statistic": s(F), "parameter": [s(d1), s(d2)], "pValue": s(stats.f.sf(float(F), d1, d2))}})
    return cases


def fligner(rng):
    cases = []
    for gs in groups_cases(rng, 150):
        st, pv = stats.fligner(*gs, center="median")
        if not math.isfinite(st):
            continue
        cases.append({"args": g_args(gs), "expected": {"statistic": s(st), "parameter": s(len(gs) - 1), "pValue": s(pv)}})
    return cases


def mood(rng):
    cases = []
    for _ in range(150):
        kind = rng.randint(0, 2)
        x = tied_sample(rng, rng.randint(2, 40), kind)
        y = [v * rng.uniform(0.3, 3) for v in tied_sample(rng, rng.randint(2, 40), kind)]
        alt = rng.choice(ALTS)
        z, pv = stats.mood(x, y, alternative=SCIPY_ALT[alt])
        if not math.isfinite(z):
            continue
        cases.append({"args": {"x": [s(v) for v in x], "y": [s(v) for v in y], "alternative": alt},
                      "expected": {"statistic": s(z), "pValue": s(pv)}})
    return cases


def oneway(rng):
    cases = []
    for gs in groups_cases(rng, 150):
        gs = [[v * 10 ** rng.uniform(-1, 1) for v in g] for g in gs]
        if any(np.var(g) == 0 for g in gs):
            continue
        ve = rng.random() < 0.5
        r = stats.f_oneway(*gs, equal_var=ve)
        n, k = sum(len(g) for g in gs), len(gs)
        if ve:
            df2 = n - k
        else:
            w = [len(g) / np.var(g, ddof=1) for g in gs]
            sw = sum(w)
            c = sum((1 - wi / sw) ** 2 / (len(g) - 1) for wi, g in zip(w, gs)) / (k * k - 1)
            df2 = 1 / (3 * c)
        cases.append({"args": dict(g_args(gs), varEqual=ve),
                      "expected": {"statistic": s(r.statistic), "parameter": [s(k - 1), s(df2)], "pValue": s(r.pvalue)}})
    return cases


def shapiro(rng):
    cases = []
    for _ in range(150):
        n = int(10 ** rng.uniform(math.log10(3), math.log10(5000)))
        kind = rng.randint(0, 2)
        x = tied_sample(rng, n, kind) if kind != 1 else [rng.gauss(0, 1) + rng.randint(0, 3) for _ in range(n)]
        if max(x) - min(x) < 1e-10:
            continue
        w, pv = stats.shapiro(x)
        cases.append({"args": {"x": [s(v) for v in x]}, "expected": {"statistic": s(w), "pValue": s(pv)}})
    return cases


def prop(rng):
    cases = []
    for _ in range(200):
        k = rng.choice([1, 1, 2, 2, 3, 4])
        n = [rng.randint(1, 400) for _ in range(k)]
        base = rng.uniform(0.02, 0.98)
        x = [min(m, max(0, int(round(m * min(max(base + rng.uniform(-0.1, 0.1), 0), 1))))) for m in n]
        alt = rng.choice(ALTS) if k <= 2 else "two.sided"
        conf = rng.choice([0.95, 0.9, 0.99])
        correct = rng.random() < 0.7
        args = {"x": [s(v) for v in x], "n": [s(v) for v in n], "alternative": alt, "confLevel": s(conf), "correct": correct}
        exp = {}
        if k == 1:
            p0 = rng.choice([0.5, round(rng.uniform(0.05, 0.95), 3)])
            args["p"] = [s(p0)]
            est = x[0] / n[0]
            y = min(0.5 if correct else 0, abs(x[0] - n[0] * p0))
            E1, E2 = n[0] * p0, n[0] * (1 - p0)
            st = (abs(x[0] - E1) - y) ** 2 / E1 + (abs(n[0] - x[0] - E2) - y) ** 2 / E2
            if alt == "two.sided":
                pv = stats.chi2.sf(st, 1)
            else:
                zz = math.copysign(math.sqrt(st), est - p0) if est != p0 else 0.0
                pv = stats.norm.cdf(zz) if alt == "less" else stats.norm.sf(zz)
            z = stats.norm.ppf((1 + conf) / 2 if alt == "two.sided" else conf)
            z22n = z * z / (2 * n[0])
            def w(pc, sg):
                return (pc + z22n + sg * z * math.sqrt(pc * (1 - pc) / n[0] + z22n / (2 * n[0]))) / (1 + 2 * z22n)
            pu = 1 if est + y / n[0] >= 1 else w(est + y / n[0], 1)
            pl = 0 if est - y / n[0] <= 0 else w(est - y / n[0], -1)
            ci = {"two.sided": [max(pl, 0), min(pu, 1)], "less": [0, min(pu, 1)], "greater": [max(pl, 0), 1]}[alt]
            exp = {"statistic": s(st), "pValue": s(pv), "confInt": [s(c) for c in ci]}
        else:
            if sum(x) == 0 or sum(x) == sum(n):
                continue
            table = np.array([[xi, ni - xi] for xi, ni in zip(x, n)], dtype=float)
            chi = stats.chi2_contingency(table, correction=correct and k == 2)
            st = chi.statistic
            if alt == "two.sided":
                pv = chi.pvalue
            else:
                d = x[0] / n[0] - x[1] / n[1]
                zz = math.copysign(math.sqrt(st), d) if d != 0 else 0.0
                pv = stats.norm.cdf(zz) if alt == "less" else stats.norm.sf(zz)
            exp = {"statistic": s(st), "parameter": s(k - 1), "pValue": s(pv)}
            if k == 2:
                e = [x[0] / n[0], x[1] / n[1]]
                d = e[0] - e[1]
                si = 1 / n[0] + 1 / n[1]
                y = min(0.5 if correct else 0, abs(d) / si)
                z = stats.norm.ppf((1 + conf) / 2 if alt == "two.sided" else conf)
                wd = z * math.sqrt(e[0] * (1 - e[0]) / n[0] + e[1] * (1 - e[1]) / n[1]) + y * si
                ci = {"two.sided": [max(d - wd, -1), min(d + wd, 1)], "less": [-1, min(d + wd, 1)],
                      "greater": [max(d - wd, -1), 1]}[alt]
                exp["confInt"] = [s(c) for c in ci]
        cases.append({"args": args, "expected": exp})
    return cases


def mantelhaen(rng):
    from fractions import Fraction
    from math import comb
    from statsmodels.stats.contingency_tables import StratifiedTable
    cases = []
    for _ in range(150):
        K = rng.randint(2, 6)
        tabs = [[[rng.randint(0, 25) for _ in range(2)] for _ in range(2)] for _ in range(K)]
        if any(sum(map(sum, t)) < 2 for t in tabs):
            continue
        alt = rng.choice(ALTS)
        conf = rng.choice([0.95, 0.9, 0.99])
        exact = rng.random() < 0.4
        args = {"x": [[[s(v) for v in r] for r in t] for t in tabs], "alternative": alt, "confLevel": s(conf), "exact": exact}
        if exact:
            dist = {0: Fraction(1)}
            for (a, b), (c, d) in tabs:
                m, n, k = a + c, b + d, a + b
                tot = comb(m + n, k)
                new = {}
                for sv, pv in dist.items():
                    for x in range(max(0, k - n), min(k, m) + 1):
                        new[sv + x] = new.get(sv + x, 0) + pv * Fraction(comb(m, x) * comb(n, k - x), tot)
                dist = new
            sobs = sum(t[0][0] for t in tabs)
            if alt == "less":
                pv = sum(v for kk, v in dist.items() if kk <= sobs)
            elif alt == "greater":
                pv = sum(v for kk, v in dist.items() if kk >= sobs)
            else:
                thr = dist[sobs] * Fraction(10 ** 7 + 1, 10 ** 7)
                pv = min(Fraction(1), sum(v for v in dist.values() if v <= thr))
            cases.append({"args": args, "expected": {"statistic": s(sobs), "pValue": s(float(pv))}})
            continue
        correct = rng.random() < 0.6
        args["correct"] = correct
        st = StratifiedTable([np.array(t, dtype=float) for t in tabs])
        delta = sum(t[0][0] - (t[0][0] + t[0][1]) * (t[0][0] + t[1][0]) / sum(map(sum, t)) for t in tabs)
        if correct and abs(delta) < 0.5:
            continue
        r = st.test_null_odds(correction=correct)
        if alt == "two.sided":
            # chi-squared on 1 df as erfc at 40 digits (statsmodels' p-value is only good to about 1e-10)
            with mp.workdps(40):
                pv = mp.erfc(mp.sqrt(mp.mpf(r.statistic) / 2))
        else:
            zz = math.copysign(math.sqrt(r.statistic), delta)
            pv = stats.norm.cdf(zz) if alt == "less" else stats.norm.sf(zz)
        exp = {"statistic": s(r.statistic), "pValue": s(pv)}
        est = st.oddsratio_pooled
        if math.isfinite(est) and est > 0:
            exp["estimate"] = s(est)
            if alt == "two.sided":
                lo, hi = st.oddsratio_pooled_confint(alpha=1 - conf)
                exp["confInt"] = [s(lo), s(hi)]
        cases.append({"args": args, "expected": exp})
    for _ in range(60):
        K, I, J = rng.randint(2, 5), rng.randint(2, 4), rng.randint(2, 4)
        if I == 2 and J == 2:
            J = 3
        tabs = [[[rng.randint(0, 30) for _ in range(J)] for _ in range(I)] for _ in range(K)]
        with mp.workdps(40):
            p = (I - 1) * (J - 1)
            diff = mp.zeros(p, 1)
            V = mp.zeros(p, p)
            for t in tabs:
                tot = mp.mpf(sum(map(sum, t)))
                rr = [mp.mpf(sum(row)) for row in t]
                cc = [mp.mpf(sum(t[i][j] for i in range(I))) for j in range(J)]
                for j in range(J - 1):
                    for i in range(I - 1):
                        u = i + (I - 1) * j
                        diff[u] += t[i][j] - rr[i] * cc[j] / tot
                        for jj in range(J - 1):
                            for ii in range(I - 1):
                                vr = (tot * rr[i] if i == ii else 0) - rr[i] * rr[ii]
                                vc = (tot * cc[j] if j == jj else 0) - cc[j] * cc[jj]
                                V[u, ii + (I - 1) * jj] += vr * vc / (tot ** 2 * (tot - 1))
            try:
                stat = (diff.T * mp.lu_solve(V, diff))[0]
            except ZeroDivisionError:
                continue
        cases.append({"args": {"x": [[[s(v) for v in r] for r in t] for t in tabs]},
                      "expected": {"statistic": s(stat), "parameter": s(p), "pValue": s(stats.chi2.sf(float(stat), p))}})
    return cases


def ansari_exact(x, y, alt):
    """exact p-value of the Ansari-Bradley statistic without ties, counting the m-subsets of positions by score sum"""
    from fractions import Fraction
    m, n = len(x), len(y)
    N = m + n
    pos = {v: i + 1 for i, v in enumerate(sorted(x + y))}
    ab = sum(min(pos[v], N - pos[v] + 1) for v in x)
    cnt = [dict() for _ in range(m + 1)]
    cnt[0][0] = 1
    for i in range(1, N + 1):
        sc = min(i, N + 1 - i)
        for k in range(min(i, m) - 1, -1, -1):
            for t, c in list(cnt[k].items()):
                cnt[k + 1][t + sc] = cnt[k + 1].get(t + sc, 0) + c
    tot = sum(cnt[m].values())
    lo = Fraction(sum(c for t, c in cnt[m].items() if t <= ab), tot)
    hi = Fraction(sum(c for t, c in cnt[m].items() if t >= ab), tot)
    if alt == "less":
        return float(hi)
    if alt == "greater":
        return float(lo)
    centre = (m + 1) ** 2 // 4 + ((m * n) // 2) / 2
    return float(min(1, 2 * (hi if ab > centre else lo)))


def ansari(rng):
    cases = []
    for _ in range(200):
        kind = rng.choice([0, 0, 1, 2])
        m, n = rng.randint(1, 70), rng.randint(1, 70)
        x = tied_sample(rng, m, kind)
        y = [v * rng.uniform(0.3, 3) for v in tied_sample(rng, n, kind)]
        if kind == 1:
            y = [round(v) for v in y]
        alt = rng.choice(ALTS)
        ties = len(set(x + y)) < m + n
        exact = m < 55 and n < 55 and not ties
        r = stats.ansari(x, y, alternative=SCIPY_ALT[alt])
        if not math.isfinite(r.pvalue):
            continue
        pv = ansari_exact(x, y, alt) if exact else r.pvalue
        cases.append({"args": {"x": [s(v) for v in x], "y": [s(v) for v in y], "alternative": alt, "exact": exact},
                      "expected": {"statistic": s(r.statistic), "pValue": s(pv)}})
    return cases


if __name__ == "__main__":
    for i, (name, f) in enumerate([("binomTest", binom), ("poissonTest", poisson), ("varTest", var),
                                   ("bartlettTest", bartlett), ("mcnemarTest", mcnemar), ("kruskalTest", kruskal),
                                   ("friedmanTest", friedman), ("quadeTest", quade), ("flignerTest", fligner),
                                   ("moodTest", mood), ("onewayTest", oneway), ("shapiroTest", shapiro),
                                   ("propTest", prop), ("mantelhaenTest", mantelhaen),
                                   ("ansariTest", ansari)]):
        if len(sys.argv) > 1 and name not in sys.argv[1:]:
            continue
        write(name, f(random.Random(20261023 + i)))
