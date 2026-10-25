#!/usr/bin/env python3
"""Generator that expands double-double arithmetic into expressions over local variables only,
without allocating arrays.

The expanded code in src/special/dd.ts and src/special/loader.ts was produced by this script
(docs/performance.md). twoSum, quickTwoSum and twoProd (Dekker / Knuth) are written out with the
same operations in the same order as the building blocks in dd.ts, so the results are bit-for-bit
identical to calling the building blocks. To change an expression, change it here, regenerate and
paste the output into the corresponding place.

  python3 scripts/ddgen.py ops     ddAdd, ddNeg, ddSub, ddMul, ddMulNum, ddDiv, ddDivNum in dd.ts
  python3 scripts/ddgen.py bd0dd   bd0dd in loader.ts: d = x - M and the series part (with the tail in double
                                   precision where its rounding is negligible)
  python3 scripts/ddgen.py ddlog   ddLog in dd.ts: the part after the table lookup (from after const lc = ...)
  python3 scripts/ddgen.py scalar  sDiv in incbet.ts (ddDiv with the result in R[0], R[1])
  python3 scripts/ddgen.py cf      the double-double loop of continuedFractionCore in incbet.ts

Variable names: s, e are the sum and error of twoSum / quickTwoSum; p, e are the product and error
of twoProd; q is a quotient; n is a negated value. Numbers are sequential in order of appearance.
"""

import sys


class G:
    """Accumulates the expanded expressions line by line. Each method returns the variable names (or expressions) of the result (hi, lo)"""

    def __init__(self, ind="  "):
        self.n = 0
        self.lines = []
        self.ind = ind

    def v(self, prefix):
        self.n += 1
        return f"{prefix}{self.n}"

    def emit(self, line):
        self.lines.append(self.ind + line)

    def two_sum(self, a, b):
        x, bb, e = self.v("s"), self.v("bb"), self.v("e")
        self.emit(f"const {x} = {a} + {b};")
        self.emit(f"const {bb} = {x} - {a};")
        self.emit(f"const {e} = {a} - ({x} - {bb}) + ({b} - {bb});")
        return x, e

    def quick(self, a, b):
        x, e = self.v("s"), self.v("e")
        self.emit(f"const {x} = {a} + {b};")
        self.emit(f"const {e} = {b} - ({x} - {a});")
        return x, e

    def two_prod(self, a, b):
        p, t1, ah, al, t2, bh, bl, e = [self.v(k) for k in ("p", "t", "ah", "al", "t", "bh", "bl", "e")]
        self.emit(f"const {p} = {a} * {b};")
        self.emit(f"const {t1} = SPLITTER * {a};")
        self.emit(f"const {ah} = {t1} - ({t1} - {a});")
        self.emit(f"const {al} = {a} - {ah};")
        self.emit(f"const {t2} = SPLITTER * {b};")
        self.emit(f"const {bh} = {t2} - ({t2} - {b});")
        self.emit(f"const {bl} = {b} - {bh};")
        self.emit(f"const {e} = {ah} * {bh} - {p} + {ah} * {bl} + {al} * {bh} + {al} * {bl};")
        return p, e

    def add(self, a, b):
        x, e = self.two_sum(a[0], b[0])
        t, f = self.two_sum(a[1], b[1])
        u = self.v("u")
        self.emit(f"const {u} = {e} + {t};")
        x2, e2 = self.quick(x, u)
        w = self.v("w")
        self.emit(f"const {w} = {e2} + {f};")
        return self.quick(x2, w)

    def neg(self, a):
        x, y = self.v("n"), self.v("n")
        self.emit(f"const {x} = -{a[0]};")
        self.emit(f"const {y} = -{a[1]};")
        return x, y

    def sub(self, a, b):
        return self.add(a, self.neg(b))

    def mul(self, a, b):
        p, e = self.two_prod(a[0], b[0])
        u = self.v("u")
        self.emit(f"const {u} = {e} + ({a[0]} * {b[1]} + {a[1]} * {b[0]});")
        return self.quick(p, u)

    def mul_num(self, a, b):
        p, e = self.two_prod(a[0], b)
        u = self.v("u")
        self.emit(f"const {u} = {e} + {a[1]} * {b};")
        return self.quick(p, u)

    def div(self, a, b):
        q1 = self.v("q")
        self.emit(f"const {q1} = {a[0]} / {b[0]};")
        r = self.sub(a, self.mul_num(b, q1))
        q2 = self.v("q")
        self.emit(f"const {q2} = {r[0]} / {b[0]};")
        r2 = self.sub(r, self.mul_num(b, q2))
        q3 = self.v("q")
        self.emit(f"const {q3} = {r2[0]} / {b[0]};")
        return self.add(self.quick(q1, q2), (q3, "0"))

    def div_num(self, a, b):
        return self.div(a, (b, "0"))


