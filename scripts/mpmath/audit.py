"""Audit of the distribution functions beyond the R fixture grids (see _common.py).

Random parameters (fixed seed) over wide ranges, both tails and the log scale, checked against mpmath.
Each reference is computed at two precisions and kept only if they agree, and cases that take mpmath more
than a few seconds are skipped. Writes test/fixtures/audit_<name>.mpmath.json.

    python3 -I scripts/mpmath/audit.py [name ...]
"""
import sys, os, signal, random, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import write_fixture

SEED = 20261024
N = int(os.environ.get("AUDIT_N", "400"))
TIMEOUT = 3


class Timeout(Exception):
    pass


def _alarm(signum, frame):
    raise Timeout()


signal.signal(signal.SIGALRM, _alarm)


def stable(f):
    """f() at 40 and 90 digits; the value if they agree to 1e-25 relative, else None"""
    vals = []
    for dps in (40, 90):
        signal.alarm(TIMEOUT)
        try:
            with mp.workdps(dps):
                v = f()
                vals.append(+v)
        except (Timeout, ValueError, ZeroDivisionError, OverflowError, mp.libmp.libhyper.NoConvergence):
            return None
        finally:
            signal.alarm(0)
    a, b = vals
    with mp.workdps(90):
        if mp.isnan(a) or mp.isnan(b):
            return None
        if mp.isinf(a) or mp.isinf(b):
            return a if a == b else None
        if a == b or abs(a - b) <= mp.mpf(10) ** -25 * abs(b):
            return b
    return None


def logu(rng, lo, hi):
    return 10 ** rng.uniform(lo, hi)


def r4(x):
    return float("%.6g" % x)


def tails(cases, args, lower_val, upper_val, continuous=False):
    """Add the four lowerTail/logP combinations from the two tail probabilities (mpf). With continuous (a point
    inside the support of a continuous distribution), a tail of exactly 0 or 1 is an mpmath failure"""
    if continuous and any(v is not None and (v == 0 or v == 1) for v in (lower_val, upper_val)):
        return
    if lower_val is not None and upper_val is not None:
        with mp.workdps(90):
            if abs(lower_val + upper_val - 1) > mp.mpf(10) ** -30:
                return  # the two tails disagree: one of them is wrong
    for v in (lower_val, upper_val):
        # mpmath can return a tail of exactly 1 when the other one is tiny (betainc at 1 - 6e-119): a value near 1
        # is only kept when the other tail confirms it
        if v is not None and v == 1 and (lower_val is None or upper_val is None):
            return
    for lower in (True, False):
        v = lower_val if lower else upper_val
        other = upper_val if lower else lower_val
        if v is None:
            continue
        for logp in (False, True):
            with mp.workdps(90):
                if logp:
                    if v == 0:
                        e = mp.ninf
                    elif v > 0.5:
                        # log of a value near 1 from the other tail (1 - 1e-173 is 1 at 90 digits); without it
                        # the log cannot be formed accurately, so the case is left out
                        if other is None:
                            continue
                        e = mp.log1p(-other)
                    else:
                        e = mp.log(v)
                else:
                    e = v
            a = dict(args, lowerTail=lower, logP=logp)
            # log probabilities near 0 are measured as an absolute error
            cases.append((a, e, 1 if logp else None))


# ---- distribution functions ----

def p_gamma(rng):
    cases = []
    for _ in range(N):
        a = r4(logu(rng, -8, 8))
        x = r4(a * math.exp(rng.gauss(0, 1) * (3 if a > 10 else 6) / max(1, math.sqrt(a)) ** 0.5))
        if not (x > 0 and math.isfinite(x)):
            continue
        lo = stable(lambda: mp.gammainc(mp.mpf(a), 0, mp.mpf(x), regularized=True))
        up = stable(lambda: mp.gammainc(mp.mpf(a), mp.mpf(x), mp.inf, regularized=True))
        tails(cases, {"q": x, "shape": a}, lo, up)
    return cases


