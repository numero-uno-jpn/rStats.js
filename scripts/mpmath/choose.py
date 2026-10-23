"""Reference values for choose, lchoose, factorial and lfactorial (see _common.py)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import write_fixture

mp.mp.dps = 60

ns = [0, 1, 2, 5, 10, 29, 30, 31, 50, 100, 1000, 1e5, 1e10, 1e15, 1e300,
      -1, -2, -5, -50, -1e5,
      1e-10, 0.5, 2.5, 4.3, 10.3, 29.7, 30.5, 99.9, 1234.567, 1e5 + 0.5, 1e12 + 0.25,
      -1e-10, -0.5, -2.7, -29.5, -1000.25]
ks = [0, 1, 2, 3, 5, 10, 20, 29, 30, 31, 50, 100, 500, 1000, 1e5]

cases_c, cases_l = [], []
for n in ns:
    for k in ks:
        with mp.workdps(700):
            c = mp.binomial(mp.mpf(n), k)
        cases_c.append(({"n": n, "k": k}, c, None))
        cases_l.append(({"n": n, "k": k}, mp.log(abs(c)) if c != 0 else mp.ninf, None))
write_fixture("choose", cases_c)
write_fixture("lchoose", cases_l)

xs = [0, 1, 2, 5, 10, 20, 50, 100, 150, 170, 170.5, 171, 172,
      1e-300, 1e-10, 1e-3, 0.1, 0.5, 0.9, 1.5, 2.5, 7.25, 33.3, 99.99,
      -1e-10, -0.1, -0.5, -0.9, -1.5, -2.5, -10.5, -100.5, -170.5]
cases_f, cases_lf = [], []
for x in xs:
    g = mp.gamma(mp.mpf(x) + 1)
    cases_f.append(({"x": x}, g, None))
for x in xs + [1e5, 1e10, 1e100, 1e300, 1e-200]:
    # enough digits that x + 1 is exact even for x = 1e-300
    with mp.workdps(700):
        X = mp.mpf(x) + 1
        v = mp.log(abs(mp.gamma(X))) if x < 1e3 else mp.loggamma(X)
    cases_lf.append(({"x": x}, v, None))
write_fixture("factorial", cases_f)
write_fixture("lfactorial", cases_lf)