def gen_ops():
    """The building blocks in dd.ts (with the branch for double-precision mode)"""
    out = []

    def fn(name, sig, build, double_ret):
        g = G()
        r = build(g)
        out.append(f"export function {name}({sig}): DD {{")
        out.append(f"  if (!ddEnabled) return {double_ret};")
        out.extend(g.lines)
        out.append(f"  return [{r[0]}, {r[1]}];")
        out.append("}\n")

    A = ("a[0]", "a[1]")
    B = ("b[0]", "b[1]")
    fn("ddAdd", "a: DD, b: DD", lambda g: g.add(A, B), "[a[0] + b[0], 0]")
    out.append("export function ddNeg(a: DD): DD {\n  return [-a[0], -a[1]];\n}\n")
    fn("ddSub", "a: DD, b: DD", lambda g: g.sub(A, B), "[a[0] - b[0], 0]")
    fn("ddMul", "a: DD, b: DD", lambda g: g.mul(A, B), "[a[0] * b[0], 0]")
    fn("ddMulNum", "a: DD, b: number", lambda g: g.mul_num(A, "b"), "[a[0] * b, 0]")
    fn("ddDiv", "a: DD, b: DD", lambda g: g.div(A, B), "[a[0] / b[0], 0]")
    fn("ddDivNum", "a: DD, b: number", lambda g: g.div_num(A, "b"), "[a[0] / b, 0]")
    return "\n".join(out)


def gen_bd0dd():
    """bd0dd: d = x - M and the series used when x and M are close (same operations as bd0ddOps)"""
    g = G("  ")
    d = g.sub(("x", "0"), ("M[0]", "M[1]"))
    g.emit(f"const dh = {d[0]};")
    g.emit(f"const dl = {d[1]};")
    g.emit("if (Math.abs(dh) < 0.1 * (x + M[0])) {")
    h = G("    ")
    h.n = g.n
    xm = h.add(("x", "0"), ("M[0]", "M[1]"))
    v = h.div(("dh", "dl"), xm)
    h.emit(f"const vh = {v[0]};")
    h.emit(f"const vl = {v[1]};")
    s = h.mul(("dh", "dl"), ("vh", "vl"))
    h.emit(f"let sh = {s[0]};")
    h.emit(f"let sl = {s[1]};")
    # The tail 2x (v^3/3 + v^5/5 + ...) in double precision when its rounding (at most 3 eps |tail|, including
    # the dropped low part of v) stays below eps/4 in absolute terms: |tail| <= 2|x v^3|/(3 (1 - v^2)) <= 1/12
    h.emit("if (Math.abs(x * vh * vh * vh) <= TAIL_IN_DOUBLE) {")
    h.emit("  const vv = vh * vh;")
    h.emit("  let ej = 2 * x * vh * vv;")
    h.emit("  let tail = ej / 3;")
    h.emit("  for (let j = 2; j < 1000; j++) {")
    h.emit("    ej *= vv;")
    h.emit("    const t = ej / (2 * j + 1);")
    h.emit("    tail += t;")
    h.emit("    if (Math.abs(t) <= 2 ** -60 * sh) break;")
    h.emit("  }")
    tl = G("      ")
    tl.n = h.n
    r = tl.add(("sh", "sl"), ("tail", "0"))
    h.lines += tl.lines
    h.n = tl.n
    h.emit(f"  return [{r[0]}, {r[1]}];")
    h.emit("}")
    h.emit("const x2 = 2 * x;")
    ej = h.mul_num(("vh", "vl"), "x2")
    h.emit(f"let ejh = {ej[0]};")
    h.emit(f"let ejl = {ej[1]};")
    v2 = h.mul(("vh", "vl"), ("vh", "vl"))
    h.emit(f"const v2h = {v2[0]};")
    h.emit(f"const v2l = {v2[1]};")
    h.emit("for (let j = 1; j < 1000; j++) {")
    lp = G("      ")
    lp.n = h.n
    e2 = lp.mul(("ejh", "ejl"), ("v2h", "v2l"))
    lp.emit(f"ejh = {e2[0]};")
    lp.emit(f"ejl = {e2[1]};")
    lp.emit("const dv = 2 * j + 1;")
    t = lp.div_num(("ejh", "ejl"), "dv")
    s1 = lp.add(("sh", "sl"), t)
    lp.emit(
        f"if (Math.abs({t[0]}) <= 1e-33 * Math.abs({s1[0]}) || ({s1[0]} === sh && {s1[1]} === sl)) "
        f"return [{s1[0]}, {s1[1]}];"
    )
    lp.emit(f"sh = {s1[0]};")
    lp.emit(f"sl = {s1[1]};")
    h.lines += lp.lines
    h.emit("}")
    h.emit("return [sh, sl];")
    g.lines += h.lines
    g.emit("}")
    return "\n".join(g.lines)


