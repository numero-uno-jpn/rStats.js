"""The incomplete beta function with both parameters large (pbeta and pbinom), checked against mpmath.

Covers the region of the uniform asymptotic expansion (src/special/incbetTemme.ts) and around it: a and b from
15 to 1e10, points x at given values of tau = sign(x - p) sqrt(2 E / m) (p = a/(a+b), m = ab/(a+b), E the
deviance a log(a/(r x)) + b log(b/(r (1 - x))), r = a + b), from the centre through the switch at |tau| = 1 into
the far tails, both tails and the log scale.

mpmath's betainc takes minutes for a = 1e4, so the reference is the continued fraction DLMF 8.17.22 (modified
Lentz) in the frame where it converges (x below (a + 1)/(a + b + 2), otherwise I_(1-x)(b, a)), times the prefactor
x^a (1-x)^b / (a B(a, b)) from loggamma, with the other tail as 1 - (that one). Each value is computed at 50 and
80 digits and kept only if the two agree to 1e-28; the inputs are doubles and 1 - x is formed exactly. A few
cases are cross-checked against numerical integration (mp.quad) at startup.

    python3 -I scripts/mpmath/largebeta.py [pbeta_large] [pbinom_large]

Writes test/fixtures/audit_pbeta_large.mpmath.json and audit_pbinom_large.mpmath.json (checked by
test/audit.test.ts).
"""
import sys, os, math, random
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import write_fixture

SEED = 20261025


def cf_lower(a, b, x):
    """(I_x(a, b), log I_x(a, b)) by the continued fraction DLMF 8.17.22 at the current precision"""
    tiny = mp.mpf(10) ** (-3 * mp.mp.dps)
    eps = mp.mpf(10) ** (3 - mp.mp.dps)
    f = mp.mpf(1)
    C = f
    D = mp.mpf(0)
    j = 0
    for i in range(1, 10 ** 8):
        if i % 2 == 1:
            d = -(a + j) * (a + b + j) * x / ((a + 2 * j) * (a + 2 * j + 1))
        else:
            j += 1
            d = j * (b - j) * x / ((a + 2 * j - 1) * (a + 2 * j))
        D = 1 + d * D
        if D == 0:
            D = tiny
        C = 1 + d / C
        if C == 0:
            C = tiny
        D = 1 / D
        delta = C * D
        f *= delta
        if abs(delta - 1) < eps:
            break
    lpre = a * mp.log(x) + b * mp.log1p(-x) - mp.log(a) - (mp.loggamma(a) + mp.loggamma(b) - mp.loggamma(a + b))
    return mp.exp(lpre) / f, lpre - mp.log(f)


def both_tails(a, b, x):
    """[lower, upper, log lower, log upper] of I_x(a, b) at the current precision (a, b, x doubles)"""
    a, b, x = mp.mpf(a), mp.mpf(b), mp.mpf(x)
    if x <= (a + 1) / (a + b + 2):
        lo, llo = cf_lower(a, b, x)
        return [lo, 1 - lo, llo, mp.log1p(-lo)]
    up, lup = cf_lower(b, a, 1 - x)
    return [1 - up, up, mp.log1p(-up), lup]


def stable_tails(a, b, x):
    vals = []
    for dps in (50, 80):
        with mp.workdps(dps):
            vals.append(both_tails(a, b, x))
    with mp.workdps(80):
        for u, v in zip(*vals):
            if not (abs(u - v) <= mp.mpf(10) ** -28 * abs(v)):
                return None
    return vals[1]


def x_for(a, b, side, E=None, tau=None):
    """The double x on the given side of p (-1 or 1) with deviance E, or with sqrt(2 E / m) = tau (bisection at
    40 digits); None if it is outside (0, 1)"""
    with mp.workdps(40):
        a, b = mp.mpf(a), mp.mpf(b)
        r = a + b
        p, m = a / r, a * b / r
        target = mp.mpf(E) if tau is None else m * mp.mpf(tau) ** 2 / 2
        E = lambda x: a * mp.log(a / (r * x)) + b * mp.log(b / (r * (1 - x)))
        if target == 0:
            return float(p)
        lo, hi = (mp.mpf(2) ** -1000, p) if side < 0 else (p, 1 - mp.mpf(2) ** -60)
        far = lo if side < 0 else hi
        if E(far) < target:
            return None
        for _ in range(300):
            mid = (lo + hi) / 2
            if (E(mid) > target) == (side < 0):
                lo = mid
            else:
                hi = mid
        x = float((lo + hi) / 2)
    return x if 0 < x < 1 else None