def p_beta(rng):
    cases = []
    for _ in range(N):
        a = r4(logu(rng, -6, 7))
        b = r4(logu(rng, -6, 7))
        m = a / (a + b)
        s = math.sqrt(a * b / ((a + b) ** 2 * (a + b + 1)))
        x = m + rng.gauss(0, 1) * s * rng.choice([1, 3, 10])
        if not (0 < x < 1):
            x = rng.uniform(0, 1) if rng.random() < 0.5 else logu(rng, -300, 0)
        x = r4(x)
        if not (0 < x < 1):
            continue
        lo = stable(lambda: mp.betainc(mp.mpf(a), mp.mpf(b), 0, mp.mpf(x), regularized=True))
        # the upper tail by symmetry (betainc(a, b, x, 1) is formed as 1 - lower and loses small values), with
        # 1 - x formed exactly (at 90 digits 1 - 1e-239 would be 1)
        with mp.workdps(400):
            xc = 1 - mp.mpf(x)
        up = stable(lambda: mp.betainc(mp.mpf(b), mp.mpf(a), 0, xc, regularized=True))
        tails(cases, {"q": x, "shape1": a, "shape2": b}, lo, up)
    return cases


def p_t(rng):
    cases = []
    for _ in range(N):
        df = r4(logu(rng, -2, 9))
        t = r4(rng.choice([1, -1]) * logu(rng, -10, 4 if df > 1 else 30))

        def lower():
            n, T = mp.mpf(df), mp.mpf(t)
            x = n / (n + T * T)
            tail = mp.betainc(n / 2, mp.mpf(1) / 2, 0, x, regularized=True) / 2
            return tail if T < 0 else 1 - tail

        def upper():
            n, T = mp.mpf(df), mp.mpf(t)
            x = n / (n + T * T)
            tail = mp.betainc(n / 2, mp.mpf(1) / 2, 0, x, regularized=True) / 2
            return tail if T > 0 else 1 - tail
        tails(cases, {"q": t, "df": df}, stable(lower), stable(upper))
    return cases


def p_binom(rng):
    cases = []
    for _ in range(N):
        n = float(round(logu(rng, 0, 9)))
        p = r4(rng.uniform(0, 1) if rng.random() < 0.6 else logu(rng, -12, 0))
        if not (0 < p < 1):
            continue
        mean, sd = n * p, math.sqrt(n * p * (1 - p))
        k = float(min(n, max(0, round(mean + rng.gauss(0, 1) * sd * rng.choice([1, 4, 15])))))
        # P[X <= k] = I_(1-p)(n - k, k + 1)
        lo = None if k >= n else stable(lambda: mp.betainc(n - k, k + 1, 0, 1 - mp.mpf(p), regularized=True))
        up = None if k >= n else stable(lambda: mp.betainc(k + 1, n - k, 0, mp.mpf(p), regularized=True))
        if k >= n:
            lo, up = mp.mpf(1), mp.mpf(0)
        tails(cases, {"q": k, "size": n, "prob": p}, lo, up)
    return cases


def p_pois(rng):
    cases = []
    for _ in range(N):
        lam = r4(logu(rng, -8, 9))
        k = float(max(0, round(lam + rng.gauss(0, 1) * math.sqrt(lam) * rng.choice([1, 4, 15]))))
        # P[X <= k] = Q(k + 1, lambda)
        lo = stable(lambda: mp.gammainc(k + 1, mp.mpf(lam), mp.inf, regularized=True))
        up = stable(lambda: mp.gammainc(k + 1, 0, mp.mpf(lam), regularized=True))
        tails(cases, {"q": k, "lambda": lam}, lo, up)
    return cases


def p_nbinom(rng):
    cases = []
    for _ in range(N):
        size = r4(logu(rng, -6, 8))
        mu = r4(logu(rng, -6, 9))
        p = size / (size + mu)
        sd = math.sqrt(mu + mu * mu / size)
        k = float(max(0, round(mu + rng.gauss(0, 1) * sd * rng.choice([1, 4, 15]))))

        def P():
            s, m = mp.mpf(size), mp.mpf(mu)
            return s / (s + m)
        lo = stable(lambda: mp.betainc(mp.mpf(size), k + 1, 0, P(), regularized=True))
        up = stable(lambda: mp.betainc(k + 1, mp.mpf(size), 0, 1 - P(), regularized=True))
        tails(cases, {"q": k, "size": size, "mu": mu}, lo, up)
    return cases


