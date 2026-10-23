"""Audit of the quantile functions beyond the R fixture grids (see _common.py and audit.py).

Continuous distributions: the true quantile, solved in mpmath at 60 digits by bisection (geometric where the bracket
spans orders of magnitude). Each case carries as "scale" the error in x that the rounding of the given probability
alone produces, P / f(x) (times |log P| for log p): a quantile is measured relative to max(|x|, scale), its error
relative to its condition (qgamma with shape 0.005 multiplies the rounding of p by 1/shape = 200). Discrete distributions: the
smallest integer whose distribution function reaches p, found from mpmath's distribution function. Both tails, linear
p and log p. Writes test/fixtures/auditq_<name>.mpmath.json.

    python3 -I scripts/mpmath/audit_q.py [name ...]
"""
import sys, os, signal, random, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import write_fixture

SEED = 20261025
N = int(os.environ.get("AUDIT_N", "150"))
TIMEOUT = 20


class Timeout(Exception):
    pass


def _alarm(signum, frame):
    raise Timeout()


signal.signal(signal.SIGALRM, _alarm)


def logu(rng, lo, hi):
    return 10 ** rng.uniform(lo, hi)


def r6(x):
    return float("%.6g" % x)


def random_p(rng):
    """(p, logP): linear p over (0, 1) including far tails, or a log probability"""
    if rng.random() < 0.3:
        return -logu(rng, -10, 2.5), True
    k = rng.random()
    if k < 0.4:
        return rng.uniform(0, 1), False
    return logu(rng, -300, -1), False


def target(p, logp, lower):
    """the lower-tail probability to hit, as (value, use_upper): solve on the smaller tail for accuracy"""
    P = mp.exp(mp.mpf(p)) if logp else mp.mpf(p)
    return P if lower else 1 - P  # (exact enough at 60 digits for p >= 1e-300 only on the lower side)


def solve_continuous(cdf_lower, cdf_upper, p, logp, lower, lo, hi, sinh=False):
    """x with lower-tail (or upper-tail) probability p, by bisection to 1e-35 relative. With sinh, bisection runs on
    u = asinh(x), for ranges that span both signs over many orders of magnitude"""
    if sinh:
        with mp.workdps(60):
            u = solve_continuous(lambda t: cdf_lower(mp.sinh(t)), lambda t: cdf_upper(mp.sinh(t)), p, logp, lower,
                                 mp.asinh(mp.mpf(lo)), mp.asinh(mp.mpf(hi)))
            return None if u is None else mp.sinh(u)
    with mp.workdps(60):
        P = mp.exp(mp.mpf(p)) if logp else mp.mpf(p)
        f = (lambda x: cdf_lower(x) - P) if lower else (lambda x: P - cdf_upper(x))
        a, b = mp.mpf(lo), mp.mpf(hi)
        fa, fb = f(a), f(b)
        if fa > 0 or fb < 0:
            return None
        for _ in range(400):
            m = (a + b) / 2 if (a <= 0 or b / a < 4) else mp.sqrt(a * b)
            fm = f(m)
            if fm < 0:
                a = m
            else:
                b = m
            if b - a <= mp.mpf(10) ** -35 * max(abs(b), abs(a)) or b - a <= mp.mpf(10) ** -360:
                break
        return (a + b) / 2


def with_scale(x, dens, p, logp):
    """(x, scale) with scale = P / f(x) (times |log P| for log p): the change in x from a relative change of 1 in the
    given probability argument"""
    if x is None:
        return None
    with mp.workdps(60):
        P = mp.exp(mp.mpf(p)) if logp else mp.mpf(p)
        f = dens(x)
        if not f > 0:
            return None
        sc = P / f * (abs(mp.mpf(p)) if logp else 1)
        return x, (sc if sc > abs(x) else None)


def guarded(fn):
    signal.alarm(TIMEOUT)
    try:
        return fn()
    except (Timeout, ValueError, ZeroDivisionError, mp.libmp.libhyper.NoConvergence):
        return None
    finally:
        signal.alarm(0)


def q_norm(rng):
    cases = []
    for _ in range(N):
        p, logp = random_p(rng)
        for lower in (True, False):
            r = guarded(lambda: with_scale(solve_continuous(mp.ncdf, lambda t: mp.ncdf(-t), p, logp, lower, -40, 40),
                                           mp.npdf, p, logp))
            if r is not None:
                cases.append(({"p": p, "lowerTail": lower, "logP": logp}, *r))
    return cases


def q_gamma(rng):
    cases = []
    for _ in range(N):
        a = r6(logu(rng, -3, 6))
        p, logp = random_p(rng)
        A = mp.mpf(a)
        lo_f = lambda t: mp.gammainc(A, 0, t, regularized=True)
        up_f = lambda t: mp.gammainc(A, t, mp.inf, regularized=True)
        dens = lambda t: mp.exp((A - 1) * mp.log(t) - t - mp.loggamma(A))
        for lower in (True, False):
            r = guarded(lambda: with_scale(solve_continuous(lo_f, up_f, p, logp, lower, mp.mpf(10) ** -320,
                                                            a * 100 + 2000), dens, p, logp))
            if r is not None:
                cases.append(({"p": p, "shape": a, "lowerTail": lower, "logP": logp}, *r))
    return cases


