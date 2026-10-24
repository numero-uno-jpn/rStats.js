"""Reference values in regions where earlier versions lost accuracy (see _common.py). One fixture per function,
named <function>_regions:

- besselK, besselI: orders near the half-integers 0.5 ... 4.5 with small x (the three-term asymptotic expansion
  of K was entered there because only its third term was tested); besselI with negative order goes through K
- darcsine, parcsine, qarcsine: x near the ends of (a, b) with a != 0 (1 - (x - a) / (b - a) cancels)
- gammainc: a above 171.6 (Gamma(a) overflows and the value was formed as exp(lgamma(a) + log P))
- perm: overflow, non-integer k and k above 1000
- distSummary (lnorm): small sdlog (w^4 + 2 w^3 + 3 w^2 - 6 cancels)
- psigamma: x above 1e8 (the Hurwitz zeta was cut after two terms)
- beta: the larger argument at or above 2^52; choose: k - n not exact in double precision

Run with: python3 -I scripts/mpmath/regions.py  (needs mpmath; writes into test/fixtures)
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpmath as mp
from _common import FIXTURES, num2str, write_fixture

mp.mp.dps = 60


def checked(f, *args):
    """f evaluated at 120 and 240 digits; the two must agree to 40 digits"""
    with mp.workdps(120):
        a = f(*args)
    with mp.workdps(240):
        b = f(*args)
    if a != b and abs(a - b) > abs(b) * mp.mpf(10) ** -40:
        raise ValueError("mpmath disagrees with itself at %r" % (args,))
    return b


# ---- besselK / besselI near half-integer orders ----
def besselk(x, nu):
    return mp.besselk(mp.mpf(nu), mp.mpf(x))


def besseli_reflect(x, nu):
    # nu < 0: I_nu = I_|nu| + (2/pi) sin(pi |nu|) K_|nu| (A&S 9.6.2); scale = the two terms
    X, N = mp.mpf(x), -mp.mpf(nu)
    a = mp.besseli(N, X)
    b = 2 / mp.pi * mp.sin(mp.pi * N) * mp.besselk(N, X)
    return a + b, abs(a) + abs(b)


xs = [1e-3, 0.01, 0.05, 0.3, 1, 3, 10, 30, 100, 1e3]
nus = [2.500001, 2.49999, 2.5000001]
for h in (0.5, 1.5, 2.5, 3.5, 4.5):
    nus += [h, h + 1e-5, h - 1e-5, h + 1e-8, h - 1e-9, h + 1e-12, h - 3e-14]
kc, ic = [], []
for x in xs:
    for nu in nus:
        kc.append(({"x": x, "nu": nu, "exponScaled": False}, checked(besselk, x, nu), None))
        v = checked(lambda x, nu: besseli_reflect(x, nu)[0], x, -nu)
        with mp.workdps(240):
            s = besseli_reflect(x, -nu)[1]
        ic.append(({"x": x, "nu": -nu, "exponScaled": False}, v, s))
write_fixture("besselK_regions", kc)
write_fixture("besselI_regions", ic)

# ---- arcsine near the ends ----
mp.mp.dps = 80
ends = [(0.1, 1), (-1, 1), (2, 3.5), (-1000, 0.001), (0, 1), (1e-3, 1e-3 + 2 ** -20)]
fracs = [1e-15, 3e-12, 1.2345e-10, 1e-6, 0.01, 0.3]
dc, pc, qc = [], [], []
for a, b in ends:
    A, B = mp.mpf(a), mp.mpf(b)
    pts = set()
    for f in fracs:
        pts.add(float(B - f * (B - A)))
        pts.add(float(A + f * (B - A)))
    pts.add(0.999999999997 if b == 1 else float((A + B) / 2))
    pts.add(float(B) - 1.2345e-10 if b == 1 else float(B - (B - A) * mp.mpf(1e-9)))
    for x in sorted(pts):
        X = mp.mpf(x)
        if not (A < X < B):
            continue
        d = 1 / (mp.pi * mp.sqrt((X - A) * (B - X)))
        lo = 2 / mp.pi * mp.asin(mp.sqrt((X - A) / (B - A)))
        up = 2 / mp.pi * mp.asin(mp.sqrt((B - X) / (B - A)))
        for log in (False, True):
            dc.append(({"x": x, "a": a, "b": b, "log": log}, mp.log(d) if log else d, None))
        for lower in (True, False):
            for logp in (False, True):
                v = lo if lower else up
                pc.append(({"q": x, "a": a, "b": b, "lowerTail": lower, "logP": logp}, mp.log(v) if logp else v, None))
    def quantile(P, lower):
        """the quantile and its scale: the nearer end where the result lies far closer to 0 (a < 0 < b, around the
        crossing the result is a difference of that end and the distance from it, which no rounding of p survives)"""
        s = mp.sin(mp.pi * P / 2) ** 2
        v = A + (B - A) * s if lower else B - (B - A) * s
        e = A if v - A <= B - v else B
        return v, (abs(e) if abs(v) < abs(e) / 2 else None)

    for p in (1e-300, 1e-20, 1e-10, 1e-3, 0.3, 0.5, 0.9, 1 - 1e-12):
        lp = float(mp.log(p))
        for lower in (True, False):
            qc.append(({"p": p, "a": a, "b": b, "lowerTail": lower, "logP": False}, *quantile(mp.mpf(p), lower)))
            # the probability is exp of the double lp
            qc.append(({"p": lp, "a": a, "b": b, "lowerTail": lower, "logP": True}, *quantile(mp.exp(mp.mpf(lp)), lower)))
write_fixture("darcsine_regions", dc)
write_fixture("parcsine_regions", pc)
write_fixture("qarcsine_regions", qc)

# ---- gammainc with a above 171.6 ----
mp.mp.dps = 60


def mplog(v):
    return mp.ninf if v == 0 else mp.log(v)


def lower_series(a, x):
    """gamma(a, x) = x^a e^-x sum_n x^n / (a (a + 1) ... (a + n)) (DLMF 8.7.1), for x < a"""
    t = 1 / a
    s = t
    n = 0
    while abs(t) > abs(s) * mp.eps:
        n += 1
        t *= x / (a + n)
        s += t
    return mp.exp(a * mp.log(x) - x) * s


def upper_cf(a, x):
    """Gamma(a, x) by the continued fraction of DLMF 8.9.2 (modified Lentz), for x > a"""
    tiny = mp.mpf(10) ** (-mp.mp.dps * 4)
    b = x + 1 - a
    c = 1 / tiny
    d = 1 / b
    h = d
    i = 0
    while True:
        i += 1
        an = -i * (i - a)
        b += 2
        d = an * d + b
        d = tiny if d == 0 else d
        c = b + an / c
        c = tiny if c == 0 else c
        d = 1 / d
        delta = d * c
        h *= delta
        if abs(delta - 1) < mp.eps:
            break
    return mp.exp(a * mp.log(x) - x) * h


# the two series agree with mpmath where it converges
with mp.workdps(80):
    for a, x in ((5.5, 2.25), (30, 10), (30, 45), (200, 260)):
        A, X = mp.mpf(a), mp.mpf(x)
        f = lower_series if X < A else upper_cf
        g = mp.gammainc(A, 0, X) if X < A else mp.gammainc(A, X, mp.inf)
        assert abs(f(A, X) / g - 1) < mp.mpf(10) ** -70, (a, x)

pairs = [(13578.18, 1492.745), (2000, 200), (89.1377, 172.754), (1, 170), (2, 171), (1e-3, 200)]
for a in (171.7, 172, 180, 200, 500, 1492.745, 1e4, 1e5):
    for r in (0.01, 0.1, 0.5, 0.7, 0.85, 1.2, 1.5, 2, 5, 10, 50):
        pairs.append((float("%.10g" % (a * r)), a))
gc = []
for x, a in pairs:
    with mp.workdps(80):
        X, A = mp.mpf(x), mp.mpf(a)
        # the smaller tail directly (mpmath's series for the larger one does not converge for large a and x), the
        # other as Gamma(a) minus it
        if X < A:
            lo = lower_series(A, X)
            up = mp.gamma(A) - lo
        else:
            up = upper_cf(A, X)
            lo = mp.gamma(A) - up
    gc.append({"args": {"x": num2str(x), "a": num2str(a)},
               "expected": [num2str(lo), num2str(up), num2str(mplog(lo)), num2str(mplog(up))]})
with open(os.path.join(FIXTURES, "gammainc_regions.mpmath.json"), "w") as f:
    f.write(json.dumps({"function": "gammainc", "generator": "mpmath " + mp.__version__, "cases": gc}, indent=1) + "\n")
print("gammainc_regions: %d cases" % len(gc))

# ---- perm ----
pc2 = []
perm_pairs = [(1e300, 2), (186.08, 178), (715.12, 748), (1e6, 2.5), (2000, 1500), (2000, 1000.5), (1e4, 1500),
              (171.3, 171.3), (300.5, 300.5), (200.75, 201.25), (2.5, 4.5), (2.5, 3.7)]
for n in (0.5, 2.5, 10.3, 100.7, 170.2, 171.5, 200.25, 1000.5, 10000.3, 1e6, 1e10 + 0.75, 1e15 + 0.25, 1e300):
    for k in (0.5, 1.5, 2.5, 3.7, 10.25, 50.5, 100.3, 168.9, 999.5, 2, 5, 178, 1001, 1500):
        perm_pairs.append((n, k))
for n, k in perm_pairs:
    with mp.workdps(800):
        N, K = mp.mpf(n), mp.mpf(k)
        M = N - K + 1
        v = mp.mpf(0) if (M <= 0 and M == mp.floor(M)) else mp.gamma(N + 1) / mp.gamma(M)
    pc2.append(({"n": n, "k": k}, v, None))
write_fixture("perm_regions", pc2)

# ---- distSummary lnorm ----
mp.mp.dps = 60
lc = []
for meanlog in (0, 1.5):
    for sdlog in (1e-8, 1e-5, 1e-3, 0.01, 0.1, 0.5, 1, 2, 5, 10):
        s2 = mp.mpf(sdlog) ** 2
        w = mp.exp(s2)
        vals = {"variance": (w - 1) * mp.exp(2 * meanlog + s2), "skewness": (w + 2) * mp.sqrt(w - 1),
                "kurtosis": w ** 4 + 2 * w ** 3 + 3 * w ** 2 - 6}
        for field, v in vals.items():
            lc.append(({"meanlog": meanlog, "sdlog": sdlog, "field": field}, v, None))
write_fixture("distSummary_lnorm", lc)

# ---- psigamma above 1e8 ----
mp.mp.dps = 60
sc = []
for x in (1.0000001e8, 1e8 + 0.5, 2.5e8, 1e9, 1e12, 1e15):
    for n in (1, 2, 3, 5, 10, 20, 38, 50, 100):
        sc.append(({"x": x, "deriv": n}, mp.psi(n, mp.mpf(x)), None))
write_fixture("psigamma_large", sc)

# ---- beta with a huge argument, choose with k - n rounded ----
bc = []
for a in (2.0 ** 52, 3.05e19, 1e30, 1e300):
    for b in (1, 1.5, 11.96, 30.25, 100.5, 0.5, 0.01):
        with mp.workdps(700):
            v = mp.beta(mp.mpf(a), mp.mpf(b))
        bc.append(({"a": a, "b": b}, v, None))
write_fixture("beta_regions", bc)
cc = []
for n, k in [(191.38, 503), (100.3, 503), (0.7, 1000), (31.123, 64), (1.1, 300), (255.9, 1001), (512.3, 777)]:
    with mp.workdps(700):
        cc.append(({"n": n, "k": k}, mp.binomial(mp.mpf(n), k), None))
write_fixture("choose_regions", cc)
