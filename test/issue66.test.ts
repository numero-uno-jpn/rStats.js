// Issue #66: the far tails of the noncentral t for a large δ (review_fix_log_issue66.md).
// References: log-sum-exp integrals in 320-bit Rmpfr, over w = log(χ²/df) (P = E[Φ(t S - δ)], f = E[S φ(t S - δ)]) or,
// for t >> sqrt(df), over z = Z (P = Φ(-δ) + ∫ φ(z) Q(a, a ((δ + z)/t)²) dz).
import { describe, expect, it } from "vitest";
import { dt, pnorm, pt, qt } from "../src/index.js";

function rel(v: number, ref: number): number {
  return v === ref ? 0 : Math.abs(v - ref) / Math.abs(ref);
}

// [kind, t, df, ncp, log reference]
const CASES: [string, number, number, number, number][] = [
  // Laplace's method over w
  ["p", 1, 10, 1e9, -454545454545454396.7908308],
  ["p", 5, 3, 1e7, -5357142857128.194963354923],
  ["p", 5, 3, 1e12, -53571428571428571428545.25],
  ["p", 3, 0.5, 1e8, -263157894736868.2826003736],
  ["d", 1, 10, 1e9, -454545454545454357.8375046],
  ["d", 1e5, 3, 1e10, -14999999971.05202136587215],
  ["d", 0.01, 100, 1e9, -499999500000498798.7815653],
  // a sharp peak where the expansion is not accurate enough (the trapezoidal sum in double-double)
  ["p", 29955.40367704368, 1, 1e10, -55721096106.48952155722573],
  // a broad peak (the ratio to Φ(-δ) or φ(δ))
  ["p", -1, 1, 3e8, -45000000000000040.18331595],
  ["p", 1e-20, 1e4, 1e10, -50000000000000000023.94479],
  ["p", 0.001, 1e4, 1e5, -4999999912.183954036711368],
  ["p", -6.1e14, 1, 1e5, -5000000058.215060889185762],
  ["p", -3, 50, 1e9, -500000000000000941.7900533],
  ["d", -1, 3, 1e8, -5000000000000071.387774959],
  ["d", -1e10, 2, 1e9, -500000000000000130.7799945],
  // over z, t >> sqrt(df)
  ["p", 1e300, 1, 1e305, -5000000011.738715685202878],
  ["p", 1e9, 3, 1e14, -14999999988.16355969830711],
  ["p", 1e10, 1, 1e30, -5.000000000000000198796248e39],
  ["p", 1e12, 100, 1e20, -499999999999998147.6498538],
  ["d", 1e9, 3, 1e14, -14999999984.76236231667829],
  ["d", 1e10, 1, 1e30, -5.000000000000000198796248e39],
];

// Near the median of a huge δ (over z), within the accuracy of log Q(a, x) (pgamma(1.5, 1.5, upper, log) is 3e-15 off)
const MEDIAN: [string, number, number, number, number][] = [
  ["p", 1.001e20, 3, 1e20, -0.9350918833254803124222663],
  ["p", 0.5e10, 1, 1e10, -3.090037153122086618240445],
  ["d", 1e20, 3, 1e20, -46.12957477952347655498193],
  ["d", 0.999e20, 100, 1e20, -44.32224802081691489516138],
];

function value(kind: string, t: number, df: number, ncp: number): number {
  return (kind === "p" ? pt(t, df, { ncp, logP: true }) : dt(t, df, { ncp, log: true })) as number;
}

