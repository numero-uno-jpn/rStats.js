"""Reference values for dmultinom (see _common.py)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import random
import mpmath as mp
from _common import write_fixture

mp.mp.dps = 60


def dmultinom(x, prob):
    with mp.workdps(200):
        P = [mp.mpf(p) for p in prob]
        s = mp.fsum(P)
        N = sum(x)
        lv = mp.loggamma(N + 1)
        for xi, pi in zip(x, P):
            if pi == 0:
                if xi > 0:
                    return mp.mpf(0), mp.ninf
                continue
            lv += xi * mp.log(pi / s) - mp.loggamma(xi + 1)
        return mp.exp(lv), lv


grid = [
    ([1, 2, 1], [0.2, 0.5, 0.3]),
    ([0, 0, 0], [0.2, 0.5, 0.3]),
    ([3, 0, 0], [1, 1, 1]),
    ([5, 0, 2], [0.5, 0, 0.5]),
    ([5, 1, 2], [0.5, 0, 0.5]),
    ([10, 20, 30, 40], [1, 2, 3, 4]),
    ([100, 200, 300], [0.1, 0.3, 0.6]),
    ([1000, 2000, 7000], [0.1, 0.2, 0.7]),
    ([100000, 200000, 700000], [0.1, 0.2, 0.7]),
    ([10**7, 2 * 10**7, 7 * 10**7], [0.1, 0.2, 0.7]),
    ([10**9, 1, 0], [1, 1e-12, 1e-300]),
    ([0, 0, 50], [1e-10, 1e-10, 1]),
    ([1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1] * 10),
    ([50, 0], [1e-300, 1]),
    ([2, 3], [1e-200, 1e-200]),
    ([7], [2.5]),
]
rng = random.Random(20261023)
for _ in range(60):
    K = rng.randint(2, 8)
    prob = [float("%.4g" % rng.uniform(0, 1)) for _ in range(K)]
    x = [rng.randint(0, 10 ** rng.randint(0, 6)) for _ in range(K)]
    grid.append((x, prob))
cases = []
for x, prob in grid:
    v, lv = dmultinom(x, prob)
    cases.append(({"x": x, "prob": prob, "log": False}, v, None))
    # log probabilities near 0 are measured as an absolute error (as for log densities)
    cases.append(({"x": x, "prob": prob, "log": True}, lv, 1))
write_fixture("dmultinom", cases)
