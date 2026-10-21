#!/usr/bin/env python3
"""Generator that expands double-double arithmetic into expressions over local variables only,
without allocating arrays.

The expanded code in src/special/dd.ts and src/special/loader.ts was produced by this script
(docs/performance.md). twoSum, quickTwoSum and twoProd (Dekker / Knuth) are written out with the
same operations in the same order as the building blocks in dd.ts, so the results are bit-for-bit
identical to calling the building blocks. To change an expression, change it here, regenerate and
paste the output into the corresponding place.

  python3 scripts/ddgen.py ops     ddAdd, ddNeg, ddSub, ddMul, ddMulNum, ddDiv, ddDivNum in dd.ts
  python3 scripts/ddgen.py bd0dd   bd0dd in loader.ts: d = x - M and the series part
  python3 scripts/ddgen.py ddlog   ddLog in dd.ts: the part after the table lookup (from after const lc = ...)

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


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else ""
    gens = {"ops": gen_ops, "bd0dd": gen_bd0dd, "ddlog": gen_ddlog}
    if what not in gens:
        sys.exit(__doc__)
    print(gens[what]())