def gen_ddlog(n=128, J=5):
    """ddLog after the table lookup: s = (m - c)/(m + c), atanh by Horner's method of degree J, then add log c and k log 2"""
    g = G("  ")
    a = g.sub(("m0", "m1"), ("c", "0"))
    b = g.add(("m0", "m1"), ("c", "0"))
    s = g.div(a, b)
    s2 = g.mul(s, s)
    p = (f"RECIP[{J}]![0]", f"RECIP[{J}]![1]")
    for j in range(J - 1, -1, -1):
        p = g.add(g.mul(p, s2), (f"RECIP[{j}]![0]", f"RECIP[{j}]![1]"))
    at = g.mul_num(g.mul(s, p), "2")
    lm = g.add(("lc[0]", "lc[1]"), at)
    r = g.add(lm, g.mul_num(("LN2[0]", "LN2[1]"), "k"))
    g.emit(f"return [{r[0]}, {r[1]}];")
    return "\n".join(g.lines)


def gen_scalar():
    """sDiv for incbet.ts: ddDiv with the same operations as in dd.ts, taking hi and lo as separate arguments and
    leaving the result in R[0], R[1] (a Float64Array) instead of allocating an array (used by the loop of the
    continued fraction)"""
    out = []

    def fn(name, sig, build):
        g = G()
        r = build(g)
        out.append(f"function {name}({sig}): void {{")
        out.extend(g.lines)
        out.append(f"  R[0] = {r[0]};")
        out.append(f"  R[1] = {r[1]};")
        out.append("}\n")

    A = ("ah", "al")
    B = ("bh", "bl")
    fn("sDiv", "ah: number, al: number, bh: number, bl: number", lambda g: g.div(A, B))
    return "\n".join(out)


def div_call(g, a, b):
    """Division through the scalar helper sDiv (result in R): the same operations as div, without repeating them"""
    qh, ql = g.v("qh"), g.v("ql")
    g.emit(f"sDiv({a[0]}, {a[1]}, {b[0]}, {b[1]});")
    g.emit(f"const {qh} = R[0]!;")
    g.emit(f"const {ql} = R[1]!;")
    return qh, ql


