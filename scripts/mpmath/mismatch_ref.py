"""Reference values (test/fixtures/<name>.ref.json) for the R-fixture cases of the special functions that disagree with R.

The R fixtures of choose, lchoose, factorial, lfactorial, digamma, trigamma, psigamma, the Bessel functions and
dmultinom have no Rmpfr reference functions (oracle/_reference.R), so the cases where the tests disagree with R are
given mpmath references instead. pbeta, pnbinom_mu and pnf (with ncp = 0) are supported too, for cases where R
is off by about 1e-14 and a change makes rStats.js more accurate (without R at hand to rerun the Rmpfr references). Each value is computed at two precisions and kept only if they agree.
New references are merged into an existing .ref.json (cases that already pass by their reference are not in the
mismatch file, so their references are kept).

    RSTATS_WRITE_MISMATCH=1 npx vitest run test/choose.test.ts ...   # writes test/fixtures/<name>.mismatch.json
    python3 -I scripts/mpmath/mismatch_ref.py choose lchoose ...      # writes test/fixtures/<name>.ref.json

The arguments are converted to the double values first (mp.mpf(float(s)), not mp.mpf(s), which would be the decimal).
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import FIXTURES

def P(v):
    if isinstance(v, bool): return v
    if isinstance(v, list): return [P(e) for e in v]
    return {"Inf": mp.inf, "-Inf": -mp.inf, "NaN": mp.nan}.get(v) if v in ("Inf", "-Inf", "NaN") else mp.mpf(float(v))

def rhe(x):  # round half to even
    return mp.nint(x)

def binom(n, k):
    k = rhe(k)
    if k < 0: return mp.mpf(0)
    return mp.binomial(n, k)

def lgam_abs(x):
    return mp.log(abs(mp.gamma(x)))

def scaled(v, x, s): return v * mp.exp(s * x)

def f(name, a):
    if name == "choose": return binom(P(a["n"]), P(a["k"]))
    if name == "lchoose": return mp.log(abs(binom(P(a["n"]), P(a["k"]))))
    if name == "factorial": return mp.gamma(P(a["x"]) + 1)
    if name == "lfactorial": return lgam_abs(P(a["x"]) + 1)
    if name == "digamma": return mp.psi(0, P(a["x"]))
    if name == "trigamma": return mp.psi(1, P(a["x"]))
    if name == "psigamma": return mp.psi(int(rhe(P(a["deriv"]))), P(a["x"]))
    if name.startswith("bessel"):
        x, nu, es = P(a["x"]), P(a["nu"]), a.get("exponScaled") is True
        if name == "besselI": return mp.besseli(nu, x) * (mp.exp(-x) if es else 1)
        if name == "besselK": return mp.besselk(nu, x) * (mp.exp(x) if es else 1)
        if name == "besselJ": return mp.besselj(nu, x)
        if name == "besselY": return mp.bessely(nu, x)
    if name == "dmultinom":
        xs = a["x"] if isinstance(a["x"], list) else [a["x"]]
        ps = a["prob"] if isinstance(a["prob"], list) else [a["prob"]]
        xs = [P(v) for v in xs]; ps = [P(v) for v in ps]
        s = mp.fsum(ps); N = mp.fsum(xs)
        l = mp.loggamma(N + 1) + mp.fsum((x * mp.log(p / s) if x > 0 else 0) - mp.loggamma(x + 1) for x, p in zip(xs, ps))
        return l if a["log"] is True else mp.exp(l)
    if name in ("pbeta", "pnbinom_mu", "pnf"):
        # (the incomplete beta function: pbeta, and pnbinom with mu and pf (ncp = 0) where they are
        # more accurate than R near the tolerance)
        if name == "pbeta":
            A, B, X, lower = P(a["shape1"]), P(a["shape2"]), P(a["q"]), a["lowerTail"]
        elif name == "pnbinom_mu":
            # P[X <= k] = I_p(size, k + 1) with p = size / (size + mu)
            n, mu = P(a["size"]), P(a["mu"])
            A, B, X, lower = n, mp.floor(P(a["q"])) + 1, n / (n + mu), a["lowerTail"]
        else:
            if P(a["ncp"]) != 0: raise ValueError(name)
            m, n, q = P(a["df1"]), P(a["df2"]), P(a["q"])
            A, B, X, lower = m / 2, n / 2, m * q / (m * q + n), a["lowerTail"]
        lo = mp.betainc(A, B, 0, X, regularized=True)
        v = lo if lower else 1 - lo
        return mp.log(v) if a["logP"] is True else v
    raise ValueError(name)

def ev(name, a, dps):
    with mp.workdps(dps):
        return +f(name, a)

def s17(v):
    if mp.isnan(v): return "NaN"
    if mp.isinf(v): return "Inf" if v > 0 else "-Inf"
    x = float(v)
    if x == float("inf"): return "Inf"
    if x == float("-inf"): return "-Inf"
    return "%.17g" % x

for name in sys.argv[1:]:
    cases = json.load(open(os.path.join(FIXTURES, name + ".mismatch.json")))
    out = []
    for a in cases:
        lo = {"psigamma": 400, "lfactorial": 700}.get(name, 100)
        v1, v2 = ev(name, a, lo), ev(name, a, 2 * lo)
        if not (mp.isnan(v1) and mp.isnan(v2)) and v1 != v2 and abs(v1 - v2) > abs(v2) * mp.mpf(10) ** -25:
            print("UNSTABLE", name, a, v1, v2, file=sys.stderr)
            continue
        if mp.isnan(v2):
            print("NAN", name, a, file=sys.stderr); continue
        out.append({"args": a, "reference": s17(v2)})
    path = os.path.join(FIXTURES, name + ".ref.json")
    merged = {json.dumps(o["args"], sort_keys=True): o for o in (json.load(open(path)) if os.path.exists(path) else [])}
    for o in out:
        merged[json.dumps(o["args"], sort_keys=True)] = o
    lines = ",\n".join("  " + json.dumps(o, separators=(",", ":")) for o in merged.values())
    open(path, "w").write("[\n" + lines + "\n]\n")
    print(name, len(cases), "->", len(out), "new,", len(merged), "in total")