def p_norm(rng):
    cases = []
    for _ in range(N):
        q = r4(rng.choice([1, -1]) * logu(rng, -12, 2.6))
        lo = stable(lambda: mp.ncdf(mp.mpf(q)))
        up = stable(lambda: mp.ncdf(-mp.mpf(q)))
        tails(cases, {"q": q}, lo, up)
    return cases


# ---- densities ----

def dens(cases, args, f):
    v = stable(f)
    if v is None:
        return
    with mp.workdps(90):
        lv = mp.log(v) if v > 0 else mp.ninf
    cases.append((dict(args, log=False), v, None))
    cases.append((dict(args, log=True), lv, 1))


def d_gamma(rng):
    cases = []
    for _ in range(N):
        a = r4(logu(rng, -8, 8))
        x = r4(a * math.exp(rng.gauss(0, 1) * 3 / max(1, math.sqrt(a)) ** 0.5))
        if not (x > 0 and math.isfinite(x)):
            continue
        dens(cases, {"x": x, "shape": a},
             lambda: mp.exp((mp.mpf(a) - 1) * mp.log(mp.mpf(x)) - mp.mpf(x) - mp.loggamma(mp.mpf(a))))
    return cases


def d_beta(rng):
    cases = []
    for _ in range(N):
        a = r4(logu(rng, -4, 7))
        b = r4(logu(rng, -4, 7))
        m = a / (a + b)
        s = math.sqrt(a * b / ((a + b) ** 2 * (a + b + 1)))
        x = r4(m + rng.gauss(0, 1) * s * rng.choice([1, 3, 10]))
        if not (0 < x < 1):
            continue
        dens(cases, {"x": x, "shape1": a, "shape2": b}, lambda: mp.exp(
            (mp.mpf(a) - 1) * mp.log(mp.mpf(x)) + (mp.mpf(b) - 1) * mp.log1p(-mp.mpf(x))
            - mp.log(mp.beta(mp.mpf(a), mp.mpf(b)))))
    return cases


def d_binom(rng):
    cases = []
    for _ in range(N):
        n = float(round(logu(rng, 0, 12)))
        p = r4(rng.uniform(0, 1) if rng.random() < 0.6 else logu(rng, -12, 0))
        if not (0 < p < 1):
            continue
        mean, sd = n * p, math.sqrt(n * p * (1 - p))
        k = float(min(n, max(0, round(mean + rng.gauss(0, 1) * sd * rng.choice([1, 4, 15])))))
        dens(cases, {"x": k, "size": n, "prob": p}, lambda: mp.exp(
            mp.loggamma(n + 1) - mp.loggamma(k + 1) - mp.loggamma(n - k + 1)
            + k * mp.log(mp.mpf(p)) + (n - k) * mp.log1p(-mp.mpf(p))))
    return cases


def d_pois(rng):
    cases = []
    for _ in range(N):
        lam = r4(logu(rng, -8, 12))
        k = float(max(0, round(lam + rng.gauss(0, 1) * math.sqrt(lam) * rng.choice([1, 4, 15]))))
        dens(cases, {"x": k, "lambda": lam},
             lambda: mp.exp(k * mp.log(mp.mpf(lam)) - mp.mpf(lam) - mp.loggamma(k + 1)))
    return cases


def d_t(rng):
    cases = []
    for _ in range(N):
        df = r4(logu(rng, -2, 12))
        t = r4(rng.choice([1, -1]) * logu(rng, -10, 4 if df > 1 else 30))
        dens(cases, {"x": t, "df": df}, lambda: mp.exp(
            mp.loggamma((mp.mpf(df) + 1) / 2) - mp.loggamma(mp.mpf(df) / 2) - mp.log(mp.sqrt(mp.mpf(df) * mp.pi))
            - (mp.mpf(df) + 1) / 2 * mp.log1p(mp.mpf(t) ** 2 / mp.mpf(df))))
    return cases