def gen_cf():
    """The double-double loop of continuedFractionCore in incbet.ts: the same operations as
    continuedFractionCoreOps, in the same order, on local variables. Additions and products are written out;
    divisions call sDiv (python3 scripts/ddgen.py scalar), which keeps the code about half as long"""
    g = G("  ")
    g.emit("let zh = xd[0];")
    g.emit("let zl = xd[1];")
    g.emit("if (second) {")
    g.emit("  sDiv(xd[0], xd[1], xcd[0], xcd[1]);")
    g.emit("  zh = R[0]!;")
    g.emit("  zl = R[1]!;")
    g.emit("}")
    k2a = g.two_sum("b", "-1")
    k2b = g.two_sum("a", "b")
    g.emit(f"let k2h = second ? {k2a[0]} : {k2b[0]};")
    g.emit(f"let k2l = second ? {k2a[1]} : {k2b[1]};")
    g.emit(f"let k6h = second ? {k2b[0]} : {k2a[0]};")
    g.emit(f"let k6l = second ? {k2b[1]} : {k2a[1]};")
    for line in ("let k1 = a;", "let k3 = a;", "let k4 = a + 1;", "let k5 = 1;", "let k7 = a + 1;", "let k8 = a + 2;",
                 "const d1 = second ? -1 : 1;", "const nd1 = -d1;"):
        g.emit(line)
    for v, (hi, lo) in (("pkm2", ("0", "0")), ("qkm2", ("1", "0")), ("pkm1", ("1", "0")), ("qkm1", ("1", "0")), ("ans", ("1", "0"))):
        g.emit(f"let {v}h = {hi};")
        g.emit(f"let {v}l = {lo};")
    g.emit("for (let n = 0; n < 100000; n++) {")
    L = G("    ")
    L.n = g.n
    Z = ("zh", "zl")
    pkm2, qkm2, pkm1, qkm1 = ("pkm2h", "pkm2l"), ("qkm2h", "qkm2l"), ("pkm1h", "pkm1l"), ("qkm1h", "qkm1l")

    def shift(pk, qk):
        for line in ("pkm2h = pkm1h;", "pkm2l = pkm1l;", f"pkm1h = {pk[0]};", f"pkm1l = {pk[1]};",
                     "qkm2h = qkm1h;", "qkm2l = qkm1l;", f"qkm1h = {qk[0]};", f"qkm1l = {qk[1]};"):
            L.emit(line)

    L.emit("// xk = z k1 k2 / (k3 k4); pk = pkm1 - pkm2 xk, qk = qkm1 - qkm2 xk")
    xk = div_call(L, L.mul(L.mul_num(Z, "k1"), ("k2h", "k2l")), L.two_prod("k3", "k4"))
    pk = L.sub(pkm1, L.mul(pkm2, xk))
    qk = L.sub(qkm1, L.mul(qkm2, xk))
    shift(pk, qk)
    L.emit("// xk = z k5 k6 / (k7 k8); pk = pkm1 + pkm2 xk, qk = qkm1 + qkm2 xk")
    xk = div_call(L, L.mul(L.mul_num(Z, "k5"), ("k6h", "k6l")), L.two_prod("k7", "k8"))
    pk = L.add(pkm1, L.mul(pkm2, xk))
    qk = L.add(qkm1, L.mul(qkm2, xk))
    shift(pk, qk)
    L.emit(f"if ({qk[0]} !== 0) {{")
    C = G("      ")
    C.n = L.n
    r = div_call(C, pk, qk)
    C.emit(f"const t = {r[0]} !== 0 ? Math.abs((ansh - {r[0]}) / {r[0]}) : 1;")
    C.emit(f"ansh = {r[0]};")
    C.emit(f"ansl = {r[1]};")
    C.emit("if (t < MACHEP && n > 1) break;")
    L.lines += C.lines
    L.n = C.n
    L.emit("}")
    k2 = L.add(("k2h", "k2l"), ("d1", "0"))
    L.emit(f"k2h = {k2[0]};")
    L.emit(f"k2l = {k2[1]};")
    k6 = L.add(("k6h", "k6l"), ("nd1", "0"))
    L.emit(f"k6h = {k6[0]};")
    L.emit(f"k6l = {k6[1]};")
    for line in ("k5 += 1;", "k1 += 1;", "k3 += 2;", "k4 += 2;", "k7 += 2;", "k8 += 2;"):
        L.emit(line)
    L.emit("// Rescaling (both conditions are tested on this step's pk, qk)")
    for cond, f in ((f"Math.abs({qk[0]}) + Math.abs({pk[0]}) > BIG", "BIGINV"),
                    (f"Math.abs({qk[0]}) < BIGINV || Math.abs({pk[0]}) < BIGINV", "BIG")):
        L.emit(f"if ({cond}) {{")
        Rg = G("      ")
        Rg.n = L.n
        for v in ("pkm2", "pkm1", "qkm2", "qkm1"):
            m = Rg.mul_num((v + "h", v + "l"), f)
            Rg.emit(f"{v}h = {m[0]};")
            Rg.emit(f"{v}l = {m[1]};")
        L.lines += Rg.lines
        L.n = Rg.n
        L.emit("}")
    g.lines += L.lines
    g.emit("}")
    g.emit("return ansh + ansl;")
    return "\n".join(g.lines)


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else ""
    gens = {"ops": gen_ops, "bd0dd": gen_bd0dd, "ddlog": gen_ddlog, "scalar": gen_scalar, "cf": gen_cf}
    if what not in gens:
        sys.exit(__doc__)
    print(gens[what]())
