"""Reference values for the Kolmogorov distribution (src/htest/core/kolmogorov.ts; see _common.py).

- pkolmogorov_exact: P(D_n < d) by the Marsaglia-Tsang-Wang matrix computed in exact rational arithmetic
  (d is a double, hence a rational), for n <= 40; with mpmath at 60 digits for larger n.
- pkolmogorov_limit: Kolmogorov's limiting distribution, from its two series in mpmath.
"""
import sys, os, random
from fractions import Fraction
from math import factorial, comb
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import write_fixture


def mtw(n, d, one, power):
    """P(D_n < d) by Marsaglia-Tsang-Wang with numbers of type `one` (Fraction or mpf)"""
    k = int(n * d) + 1
    m = 2 * k - 1
    h = k - n * d
    H = [[one if i - j + 1 >= 0 else 0 * one for j in range(m)] for i in range(m)]
    for i in range(m):
        H[i][0] -= power(h, i + 1)
        H[m - 1][i] -= power(h, m - i)
    if 2 * h - 1 > 0:
        H[m - 1][0] += power(2 * h - 1, m)
    for i in range(m):
        for j in range(m):
            if i - j + 1 > 0:
                H[i][j] /= factorial(i - j + 1)

    def mul(A, B):
        return [[sum(A[i][l] * B[l][j] for l in range(m)) for j in range(m)] for i in range(m)]
    R = None
    Bm = H
    p = n
    while p:
        if p & 1:
            R = Bm if R is None else mul(R, Bm)
        p >>= 1
        if p:
            Bm = mul(Bm, Bm)
    return R[k - 1][k - 1] * factorial(n) / power(one * n, n)


def exact(n, d):
    if d <= 1 / (2 * n):
        return mp.mpf(0)
    if d >= 1:
        return mp.mpf(1)
    if n <= 40:
        v = mtw(n, Fraction(d), Fraction(1), lambda a, b: a ** b)
        return mp.mpf(v.numerator) / v.denominator
    with mp.workdps(80):
        return +mtw(n, mp.mpf(d), mp.mpf(1), lambda a, b: a ** b)


def limit(x):
    """K(x) with 60 digits (both series agree; the faster one is used)"""
    X = mp.mpf(x)
    if x < 1:
        return mp.sqrt(2 * mp.pi) / X * mp.nsum(lambda j: mp.exp(-(2 * j - 1) ** 2 * mp.pi ** 2 / (8 * X * X)), [1, mp.inf])
    return 1 - 2 * mp.nsum(lambda j: (-1) ** (j - 1) * mp.exp(-2 * j * j * X * X), [1, mp.inf])


if __name__ == "__main__":
    mp.mp.dps = 60
    rng = random.Random(20261024)
    cases = []
    ns = [1, 2, 3, 5, 7, 10, 13, 20, 27, 40, 50, 80, 99]
    for n in ns:
        ds = [1 / (2 * n), 1 / (2 * n) * (1 + 1e-12), 1 / n, 0.5, 0.999, 1.0]
        ds += [float("%.6g" % rng.uniform(1 / (2 * n), min(1, 3 / n ** 0.5))) for _ in range(12 if n <= 40 else 5)]
        for d in ds:
            if n > 40 and n * d > 15:
                continue  # the 60-digit matrix power gets slow; these are covered by smaller n
            v = exact(n, d)
            cases.append(({"n": n, "d": d}, v, None))
    write_fixture("pkolmogorov_exact", cases)

    cases = []
    xs = [1e-3, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 0.9, 0.99, 1, 1.01, 1.2, 1.3581, 1.5, 2, 3, 4, 5, 6, 8, 10]
    xs += [float("%.6g" % rng.uniform(0.2, 4)) for _ in range(40)]
    for x in xs:
        k = limit(x)
        cases.append(({"x": x, "lowerTail": True}, k, None))
        cases.append(({"x": x, "lowerTail": False}, 1 - k if x < 1 else
                      2 * mp.nsum(lambda j: (-1) ** (j - 1) * mp.exp(-2 * j * j * mp.mpf(x) ** 2), [1, mp.inf]), None))
    write_fixture("pkolmogorov_limit", cases)

    # one-sided: Birnbaum-Tingey in exact rational arithmetic
    def one_sided(n, d):
        D = Fraction(d)
        if D <= 0:
            return Fraction(1)
        if D > 1:
            return Fraction(0)
        s = Fraction(0)
        j = 0
        while j <= n * (1 - D):
            a = D + Fraction(j, n)
            b = 1 - a
            s += comb(n, j) * b ** (n - j) * a ** (j - 1)
            j += 1
        return min(D * s, Fraction(1))
    cases = []
    for n in [1, 2, 3, 5, 10, 17, 30, 50, 100, 250, 500]:
        ds = [1e-9, 0.5 / n, 1 / n, 0.5, 0.9, 0.999, 1.0]
        ds += [float("%.6g" % rng.uniform(0, min(1, 4 / n ** 0.5))) for _ in range(10)]
        for d in ds:
            v = one_sided(n, d)
            cases.append(({"n": n, "d": d}, mp.mpf(v.numerator) / v.denominator, None))
    write_fixture("pkolmogorov_onesided_upper", cases)
