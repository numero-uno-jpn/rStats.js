"""Reference values for gammainc, erfinv and erfcinv at the inputs of the R fixtures (see _common.py).

R's values come from pgamma * gamma (each rounded, then multiplied) and from pracma's definitions through qnorm,
which lose the relative accuracy of a small argument of erfinv (erfinv(1e-300) is -0 there).
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import FIXTURES, num2str, write_fixture

mp.mp.dps = 80


def load(name):
    with open(os.path.join(FIXTURES, name + ".json")) as f:
        return json.load(f)["cases"]


def num(s):
    # the double the string stands for (mp.mpf of the string would take the decimal value)
    return {"NA": mp.nan, "NaN": mp.nan, "Inf": mp.inf, "-Inf": mp.ninf}.get(s) or mp.mpf(float(s))


def mplog(v):
    return mp.ninf if v == 0 else mp.log(v)


cases = []
for c in load("gammainc"):
    x, a = num(c["args"]["x"]), num(c["args"]["a"])
    if mp.isnan(x) or mp.isnan(a) or x < 0 or a <= 0:
        continue
    lo = mp.gammainc(a, 0, x)
    up = mp.gammainc(a, x, mp.inf)
    cases.append({"args": c["args"], "expected": [num2str(lo), num2str(up), num2str(mplog(lo)), num2str(mplog(up))]})
with open(os.path.join(FIXTURES, "gammainc.mpmath.json"), "w") as f:
    f.write(json.dumps({"function": "gammainc", "generator": "mpmath " + mp.__version__, "cases": cases}, indent=1) + "\n")
print("gammainc: %d cases" % len(cases))

def inv_erfc(z):
    """x with erfc(x) = z (0 <= z <= 2), solved directly (mpmath's erfinv near 1 and 1 - z lose digits)"""
    if z == 0:
        return mp.inf
    if z == 2:
        return mp.ninf
    if z > 1:
        return -inv_erfc(2 - z)
    x0 = mp.sqrt(-mp.log(z)) if z < 0.5 else (1 - z)
    return mp.findroot(lambda x: mp.log(mp.erfc(x)) - mp.log(z), x0, tol=mp.mpf(10) ** -55)


ei = []
for c in load("erfinv"):
    y = num(c["args"]["y"])
    if mp.isnan(y) or abs(y) > 1:
        continue
    # mpmath's erfinv for small |y| (1 - y would round at this precision), the erfc equation near +-1
    v = mp.erfinv(y) if abs(y) < 0.5 else (inv_erfc(1 - y) if y > 0 else -inv_erfc(1 + y))
    ei.append((c["args"], v, None))
write_fixture("erfinv", ei)
ec = []
for c in load("erfcinv"):
    z = num(c["args"]["y"])
    if mp.isnan(z) or z < 0 or z > 2:
        continue
    # erfc(x) = z: x = erfinv(1 - z), with 1 - z exact at this precision
    ec.append((c["args"], inv_erfc(z), None))
write_fixture("erfcinv", ec)