describe("issue #66", () => {
  it("gives the limits for a subnormal t and ncp near the overflow threshold", () => {
    const T = Number.MIN_VALUE;
    for (const t of [T, -T]) {
      expect(pt(t, 1e4, { ncp: 1.7e308, logP: true })).toBe(-Infinity);
      expect(pt(t, 1e4, { ncp: 1.7e308 })).toBe(0);
      expect(Math.abs(pt(t, 1e4, { ncp: 1.7e308, lowerTail: false, logP: true }) as number)).toBe(0);
      expect(Math.abs(pt(t, 1e4, { ncp: -1.7e308, logP: true }) as number)).toBe(0);
      expect(pt(t, 1e4, { ncp: -1.7e308, lowerTail: false, logP: true })).toBe(-Infinity);
      expect(pt(t, 1e4, { ncp: -1.7e308, lowerTail: false })).toBe(0);
    }
  });

  it("matches the far-tail references (they were NaN, +Infinity or far off)", () => {
    for (const [kind, t, df, ncp, ref] of CASES) {
      expect(rel(value(kind, t, df, ncp), ref), `${kind} ${t} ${df} ${ncp}`).toBeLessThanOrEqual(1e-15);
    }
  });

  it("gives the same far tails for a negative ncp (upper tail, density at -t)", () => {
    expect(pt(-1, 10, { ncp: -1e9, lowerTail: false, logP: true })).toBe(pt(1, 10, { ncp: 1e9, logP: true }));
    expect(dt(-1, 10, { ncp: -1e9, log: true })).toBe(dt(1, 10, { ncp: 1e9, log: true }));
    expect(dt(-1e9, 3, { ncp: -1e14, log: true })).toBe(dt(1e9, 3, { ncp: 1e14, log: true }));
  });

  it("matches the references near the median of a huge ncp, and the tails add to 1", () => {
    for (const [kind, t, df, ncp, ref] of MEDIAN) {
      expect(rel(value(kind, t, df, ncp), ref), `${kind} ${t} ${df} ${ncp}`).toBeLessThanOrEqual(4e-15);
    }
    for (const t of [0.999e20, 1e20, 1.001e20]) {
      const lo = pt(t, 3, { ncp: 1e20 }) as number;
      const up = pt(t, 3, { ncp: 1e20, lowerTail: false }) as number;
      expect(Math.abs(lo + up - 1)).toBeLessThanOrEqual(2e-16);
    }
  });

  it("gives log Φ(-δ) for a tiny df below 0 (most of S near 0), and a finite density", () => {
    const l0 = pnorm(-1e5, { logP: true });
    for (const df of [1e-310, 1e-40, 1e-20]) {
      for (const r of [1e-3, 1, 1e3]) {
        expect(pt(-r * Math.sqrt(df), df, { ncp: 1e5, logP: true })).toBe(l0);
      }
    }
    // The density to first order in a: φ(δ) 2a ∫ e^(B s - A s²) ds, A = t²/2 + a, B = t δ, which is
    // φ(δ) 2a sqrt(π/A) e^(B²/(4A)) where B/sqrt(A) is large (erfc(-B/(2 sqrt(A))) = 2)
    for (const r of [1e-3, 1]) {
      const df = 1e-40;
      const a = df / 2;
      const t = r * Math.sqrt(df);
      const A = (t * t) / 2 + a;
      const B = t * 1e5;
      const closed = -5e9 - 0.5 * Math.log(2 * Math.PI) + Math.log(2 * a) + 0.5 * Math.log(Math.PI / A) + (B * B) / (4 * A);
      expect(rel(dt(t, df, { ncp: 1e5, log: true }) as number, closed)).toBeLessThanOrEqual(1e-15);
    }
  });

  it("inverts in qt", () => {
    for (const [df, ncp, lp] of [
      [3, 1e10, -1e6],
      [1, 1e10, -1e10],
      [100, 1e12, -1e3],
      [3, 1e14, -1e6],
      [1, 1e6, -1e10],
    ]) {
      const q = qt(lp!, df!, { ncp: ncp!, logP: true }) as number;
      expect(rel(pt(q, df!, { ncp: ncp!, logP: true }) as number, lp!), `${df} ${ncp} ${lp}`).toBeLessThanOrEqual(1e-9);
    }
  });

  it("is monotone in t over a huge ncp", () => {
    for (const [df, ncp] of [
      [3, 1e20],
      [1e6, 1e50],
      [0.5, 1e12],
    ]) {
      let prev = -Infinity;
      for (let e = 30; e >= -10; e -= 0.25) {
        const v = pt(-(10 ** e), df!, { ncp: ncp!, logP: true }) as number;
        expect(v >= prev && v <= 0, `${df} ${ncp} -1e${e}`).toBe(true);
        prev = v;
      }
      for (let e = -10; e <= 60; e += 0.25) {
        const v = pt(10 ** e, df!, { ncp: ncp!, logP: true }) as number;
        expect(v >= prev && v <= 0, `${df} ${ncp} 1e${e}`).toBe(true);
        prev = v;
      }
    }
  });
});
