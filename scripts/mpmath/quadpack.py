"""Reference values for the QUADPACK port (src/integrate/quadpack.ts; see _common.py).

SciPy runs the same QUADPACK routines (dqagse, dqagie) from the C translation that the port follows, so the
result, error estimate, number of evaluations, ier and number of subintervals should agree with SciPy's, up to the
last-bit differences of the integrands' libm calls. The integrands are named here and in the test.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scipy.integrate import _quadpack
from _common import write_fixture

F = {
    "gauss": lambda x: math.exp(-x * x),
    "invsqrt": lambda x: 1 / math.sqrt(x) if x > 0 else 0.0,
    "log": lambda x: math.log(x) if x > 0 else 0.0,
    "sinc": lambda x: math.sin(x) / x if x != 0 else 1.0,
    "pow09": lambda x: x ** -0.9 if x > 0 else 0.0,
    "cauchy": lambda x: 1 / (1 + x * x),
    "kink": lambda x: abs(x - 1 / 3),
    "dnorm": lambda x: math.exp(-x * x / 2) / math.sqrt(2 * math.pi),
    "gamma6": lambda x: math.exp(-x) * x ** 5,
    "betaprime": lambda x: 1 / ((x + 1) * math.sqrt(x)) if x > 0 else 0.0,
    "recip": lambda x: 1 / x,
    "cos100": lambda x: math.cos(100 * x),
    "sininv": lambda x: math.sin(1 / x),
    "step": lambda x: 1.0 if x < 0.3 else 0.0,
    "poly": lambda x: 3 * x ** 4 - 2 * x + 1,
}

FINITE = [("gauss", 0, 3), ("invsqrt", 0, 1), ("log", 0, 1), ("sinc", 0, 50), ("pow09", 0, 1), ("kink", 0, 1),
          ("dnorm", -1.96, 1.96), ("cos100", 0, math.pi), ("sininv", 0.01, 1), ("step", 0, 1), ("poly", -2, 5),
          ("recip", 1e-300, 1), ("gauss", 3, 0), ("sinc", 0, 1000)]
INFINITE = [("gauss", 0, 2), ("gauss", 0, 1), ("dnorm", 1.96, -1), ("cauchy", 0, 1), ("cauchy", 0, 2), ("gamma6", 0, 1),
            ("betaprime", 0, 1), ("recip", 1, 1), ("sinc", 1, 1), ("dnorm", -40, 1)]
TOLS = [(1.220703125e-4, 1.220703125e-4, 100), (1e-10, 1e-10, 100), (1e-13, 0, 50), (1.220703125e-4, 1.220703125e-4, 3)]

cases = []
for kind, items in (("agse", FINITE), ("agie", INFINITE)):
    for name, p, q in items:
        for epsrel, epsabs, limit in TOLS:
            if kind == "agse":
                out = _quadpack._qagse(F[name], float(p), float(q), (), 1, epsabs, epsrel, limit)
                args = {"kind": kind, "f": name, "a": float(p), "b": float(q)}
            else:
                out = _quadpack._qagie(F[name], float(p), int(q), (), 1, epsabs, epsrel, limit)
                args = {"kind": kind, "f": name, "bound": float(p), "inf": int(q)}
            result, abserr, info, ier = out[0], out[1], out[2], out[3]
            args.update({"epsrel": epsrel, "epsabs": epsabs, "limit": limit})
            for what, v in (("result", result), ("abserr", abserr), ("neval", info["neval"]), ("ier", ier),
                            ("last", info["last"])):
                cases.append((dict(args, what=what), float(v), None))
write_fixture("quadpack_scipy", cases)
