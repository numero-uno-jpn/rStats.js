"""Reference values for Brent's localmin (src/optim/localmin.ts; see _common.py).

SciPy's bounded scalar minimiser follows the same procedure (netlib fmin.f), but with sqrt(2.2e-16) for the square
root of the machine epsilon and an evaluation limit. A copy with sqrt(2^-52) and no limit gives the reference
iterates, so the location, value and number of evaluations should agree exactly (up to libm differences in the
test functions).
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import write_fixture


def fmin(func, x1, x2, xatol):
    sqrt_eps = math.sqrt(2.0 ** -52)
    golden_mean = 0.5 * (3.0 - math.sqrt(5.0))
    a, b = x1, x2
    fulc = a + golden_mean * (b - a)
    nfc, xf = fulc, fulc
    rat = e = 0.0
    x = xf
    fx = func(x)
    num = 1
    ffulc = fnfc = fx
    xm = 0.5 * (a + b)
    tol1 = sqrt_eps * abs(xf) + xatol / 3.0
    tol2 = 2.0 * tol1
    while abs(xf - xm) > (tol2 - 0.5 * (b - a)):
        golden = 1
        if abs(e) > tol1:
            golden = 0
            r = (xf - nfc) * (fx - ffulc)
            q = (xf - fulc) * (fx - fnfc)
            p = (xf - fulc) * q - (xf - nfc) * r
            q = 2.0 * (q - r)
            if q > 0.0:
                p = -p
            q = abs(q)
            r = e
            e = rat
            if (abs(p) < abs(0.5 * q * r)) and (p > q * (a - xf)) and (p < q * (b - xf)):
                rat = (p + 0.0) / q
                x = xf + rat
                if ((x - a) < tol2) or ((b - x) < tol2):
                    si = math.copysign(1, xm - xf) if xm - xf != 0 else 1
                    rat = tol1 * si
            else:
                golden = 1
        if golden:
            e = a - xf if xf >= xm else b - xf
            rat = golden_mean * e
        si = (math.copysign(1, rat) if rat != 0 else 1)
        x = xf + si * max(abs(rat), tol1)
        fu = func(x)
        num += 1
        if fu <= fx:
            if x >= xf:
                a = xf
            else:
                b = xf
            fulc, ffulc = nfc, fnfc
            nfc, fnfc = xf, fx
            xf, fx = x, fu
        else:
            if x < xf:
                a = x
            else:
                b = x
            if (fu <= fnfc) or (nfc == xf):
                fulc, ffulc = nfc, fnfc
                nfc, fnfc = x, fu
            elif (fu <= ffulc) or (fulc == xf) or (fulc == nfc):
                fulc, ffulc = x, fu
        xm = 0.5 * (a + b)
        tol1 = sqrt_eps * abs(xf) + xatol / 3.0
        tol2 = 2.0 * tol1
    return xf, fx, num


F = {
    "quad": (lambda x: (x - 1 / 3) ** 2, 0, 1),
    "cos": (lambda x: math.cos(x), 0, 2 * math.pi),
    "abs": (lambda x: abs(x - 0.7), -3, 5),
    "rosen1": (lambda x: (1 - x) ** 2 + 100 * (x * x - x) ** 2, -2, 2),
    "expx": (lambda x: math.exp(x) - 2 * x, -10, 10),
    "flat": (lambda x: (x - 2) ** 4, 0, 5),
    "edge": (lambda x: x, 1, 3),
    "sinlog": (lambda x: math.sin(x) * math.log(x), 0.5, 10),
    "big": (lambda x: (x - 1e6) ** 2, 0, 2e6),
    "tiny": (lambda x: (x - 1e-9) ** 2, -1e-6, 1e-6),
}
cases = []
for name, (f, a, b) in F.items():
    for tol in (2.0 ** -13, 1e-8, 1e-12, 0.01):
        x, fx, num = fmin(f, float(a), float(b), tol)
        args = {"f": name, "lower": float(a), "upper": float(b), "tol": tol}
        for what, v in (("x", x), ("fx", fx), ("evaluations", num)):
            cases.append((dict(args, what=what), float(v), None))
write_fixture("localmin", cases)
