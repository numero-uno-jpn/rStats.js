"""Cross-check values for the Shapiro-Wilk core (src/htest/core/shapiro.ts; see _common.py).

SciPy's shapiro implements the same algorithm (Royston's AS R94) that R's shapiro.test uses; the core agrees
with it to 9e-12 (the test allows 1e-10). The comparison with R is left to the R
fixtures.
"""
import sys, os, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scipy import stats
from _common import write_fixture

rng = random.Random(20261024)
cases = []
for n in [3, 4, 5, 6, 7, 10, 11, 12, 13, 20, 50, 100, 500, 1000, 4999]:
    for kind in ["normal", "uniform", "exp", "t3"]:
        if kind == "normal":
            x = [rng.gauss(0, 1) for _ in range(n)]
        elif kind == "uniform":
            x = [rng.random() for _ in range(n)]
        elif kind == "exp":
            x = [rng.expovariate(1) for _ in range(n)]
        else:
            x = [rng.gauss(0, 1) / (sum(rng.gauss(0, 1) ** 2 for _ in range(3)) / 3) ** 0.5 for _ in range(n)]
        x = sorted(float("%.8g" % v) for v in x)
        r = stats.shapiro(x)
        cases.append(({"x": x, "what": "w"}, float(r.statistic), None))
        cases.append(({"x": x, "what": "p"}, float(r.pvalue), None))
write_fixture("swilk_scipy", cases)
