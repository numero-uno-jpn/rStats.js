"""Reference variance, sd, skewness and kurtosis of the Weibull and Kumaraswamy cases of distSummary (see _common.py).

oracle/distsummary.R computes them from the raw moments (gamma and beta functions), which cancels when the spread is
small against the mean (Weibull with shape 20 loses 9 digits of the kurtosis). Here the same formulas at 50 digits.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import FIXTURES, num2str

mp.mp.dps = 50

with open(os.path.join(FIXTURES, "distSummary.json")) as f:
    fx = json.load(f)
cases = []
for c in fx["cases"]:
    a = c["args"]
    if a["distribution"] == "weibull":
        k, lam = mp.mpf(float(a["shape"])), mp.mpf(float(a["scale"]))
        m = [lam ** i * mp.gamma(1 + i / k) for i in range(1, 5)]
    elif a["distribution"] == "kumar":
        A, B = mp.mpf(float(a["a"])), mp.mpf(float(a["b"]))
        m = [B * mp.beta(1 + i / A, B) for i in range(1, 5)]
    else:
        continue
    m1, m2, m3, m4 = m
    v = m2 - m1 ** 2
    c3 = m3 - 3 * m1 * m2 + 2 * m1 ** 3
    c4 = m4 - 4 * m1 * m3 + 6 * m1 ** 2 * m2 - 3 * m1 ** 4
    exp = {"mean": m1, "variance": v, "sd": mp.sqrt(v), "skewness": c3 / v ** 1.5, "kurtosis": c4 / v ** 2 - 3}
    cases.append({"args": a, "expected": {k2: num2str(v2) for k2, v2 in exp.items()}})
out = {"function": "distSummary", "generator": "mpmath " + mp.__version__, "cases": cases}
with open(os.path.join(FIXTURES, "distSummary.mpmath.json"), "w") as f:
    f.write(json.dumps(out, indent=1) + "\n")
print("distSummary: %d cases (mpmath %s)" % (len(cases), mp.__version__))
