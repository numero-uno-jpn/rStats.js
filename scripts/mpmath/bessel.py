"""Reference values for besselI, besselK, besselJ and besselY (see _common.py).

R's conventions: x >= 0, any real order nu; for nu < 0, I and J/Y use A&S 9.6.2 and 9.1.2 (the
mathematical identities, so mpmath's own values apply), and K is symmetric in nu. "scale" for J and Y is
the amplitude sqrt(J^2 + Y^2) (the functions oscillate, so near their zeros the error is measured against
it); for I with nu < 0 it is |I_|nu|| + |2/pi sin(pi nu) K_|nu||, the two terms of the reflection formula.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import write_fixture

mp.mp.dps = 60

xs = [1e-300, 1e-10, 1e-3, 0.1, 0.5, 1, 1.5, 2, 2.5, 3, 5, 7.5, 10, 20, 30, 50, 75, 100, 200, 500, 1000,
      1e4, 1e5, 1e6]
nus = [0, 0.25, 0.5, 1, 1.5, 2, 2.75, 5, 10, 20, 50, 100, 500, 1000,
       -0.25, -0.5, -1, -1.5, -2.75, -5, -10.5, -50.3]


def ik(fn, x, nu, scaled):
    with mp.workdps(120):
        X, N = mp.mpf(x), mp.mpf(nu)
        v = fn(N, X)
        if scaled:
            v = v * mp.exp(-X if fn is mp.besseli else X)
        scale = None
        if fn is mp.besseli and nu < 0 and nu != int(nu):
            a = mp.besseli(-N, X)
            b = 2 / mp.pi * mp.sin(mp.pi * N) * mp.besselk(-N, X)
            scale = abs(a) + abs(b)
            if scaled:
                scale *= mp.exp(-X)
        return +v, (+scale if scale is not None else None)


for name, fn in [("besselI", mp.besseli), ("besselK", mp.besselk)]:
    cases = []
    for scaled in (False, True):
        for x in xs:
            for nu in nus:
                v, s = ik(fn, x, nu, scaled)
                cases.append(({"x": x, "nu": nu, "exponScaled": scaled}, v, s))
    write_fixture(name, cases)


def jy(fn, x, nu):
    with mp.workdps(120):
        X, N = mp.mpf(x), mp.mpf(nu)
        v = fn(N, X)
        scale = None
        # beyond the turning point J and Y oscillate: measure against the amplitude sqrt(J^2 + Y^2)
        if x > abs(nu):
            scale = mp.sqrt(mp.besselj(abs(N), X) ** 2 + mp.bessely(abs(N), X) ** 2)
        return +v, (+scale if scale is not None else None)


extra = []
with mp.workdps(60):
    for nu in (0, 1, 2.5, 10):
        for k in (1, 2, 5, 20):
            z = float(mp.besseljzero(nu, k))
            extra += [(z, nu), (z * (1 + 1e-12), nu)]
            zy = float(mp.besselyzero(nu, k))
            extra += [(zy, nu)]
for name, fn in [("besselJ", mp.besselj), ("besselY", mp.bessely)]:
    cases = []
    for x in xs:
        for nu in nus:
            v, s = jy(fn, x, nu)
            cases.append(({"x": x, "nu": nu}, v, s))
    for x, nu in extra:
        v, s = jy(fn, x, nu)
        cases.append(({"x": x, "nu": nu}, v, s))
    write_fixture(name, cases)


# Random cases (fixed seed) on top of the grid, to catch failures between grid points
import random
rng = random.Random(20261023)
rand = []
for _ in range(300):
    x = float("%.6g" % (10 ** rng.uniform(-5, 4)))
    nu = float("%.4g" % rng.uniform(-60, 60)) if rng.random() < 0.85 else float("%.4g" % (10 ** rng.uniform(2, 3.5)))
    rand.append((x, nu))
for name, fn, kind in [("besselI_random", mp.besseli, "ik"), ("besselK_random", mp.besselk, "ik"),
                       ("besselJ_random", mp.besselj, "jy"), ("besselY_random", mp.bessely, "jy")]:
    cases = []
    for x, nu in rand:
        try:
            if kind == "ik":
                v, s = ik(fn, x, nu, False)
                cases.append(({"x": x, "nu": nu, "exponScaled": False}, v, s))
            else:
                v, s = jy(fn, x, nu)
                cases.append(({"x": x, "nu": nu}, v, s))
        except ValueError:
            pass  # mpmath gives up on some extreme values (e.g. K with huge order and tiny x)
    write_fixture(name, cases)