def q_beta(rng):
    cases = []
    for _ in range(N):
        a = r6(logu(rng, -2, 4))
        b = r6(logu(rng, -2, 4))
        p, logp = random_p(rng)
        A, B = mp.mpf(a), mp.mpf(b)
        lo_f = lambda t: mp.betainc(A, B, 0, t, regularized=True)

        def up_f(t):
            # 1 - t loses t below 1e-60 at 60 digits: below 1/2 take 1 - lower tail while that is not small, and
            # otherwise work at enough digits to hold 1 - t exactly
            if t < 0.5:
                lo = lo_f(t)
                if lo < 0.9:
                    return 1 - lo
            with mp.workdps(max(60, int(-mp.log10(t)) + 60)):
                return mp.betainc(B, A, 0, 1 - t, regularized=True)
        dens = lambda t: mp.exp((A - 1) * mp.log(t) + (B - 1) * mp.log1p(-t) - mp.log(mp.beta(A, B)))
        for lower in (True, False):
            r = guarded(lambda: with_scale(solve_continuous(lo_f, up_f, p, logp, lower, mp.mpf(10) ** -320,
                                                            1 - mp.mpf(10) ** -30), dens, p, logp))
            if r is not None and r[0] < 1 - mp.mpf(2) ** -54:
                cases.append(({"p": p, "shape1": a, "shape2": b, "lowerTail": lower, "logP": logp}, *r))
    return cases


def q_t(rng):
    cases = []
    for _ in range(N):
        df = r6(logu(rng, -1, 6))
        p, logp = random_p(rng)
        n = mp.mpf(df)

        def tail(t):
            x = n / (n + t * t)
            return mp.betainc(n / 2, mp.mpf(1) / 2, 0, x, regularized=True) / 2
        lo_f = lambda t: tail(t) if t < 0 else 1 - tail(t)
        up_f = lambda t: tail(t) if t > 0 else 1 - tail(t)
        dens = lambda t: mp.exp(mp.loggamma((n + 1) / 2) - mp.loggamma(n / 2) - mp.log(n * mp.pi) / 2
                                - (n + 1) / 2 * mp.log1p(t * t / n))
        for lower in (True, False):
            r = guarded(lambda: with_scale(solve_continuous(lo_f, up_f, p, logp, lower, -mp.mpf(10) ** 300,
                                                            mp.mpf(10) ** 300, sinh=True), dens, p, logp))
            if r is not None:
                cases.append(({"p": p, "df": df, "lowerTail": lower, "logP": logp}, *r))
    return cases


def discrete(cdf_lower, cdf_upper, p, logp, lower, hi):
    """smallest integer y with P[X <= y] >= p (lower) or P[X > y] <= p (upper), by bisection on integers"""
    with mp.workdps(60):
        P = mp.exp(mp.mpf(p)) if logp else mp.mpf(p)
        ok = (lambda y: cdf_lower(y) >= P) if lower else (lambda y: cdf_upper(y) <= P)
        a, b = -1, int(hi)
        if not ok(b):
            return None
        while b - a > 1:
            m = (a + b) // 2
            if ok(m):
                b = m
            else:
                a = m
        return mp.mpf(b)


def q_pois(rng):
    cases = []
    for _ in range(N):
        lam = r6(logu(rng, -4, 7))
        p, logp = random_p(rng)
        L = mp.mpf(lam)
        lo_f = lambda y: mp.gammainc(y + 1, L, mp.inf, regularized=True)
        up_f = lambda y: mp.gammainc(y + 1, 0, L, regularized=True)
        for lower in (True, False):
            y = guarded(lambda: discrete(lo_f, up_f, p, logp, lower, lam * 3 + 60 * math.sqrt(lam) + 2000))
            if y is not None:
                cases.append(({"p": p, "lambda": lam, "lowerTail": lower, "logP": logp}, y, None))
    return cases


def q_binom(rng):
    cases = []
    for _ in range(N):
        n = float(round(logu(rng, 0, 7)))
        pr = r6(rng.uniform(0, 1) if rng.random() < 0.6 else logu(rng, -10, 0))
        if not 0 < pr < 1:
            continue
        p, logp = random_p(rng)
        PR = mp.mpf(pr)
        lo_f = lambda y: mp.mpf(1) if y >= n else mp.betainc(n - y, y + 1, 0, 1 - PR, regularized=True)
        up_f = lambda y: mp.mpf(0) if y >= n else mp.betainc(y + 1, n - y, 0, PR, regularized=True)
        for lower in (True, False):
            y = guarded(lambda: discrete(lo_f, up_f, p, logp, lower, n))
            if y is not None:
                cases.append(({"p": p, "size": n, "prob": pr, "lowerTail": lower, "logP": logp}, y, None))
    return cases


AUDITS = {"qnorm": q_norm, "qgamma": q_gamma, "qbeta": q_beta, "qt": q_t, "qpois": q_pois, "qbinom": q_binom}

if __name__ == "__main__":
    names = sys.argv[1:] or list(AUDITS)
    for i, name in enumerate(AUDITS):
        if name in names:
            write_fixture("auditq_" + name, AUDITS[name](random.Random(SEED + i)))