def add_tails(cases, args, ref):
    """Four cases (lowerTail x logP) from [lower, upper, log lower, log upper]"""
    lo, up, llo, lup = ref
    for lower in (True, False):
        for logp in (False, True):
            v = (llo if lower else lup) if logp else (lo if lower else up)
            cases.append((dict(args, lowerTail=lower, logP=logp), v, 1 if logp else None))


# Points: deviances E from the centre to the far tails (E = 2.25 is the switch between the two forms of the
# expansion), and |tau| around the edge of its region (tau = 1) and beyond
ES = [0, 1e-12, 1e-4, 0.1, 1, 2.2, 2.3, 5, 20, 100, 700, 3000]
TAUS = [0.5, 0.74, 0.76, 0.99, 1.01, 1.2, 2]


def beta_job(job):
    a, b, side, E, tau = job
    x = x_for(a, b, side, E, tau)
    if x is None:
        return None
    ref = stable_tails(a, b, x)
    if ref is None:
        return None
    return ({"q": x, "shape1": a, "shape2": b}, ref)


def beta_jobs():
    rng = random.Random(SEED)
    pairs = []
    big = [30, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8]
    for a in big:
        pairs.append((a, a))
    for a, b in [(1e3, 30), (1e5, 100), (1e7, 1e3), (1e8, 1e5), (1e10, 1e4), (1e10, 1e10), (2.5e6, 7.5e6),
                 (40, 1e6), (25.5, 25.5), (20, 400), (1e9, 50)]:
        pairs.append((a, b))
    for _ in range(40):
        a = float("%.6g" % 10 ** rng.uniform(1.2, 8))
        b = float("%.6g" % 10 ** rng.uniform(1.2, 8))
        pairs.append((a, b))
    jobs = []
    for a, b in pairs:
        for side in (-1, 1):
            for E in ES:
                if E > 0 or side < 0:
                    jobs.append((a, b, side, E, None))
            for t in TAUS:
                jobs.append((a, b, side, None, t))
        # and random points with |tau| up to 1.5
        for _ in range(4):
            jobs.append((a, b, rng.choice((-1, 1)), None, rng.uniform(0, 1.5)))
    return jobs


def binom_job(job):
    n, prob, z = job
    mean, sd = n * prob, math.sqrt(n * prob * (1 - prob))
    k = float(round(mean + z * sd))
    if not (0 <= k < n):
        return None
    # P[X <= k] = I_(1-p)(n - k, k + 1); the upper tail I_p(k + 1, n - k)
    ref = stable_tails(k + 1, n - k, prob)
    if ref is None:
        return None
    lo, up, llo, lup = ref
    return ({"q": k, "size": n, "prob": prob}, [up, lo, lup, llo])


def binom_jobs():
    jobs = []
    for n in [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9]:
        for prob in [0.5, 0.3, 0.9, 0.01, 1e-4]:
            for z in [0, 0.5, -0.5, 1, -1, 2, -2, 4, -4, 8, -8, 15, -15, 30, -30]:
                jobs.append((n, prob, z))
    return jobs


def selfcheck():
    """Compare the continued fraction with numerical integration for a few cases"""
    for a, b, x in [(1e3, 1e3, 0.49), (3e4, 2e3, 0.935), (50, 51, 0.3)]:
        with mp.workdps(40):
            A, B, X = mp.mpf(a), mp.mpf(b), mp.mpf(x)
            lb = mp.loggamma(A) + mp.loggamma(B) - mp.loggamma(A + B)
            f = lambda t: mp.exp((A - 1) * mp.log(t) + (B - 1) * mp.log1p(-t) - lb)
            p = A / (A + B)
            sd = mp.sqrt(p * (1 - p) / (A + B))
            pts = [0] + [v for v in (p - 40 * sd, p - 10 * sd, p - 3 * sd, p) if 0 < v < X] + [X]
            q = mp.quad(f, sorted(set(pts)))
            cf = both_tails(a, b, x)[0]
            assert abs(q - cf) <= mp.mpf(10) ** -30 * cf, (a, b, x, q, cf)


if __name__ == "__main__":
    names = sys.argv[1:] or ["pbeta_large", "pbinom_large"]
    selfcheck()
    with Pool() as pool:
        if "pbeta_large" in names:
            cases = []
            for res in pool.map(beta_job, beta_jobs(), chunksize=1):
                if res is not None:
                    add_tails(cases, *res)
            write_fixture("audit_pbeta_large", cases)
        if "pbinom_large" in names:
            cases = []
            for res in pool.map(binom_job, binom_jobs(), chunksize=1):
                if res is not None:
                    add_tails(cases, *res)
            write_fixture("audit_pbinom_large", cases)
