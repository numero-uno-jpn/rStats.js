"""Reference values for the d and p functions of invgamma, kumar, pareto, triang, laplace and arcsine (see _common.py).

extraDistr evaluates the textbook formulas directly, which loses accuracy in the tails (1 - x^a, 1 - p, log of a
probability that underflowed). The cases are those of the R fixtures (oracle/extradist.R) with valid finite
parameters; the values are the exact functions at the double inputs.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import FIXTURES, write_fixture

mp.mp.dps = 60


def num(s):
    return {"NA": float("nan"), "NaN": float("nan"), "Inf": float("inf"), "-Inf": float("-inf")}.get(s, None) if s in ("NA", "NaN", "Inf", "-Inf") else float(s)


def M(v):
    return mp.mpf(v)


def density(dist, x, P):
    """Density at x (mpf), or None outside the cases computed"""
    if dist == "invgamma":
        al, be = P["alpha"], P["beta"]
        if x <= 0:
            return mp.mpf(0)
        return mp.exp(al * mp.log(be) - (al + 1) * mp.log(x) - be / x - mp.loggamma(al))
    if dist == "kumar":
        a, b = P["a"], P["b"]
        if x < 0 or x > 1:
            return mp.mpf(0)
        if x == 0 or x == 1:
            return None
        return a * b * x ** (a - 1) * (1 - x ** a) ** (b - 1)
    if dist == "pareto":
        a, b = P["a"], P["b"]
        if x < b:
            return mp.mpf(0)
        return a / b * (b / x) ** (a + 1)
    if dist == "triang":
        a, b, c = P["a"], P["b"], P["c"]
        if x < a or x > b:
            return mp.mpf(0)
        if x < c:
            return 2 * (x - a) / ((b - a) * (c - a))
        if x == c:
            return 2 / (b - a)
        return 2 * (b - x) / ((b - a) * (b - c))
    if dist == "laplace":
        mu, s = P["mu"], P["sigma"]
        return mp.exp(-abs(x - mu) / s) / (2 * s)
    if dist == "arcsine":
        a, b = P["a"], P["b"]
        if x <= a or x >= b:
            return None if x in (a, b) else mp.mpf(0)
        return 1 / (mp.pi * mp.sqrt((x - a) * (b - x)))


def tails(dist, x, P):
    """(lower, upper) probabilities at x"""
    if dist == "invgamma":
        al, be = P["alpha"], P["beta"]
        if x <= 0:
            return mp.mpf(0), mp.mpf(1)
        z = be / x
        return mp.gammainc(al, z, mp.inf, regularized=True), mp.gammainc(al, 0, z, regularized=True)
    if dist == "kumar":
        a, b = P["a"], P["b"]
        if x <= 0:
            return mp.mpf(0), mp.mpf(1)
        if x >= 1:
            return mp.mpf(1), mp.mpf(0)
        t = b * mp.log1p(-x ** a)
        return -mp.expm1(t), mp.exp(t)
    if dist == "pareto":
        a, b = P["a"], P["b"]
        if x <= b:
            return mp.mpf(0), mp.mpf(1)
        t = a * mp.log(b / x)
        return -mp.expm1(t), mp.exp(t)
    if dist == "triang":
        a, b, c = P["a"], P["b"], P["c"]
        if x <= a:
            return mp.mpf(0), mp.mpf(1)
        if x >= b:
            return mp.mpf(1), mp.mpf(0)
        if x <= c:
            lo = (x - a) ** 2 / ((b - a) * (c - a))
            return lo, 1 - lo
        up = (b - x) ** 2 / ((b - a) * (b - c))
        return 1 - up, up
    if dist == "laplace":
        mu, s = P["mu"], P["sigma"]
        h = mp.exp(-abs(x - mu) / s) / 2
        return (h, 1 - h) if x < mu else (1 - h, h)
    if dist == "arcsine":
        a, b = P["a"], P["b"]
        if x <= a:
            return mp.mpf(0), mp.mpf(1)
        if x >= b:
            return mp.mpf(1), mp.mpf(0)
        return 2 / mp.pi * mp.asin(mp.sqrt((x - a) / (b - a))), 2 / mp.pi * mp.asin(mp.sqrt((b - x) / (b - a)))


def valid(dist, P):
    v = list(P.values())
    if any(p != p or abs(p) == float("inf") for p in v):
        return False
    if dist in ("invgamma", "kumar", "pareto"):
        return all(p > 0 for p in v)
    if dist == "triang":
        return P["a"] < P["b"] and P["a"] <= P["c"] <= P["b"]
    if dist == "laplace":
        return P["sigma"] > 0
    if dist == "arcsine":
        return P["a"] < P["b"]


PARAMS = {"invgamma": ["alpha", "beta"], "kumar": ["a", "b"], "pareto": ["a", "b"], "triang": ["a", "b", "c"],
          "laplace": ["mu", "sigma"], "arcsine": ["a", "b"]}


def mplog(v):
    return mp.ninf if v == 0 else mp.log(v)


for dist, names in PARAMS.items():
    for kind in "dp":
        name = kind + dist
        with open(os.path.join(FIXTURES, name + ".json")) as f:
            fx = json.load(f)
        cases = []
        for c in fx["cases"]:
            a = c["args"]
            P = {k: num(a[k]) for k in names}
            xs = a["x" if kind == "d" else "q"]
            x = num(xs)
            if not valid(dist, P) or x != x or abs(x) == float("inf"):
                continue
            Pm = {k: M(v) for k, v in P.items()}
            xm = M(x)
            if kind == "d":
                d = density(dist, xm, Pm)
                if d is None:
                    continue
                v = mplog(d) if a["log"] else d
            else:
                lo, up = tails(dist, xm, Pm)
                t, other = (lo, up) if a["lowerTail"] else (up, lo)
                # log of a probability near 1 from the other tail (1 - other would need more digits than dps)
                v = (mp.log1p(-other) if t > 0.5 else mplog(t)) if a["logP"] else t
            cases.append((a, v, None))
        write_fixture(name, cases)
