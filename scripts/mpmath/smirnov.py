"""Reference values for the exact two-sample Smirnov distribution (src/htest/core/smirnov.ts; see _common.py).

P(D >= d) by counting lattice paths in exact integer arithmetic (the number of paths that first reach the boundary
at each point times the number of ways to finish), checked against brute-force enumeration for small samples.
"""
import sys, os, random, itertools
from fractions import Fraction
from math import comb
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import write_fixture

FUZZ = Fraction(1) - Fraction(1e-10)


def observed_steps(m, n, z):
    N = m + n
    if z is None:
        return [0 < s < N for s in range(N + 1)]
    zs = sorted(z)
    return [False] + [zs[s] != zs[s - 1] for s in range(1, N)] + [False]


def crosses(i, j, m, n, d, alt):
    diff = i * n - j * m
    v = abs(diff) if alt == "two.sided" else diff if alt == "greater" else -diff
    return v >= Fraction(d) * m * n * FUZZ


def upper_exact(d, m, n, alt="two.sided", z=None):
    if d <= 0:
        return Fraction(1)
    if d > 1:
        return Fraction(0)
    N = m + n
    obs = observed_steps(m, n, z)
    good = [[0] * (n + 1) for _ in range(m + 1)]
    total = 0
    for i in range(m + 1):
        for j in range(n + 1):
            if i == 0 and j == 0:
                good[0][0] = 1
                continue
            reach = (good[i - 1][j] if i > 0 else 0) + (good[i][j - 1] if j > 0 else 0)
            if obs[i + j] and crosses(i, j, m, n, d, alt):
                total += reach * comb(N - i - j, m - i)
                good[i][j] = 0
            else:
                good[i][j] = reach
    return Fraction(total, comb(N, m))


def upper_brute(d, m, n, alt="two.sided", z=None):
    """Enumerate which positions of the sorted pooled sample belong to x"""
    N = m + n
    obs = observed_steps(m, n, z)
    hit = 0
    count = 0
    for xs in itertools.combinations(range(N), m):
        xset = set(xs)
        i = j = 0
        best = None
        for s in range(1, N + 1):
            if s - 1 in xset:
                i += 1
            else:
                j += 1
            if obs[s] and crosses(i, j, m, n, d, alt):
                best = True
                break
        hit += 1 if best else 0
        count += 1
    return Fraction(hit, count)


if __name__ == "__main__":
    mp.mp.dps = 60
    rng = random.Random(20261024)
    # brute-force check of the counting
    for _ in range(300):
        m, n = rng.randint(1, 7), rng.randint(1, 7)
        alt = rng.choice(["two.sided", "less", "greater"])
        z = None if rng.random() < 0.5 else [rng.randint(0, 3) for _ in range(m + n)]
        i, j = rng.randint(0, m), rng.randint(0, n)
        d = abs(i * n - j * m) / (m * n) or 1 / (m * n)
        assert upper_exact(d, m, n, alt, z) == upper_brute(d, m, n, alt, z), (d, m, n, alt, z)
    print("counting agrees with brute force")

    cases = []
    sizes = [(1, 1), (1, 5), (3, 4), (5, 5), (7, 13), (10, 10), (20, 30), (25, 25), (40, 60), (100, 100),
             (37, 211), (150, 230), (300, 300)]
    sizes += [(rng.randint(1, 80), rng.randint(1, 80)) for _ in range(25)]
    for m, n in sizes:
        for _ in range(6):
            alt = rng.choice(["two.sided", "two.sided", "less", "greater"])
            ties = rng.random() < 0.3
            z = [rng.randint(0, max(2, (m + n) // 4)) for _ in range(m + n)] if ties else None
            i, j = rng.randint(0, m), rng.randint(0, n)
            d = abs(i * n - j * m) / (m * n) or 1 / (m * n)
            v = upper_exact(d, m, n, alt, z)
            args = {"d": d, "m": m, "n": n, "alternative": alt}
            if z is not None:
                args["z"] = z
            cases.append((args, mp.mpf(v.numerator) / v.denominator, None))
    write_fixture("psmirnov_upper", cases)