def d_nbinom(rng):
    cases = []
    for _ in range(N):
        size = r4(logu(rng, -6, 10))
        mu = r4(logu(rng, -6, 10))
        sd = math.sqrt(mu + mu * mu / size)
        k = float(max(0, round(mu + rng.gauss(0, 1) * sd * rng.choice([1, 4, 15]))))

        def f():
            s, m = mp.mpf(size), mp.mpf(mu)
            return mp.exp(mp.loggamma(k + s) - mp.loggamma(s) - mp.loggamma(k + 1)
                          + s * mp.log(s / (s + m)) + k * mp.log(m / (s + m)))
        dens(cases, {"x": k, "size": size, "mu": mu}, f)
    return cases


def p_f(rng):
    cases = []
    for _ in range(N):
        d1 = r4(logu(rng, -2, 7))
        d2 = r4(logu(rng, -2, 7))
        x = r4(logu(rng, -6, 6) if rng.random() < 0.5 else math.exp(rng.gauss(0, 1)))
        # P[F <= x] = I_y(d1/2, d2/2) with y = d1 x / (d1 x + d2), 1 - y = d2 / (d1 x + d2)
        def lower():
            D1, D2, X = mp.mpf(d1), mp.mpf(d2), mp.mpf(x)
            return mp.betainc(D1 / 2, D2 / 2, 0, D1 * X / (D1 * X + D2), regularized=True)

        def upper():
            D1, D2, X = mp.mpf(d1), mp.mpf(d2), mp.mpf(x)
            return mp.betainc(D2 / 2, D1 / 2, 0, D2 / (D1 * X + D2), regularized=True)
        tails(cases, {"q": x, "df1": d1, "df2": d2}, stable(lower), stable(upper), continuous=True)
    return cases


def p_chisq(rng):
    cases = []
    for _ in range(N):
        df = r4(logu(rng, -3, 8))
        x = r4(df * math.exp(rng.gauss(0, 1) * (3 if df > 10 else 6) / max(1, math.sqrt(df)) ** 0.5))
        if not (x > 0 and math.isfinite(x)):
            continue
        lo = stable(lambda: mp.gammainc(mp.mpf(df) / 2, 0, mp.mpf(x) / 2, regularized=True))
        up = stable(lambda: mp.gammainc(mp.mpf(df) / 2, mp.mpf(x) / 2, mp.inf, regularized=True))
        tails(cases, {"q": x, "df": df}, lo, up)
    return cases


def p_hyper(rng):
    from math import comb
    from fractions import Fraction
    cases = []
    for _ in range(N):
        m = int(logu(rng, 0, 4))
        n = int(logu(rng, 0, 4))
        k = rng.randint(0, m + n)
        lo, hi = max(0, k - n), min(k, m)
        mean = k * m / (m + n)
        sd = math.sqrt(max(mean * (1 - m / (m + n)) * (m + n - k) / max(m + n - 1, 1), 1e-9))
        q = int(min(hi, max(lo, round(mean + rng.gauss(0, 1) * sd * rng.choice([1, 4, 15])))))
        tot = comb(m + n, k)
        le = sum(comb(m, x) * comb(n, k - x) for x in range(lo, q + 1))
        lv = Fraction(le, tot)
        with mp.workdps(90):
            L = mp.mpf(lv.numerator) / lv.denominator
            U = mp.mpf(tot - le) / tot
        tails(cases, {"q": q, "m": m, "n": n, "k": k}, L, U)
    return cases


