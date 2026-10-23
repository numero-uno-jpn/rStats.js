"""Reference values for digamma, trigamma and psigamma (see _common.py).

For x < 0 the reflection formula psi^(n)(x) = (-1)^n psi^(n)(1 - x) - pi^(n+1) P_n(cot(pi x)) cancels near the
zeros, so "scale" records the size of its two terms.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import write_fixture

mp.mp.dps = 50

pos = [1e-300, 1e-100, 1e-10, 1e-5, 0.001, 0.1, 0.5, 1, 1.4616321449683623, 1.46, 1.47, 1.5, 2, 2.5, 3, 5,
       7.75, 9.5, 10, 10.5, 20, 33.3, 100, 1e3, 1e5, 1e8, 1e9, 1e15, 1e17, 1e100, 1e300]
neg = [-1e-10, -0.1, -0.3, -0.5, -0.504083008264455409, -0.6, -0.9, -1.5, -2.25, -2.5, -10.5, -10.4,
       -100.3, -1000.5, -100000.25]
# negative zeros of digamma and their neighbours
for k in range(1, 6):
    r = mp.findroot(mp.digamma, -k - mp.mpf(0.4))
    f = float(r)
    neg += [f, f + 1e-9, f - 1e-6]


def case(n, x):
    # mpmath's psi loses digits for x < 0 and large n at 50 digits (psi(100, -1.5) is off by 1e13 times), so
    # negative arguments are computed with 400 digits
    with mp.workdps(400 if x < 0 else 50):
        X = mp.mpf(x)
        v = mp.psi(n, X)
        scale = None
        if x < 0:
            a = mp.psi(n, 1 - X)
            scale = abs(a) + abs((-1) ** n * a - v)
        return +v, (+scale if scale is not None else None)


xs = pos + neg
write_fixture("digamma", [({"x": x}, *case(0, x)) for x in xs])
write_fixture("trigamma", [({"x": x}, *case(1, x)) for x in xs])
cases = []
for n in [0, 1, 2, 3, 5, 10, 20, 50, 100]:
    for x in xs:
        cases.append(({"x": x, "deriv": n}, *case(n, x)))
write_fixture("psigamma", cases)
