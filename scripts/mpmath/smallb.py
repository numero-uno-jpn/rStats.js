"""The incomplete beta function with one large and one small parameter (pbeta and pt), checked against mpmath.

Covers the region of the expansion for large a and small b (src/special/incbetLargeA.ts) and around it: a from 15
to 1e10 (the R fixtures of oracle/largea.R start at 50), b from 0.1 to 40, and the mirror image. With
T = a + (b - 1)/2, u = -T log x is approximately Gamma(b, 1) distributed, so the points are placed at gamma
quantiles of u from 1e-12 to 1 - 1e-12 and at random quantiles, from the bulk into both tails. pt has
df = 2a with b = 1/2 and |t| from 0.05 to 12.

The reference is the positive-term series in the frame of the small parameter (DLMF 8.17.8 with the roles of a
and b exchanged), I_y(b, a) = y^b x^a / (b B(a, b)) 2F1(a + b, 1; b + 1; y) with y = 1 - x, which converges in a
few hundred terms whatever a is; the other tail is 1 - (that one). Each value is computed at 60 and 90 digits and
kept only if the two agree to 1e-28. The inputs are doubles and 1 - x is formed exactly; for pt, x = n/(n + t^2)
and 1 - x are formed from the double t at full precision.

    python3 -I scripts/mpmath/smallb.py [pbeta_smallb] [pt_smallb]

Writes test/fixtures/audit_pbeta_smallb.mpmath.json and audit_pt_smallb.mpmath.json (checked by
test/audit.test.ts).
"""
import sys, os, random
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import write_fixture

SEED = 20261025


def small_tail(a, b, x, y):
    """I_y(b, a) = 1 - I_x(a, b) and its log at the current precision (x + y = 1)"""
    s = mp.mpf(1)
    t = mp.mpf(1)
    n = 0
    eps = mp.mpf(10) ** (-mp.mp.dps - 5)
    while True:
        t *= (a + b + n) * y / (b + 1 + n)
        s += t
        n += 1
        if t < eps * s and (a + b + n) * y < (b + 1 + n):
            break
    lpre = b * mp.log(y) + a * mp.log(x) - mp.log(b) - (mp.loggamma(a) + mp.loggamma(b) - mp.loggamma(a + b))
    l = lpre + mp.log(s)
    return mp.exp(l), l


def tails(a, b, x, y):
    """[I_x(a, b), 1 - I_x(a, b), logs] from mpf x, y at the current precision"""
    up, lup = small_tail(a, b, x, y)
    return [1 - up, up, mp.log1p(-up), lup]


def stable(f):
    vals = []
    for dps in (60, 90):
        with mp.workdps(dps):
            vals.append(f())
    with mp.workdps(90):
        for u, v in zip(*vals):
            if not (abs(u - v) <= mp.mpf(10) ** -28 * abs(v)):
                return None
    return vals[1]


def add_tails(cases, args, ref):
    """Four cases (lowerTail x logP) from [lower, upper, log lower, log upper]"""
    lo, up, llo, lup = ref
    for lower in (True, False):
        for logp in (False, True):
            v = (llo if lower else lup) if logp else (lo if lower else up)
            cases.append((dict(args, lowerTail=lower, logP=logp), v, 1 if logp else None))


def gamma_quantile(b, p):
    """u with P(b, u) = p (bisection in log u; the upper tail for p > 1/2)"""
    b = mp.mpf(b)
    f = (lambda v: mp.gammainc(b, 0, v, regularized=True) - p) if p <= 0.5 else \
        (lambda v: (1 - p) - mp.gammainc(b, v, mp.inf, regularized=True))
    lo, hi = mp.mpf(-700), mp.log(1e4)
    for _ in range(120):
        mid = (lo + hi) / 2
        if f(mp.exp(mid)) < 0:
            lo = mid
        else:
            hi = mid
    return mp.exp((lo + hi) / 2)


def beta_job(job):
    a, b, p, mirror = job
    with mp.workdps(40):
        u = gamma_quantile(b, p)
        T = mp.mpf(a) + (mp.mpf(b) - 1) / 2
        y = float(-mp.expm1(-u / T))
    x = 1 - y
    # (the expansion is used up to y = 0.3; the series below converges like y^n)
    if not (0 < y < 0.6) or x == 1:
        return None
    y = 1 - x  # exact
    ref = stable(lambda: tails(mp.mpf(a), mp.mpf(b), mp.mpf(x), mp.mpf(y)))
    if ref is None:
        return None
    if mirror:
        lo, up, llo, lup = ref
        return ({"q": y, "shape1": b, "shape2": a}, [up, lo, lup, llo])
    return ({"q": x, "shape1": a, "shape2": b}, ref)


PS = [1e-12, 1e-6, 1e-3, 0.03, 0.1, 0.3, 0.5, 0.7, 0.9, 0.97, 1 - 1e-3, 1 - 1e-6, 1 - 1e-12]


def beta_jobs():
    rng = random.Random(SEED)
    jobs = []
    pairs = [(a, b) for a in (15, 20, 30, 60, 1e3, 1e5, 1e10) for b in (0.1, 0.5, 1, 2.5, 10, 20, 30, 40)]
    for _ in range(60):
        pairs.append((float("%.6g" % 10 ** rng.uniform(1.17, 10)), float("%.6g" % 10 ** rng.uniform(-1, 1.6))))
    for a, b in pairs:
        if a < b:
            continue
        ps = PS + [rng.uniform(0.01, 0.99) for _ in range(6)]
        for p in ps:
            jobs.append((a, b, p, rng.random() < 0.5))
    return jobs


def t_job(job):
    df, t = job
    # pt(t, n) for t > 0: upper tail = I_x(n/2, 1/2) / 2 with x = n / (n + t^2)
    def f():
        n, tt = mp.mpf(df), mp.mpf(t)
        den = n + tt * tt
        lo, up, llo, lup = tails(n / 2, mp.mpf(0.5), n / den, tt * tt / den)
        upper = lo / 2
        return [1 - upper, upper, mp.log1p(-upper), mp.log(upper)]
    ref = stable(f)
    if ref is None:
        return None
    return ({"q": t, "df": df}, ref)


def t_jobs():
    rng = random.Random(SEED + 1)
    jobs = []
    for df in (30, 50, 100, 1e3, 1e4, 1e6, 1e8, 1e10, 1e12):
        for t in (0.05, 0.3, 0.7, 1, 1.5, 2, 2.5, 3, 4, 6, 8, 12):
            jobs.append((df, t))
    for _ in range(120):
        jobs.append((float("%.6g" % 10 ** rng.uniform(1.5, 12)), float("%.6g" % rng.uniform(0.05, 10))))
    return jobs


def neg_t(cases):
    """pt(-t) from pt(t): the tails exchange"""
    out = []
    for args, v, scale in cases:
        a = dict(args, q=-args["q"], lowerTail=not args["lowerTail"])
        out.append((a, v, scale))
    return cases + out


if __name__ == "__main__":
    names = sys.argv[1:] or ["pbeta_smallb", "pt_smallb"]
    with Pool() as pool:
        if "pbeta_smallb" in names:
            cases = []
            for res in pool.map(beta_job, beta_jobs(), chunksize=1):
                if res is not None:
                    add_tails(cases, *res)
            write_fixture("audit_pbeta_smallb", cases)
        if "pt_smallb" in names:
            cases = []
            for res in pool.map(t_job, t_jobs(), chunksize=1):
                if res is not None:
                    add_tails(cases, *res)
            write_fixture("audit_pt_smallb", neg_t(cases))