def poisson_mixture(L, J, first_upper, last_lower, term0, ratio):
    """sum_j w_j F_j for the lower and upper tails F, with w_j = e^-L L^j / j! and
    F_lower(j) = F_lower(j+1) + T_j (summed downward from F_lower(J) = last_lower),
    F_upper(j+1) = F_upper(j) + T_j (summed upward from F_upper(0) = first_upper),
    T_0 = term0, T_(j+1) = T_j ratio(j). All additions are of positive terms."""
    T = [term0]
    for j in range(J):
        T.append(T[-1] * ratio(j))
    w = [mp.exp(-L)]
    for j in range(J):
        w.append(w[-1] * L / (j + 1))
    up, lo = mp.mpf(0), mp.mpf(0)
    F = first_upper
    for j in range(J + 1):
        up += w[j] * F
        F += T[j]
    F = last_lower
    for j in range(J, -1, -1):
        lo += w[j] * F
        if j > 0:
            F += T[j - 1]
    return lo, up


def p_nchisq(rng):
    cases = []
    for _ in range(N):
        df = r4(logu(rng, -2, 4))
        ncp = r4(logu(rng, -3, 3.3))
        mean = df + ncp
        x = r4(mean * math.exp(rng.gauss(0, 1) * 2 / max(1, math.sqrt(mean)) ** 0.5))
        if not (x > 0 and math.isfinite(x)):
            continue

        def both():
            # P(df/2 + j, x/2): T_j = X^(a+j) e^-X / Gamma(a+j+1), T_(j+1) = T_j X / (a+j+1)
            A, L, X = mp.mpf(df) / 2, mp.mpf(ncp) / 2, mp.mpf(x) / 2
            J = int(L + 60 * mp.sqrt(L) + 60)
            t0 = mp.exp(A * mp.log(X) - X - mp.loggamma(A + 1))
            return poisson_mixture(L, J, mp.gammainc(A, X, mp.inf, regularized=True),
                                   mp.gammainc(A + J, 0, X, regularized=True), t0, lambda j: X / (A + j + 1))
        lo = stable(lambda: both()[0])
        up = stable(lambda: both()[1])
        tails(cases, {"q": x, "df": df, "ncp": ncp}, lo, up)
    return cases


def p_nbeta(rng):
    cases = []
    for _ in range(N):
        a = r4(logu(rng, -1, 3))
        b = r4(logu(rng, -1, 3))
        ncp = r4(logu(rng, -3, 3.3))
        x = r4(rng.uniform(0, 1))
        if not 0 < x < 1:
            continue

        def both():
            # I_x(a + j, b): T_j = x^(a+j) (1-x)^b Gamma(a+j+b) / (Gamma(a+j+1) Gamma(b)), T_(j+1) = T_j x (a+j+b)/(a+j+1)
            A, B, L, X = mp.mpf(a), mp.mpf(b), mp.mpf(ncp) / 2, mp.mpf(x)
            J = int(L + 60 * mp.sqrt(L) + 60)
            t0 = mp.exp(A * mp.log(X) + B * mp.log1p(-X) + mp.loggamma(A + B) - mp.loggamma(A + 1) - mp.loggamma(B))
            return poisson_mixture(L, J, mp.betainc(B, A, 0, 1 - X, regularized=True),
                                   mp.betainc(A + J, B, 0, X, regularized=True), t0,
                                   lambda j: X * (A + j + B) / (A + j + 1))
        lo = stable(lambda: both()[0])
        up = stable(lambda: both()[1])
        tails(cases, {"q": x, "shape1": a, "shape2": b, "ncp": ncp}, lo, up)
    return cases

AUDITS = {
    "pgamma": p_gamma, "pbeta": p_beta, "pt": p_t, "pbinom": p_binom, "ppois": p_pois, "pnbinom": p_nbinom,
    "pnorm": p_norm, "dgamma": d_gamma, "dbeta": d_beta, "dbinom": d_binom, "dpois": d_pois, "dt": d_t,
    "dnbinom": d_nbinom, "pf": p_f, "pchisq": p_chisq, "phyper": p_hyper, "pnchisq": p_nchisq, "pnbeta": p_nbeta,
}

if __name__ == "__main__":
    names = sys.argv[1:] or list(AUDITS)
    for i, name in enumerate(AUDITS):
        if name not in names:
            continue
        rng = random.Random(SEED + i)
        write_fixture("audit_" + name, AUDITS[name](rng))
