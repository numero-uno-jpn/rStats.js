// Location-scale distributions where x - location or scale * z overflows although the result is in range, and the
// convergence checks of numerical integration (review of 2026-10-31: normal extremes; fisher, distSummary, integrate,
// Dunnett).
import { describe, expect, it } from "vitest";
import { dcauchy1, pcauchy1, qcauchy1 } from "../src/distributions/cauchy.js";
import { dlaplace1, plaplace1, qlaplace1 } from "../src/distributions/laplace.js";
import { dlogis1, plogis1, qlogis1 } from "../src/distributions/logistic.js";
import { distSummary, dnorm, fisherTest, glhtDunnett, integrate, pnorm, qnorm } from "../src/index.js";
import { lgamma } from "../src/special/gamma.js";
import { lbeta } from "../src/special/beta.js";

type D = (x: number, l: number, s: number, log: boolean) => number;
type P = (q: number, l: number, s: number, lower: boolean, logP: boolean) => number;
const families: [string, D, P, P][] = [
  ["norm", (x, l, s, g) => dnorm(x, { mean: l, sd: s, log: g }) as number, (q, l, s, t, g) => pnorm(q, { mean: l, sd: s, lowerTail: t, logP: g }) as number, (p, l, s, t, g) => qnorm(p, { mean: l, sd: s, lowerTail: t, logP: g }) as number],
  ["logis", dlogis1, plogis1, qlogis1],
  ["cauchy", dcauchy1, pcauchy1, qcauchy1],
  ["laplace", dlaplace1, plaplace1, qlaplace1],
];
const F = 2 ** -1000; // exact

describe("location-scale distributions near the ends of the range", () => {
  for (const [name, d, p, q] of families) {
    it(name, () => {
      // x - location = 2e308 and scale z = 2e308 overflow; scaled by 2^-1000 nothing does, and z is the same
      const [x, l, s] = [1e308, -1e308, 1.7e308];
      expect(p(x, l, s, true, false)).toBe(p(x * F, l * F, s * F, true, false));
      expect(p(x, l, s, false, true)).toBe(p(x * F, l * F, s * F, false, true));
      expect(d(x, l, s, true)).toBeCloseTo(d(x * F, l * F, s * F, true) - 1000 * Math.LN2, 10);
      // the probability at z = 1.3: scale z = 2.2e308 overflows, location + scale z = 1.2e308 does not
      const pz = p(1.3, 0, 1, true, false);
      const qs = q(pz, l * F, s * F, true, false) / F;
      expect(Number.isFinite(qs)).toBe(true);
      expect(Math.abs(q(pz, l, s, true, false) - qs)).toBeLessThanOrEqual(1e-15 * Math.abs(qs));
    });
  }
  it("the values of the review", () => {
    const o = { mean: -1e308, sd: 1.7e308 };
    expect(pnorm(1e308, o)).toBeCloseTo(0.8802965606, 9);
    expect((dnorm(1e308, o) as number) / 1.17465770027e-309).toBeCloseTo(1, 5);
    expect((qnorm(0.9, o) as number) / 1.1786376614e308).toBeCloseTo(1, 9);
  });
});

describe("integer limits and tolerances", () => {
  it("fisherTest rejects counts beyond the largest integer", () => {
    expect(() => fisherTest([[2147483648, 0], [0, 1]], { confInt: false })).toThrow("'x' has entries too large to be integer");
  });
  it("integrate rejects infinite or negative tolerances", () => {
    for (const o of [{ relTol: Infinity }, { absTol: Infinity }, { relTol: -1 }, { absTol: -1e-8 }]) {
      expect(() => integrate((t) => Math.sin(1000 * t), 0, 1, o)).toThrow("invalid parameter values");
    }
  });
});

describe("integrals that do not converge", () => {
  it("distSummary of a Weibull with a small shape", () => {
    const s = distSummary("weibull", { shape: 0.1, scale: 1 });
    const want = Math.exp(lgamma(21)) - Math.exp(2 * lgamma(11));
    expect(s.variance / want).toBeCloseTo(1, 12);
    expect(distSummary("weibull", { shape: 0.5 }).variance).toBeCloseTo(20, 12);
  });
  it("distSummary of a Kumaraswamy with a small a", () => {
    const m = (r: number): number => 100 * Math.exp(lbeta(1 + r / 0.1, 100));
    expect(distSummary("kumar", { a: 0.1, b: 100 }).variance / (m(2) - m(1) ** 2)).toBeCloseTo(1, 10);
  });
  it("glhtDunnett two-sided where the conditional probability inside (b, a) rounds below 0", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [2, 4, 5, 6, 8];
    const g = [...a.map(() => "a"), ...b.map(() => "b"), "c", "c", "c", "c", "c"];
    const r = glhtDunnett([...a, ...b, 3, 5, 6, 7, 9], g);
    expect(r.p[0]).toBeGreaterThan(r.p[1]!);
    expect(r.p[0]).toBeGreaterThan(0.2);
    expect(r.p[0]).toBeLessThan(0.3);
  });
});

describe("two-sided binomTest by search", () => {
  it("equals the count over every outcome", async () => {
    const { dbinom1 } = await import("../src/distributions/binomial.js");
    const { binomTest } = await import("../src/index.js");
    const brute = (x: number, n: number, p: number): number => {
      const cut = dbinom1(x, n, p, false) * (1 + 1e-7);
      let s = 0;
      for (let i = 0; i <= n; i++) if (dbinom1(i, n, p, false) <= cut) s += dbinom1(i, n, p, false);
      return Math.min(1, s);
    };
    for (const n of [1, 2, 3, 7, 20, 101]) {
      for (const p of [0.01, 0.2, 0.5, 0.73, 0.999]) {
        for (let x = 0; x <= n; x++) {
          const got = binomTest(x, n, { p }).pValue;
          expect(Math.abs(got - brute(x, n, p))).toBeLessThanOrEqual(1e-12 * Math.max(got, 1e-300) + 1e-15);
        }
      }
    }
  });
  it("takes no time for a billion trials", async () => {
    const { binomTest } = await import("../src/index.js");
    const t0 = Date.now();
    const r = binomTest(500_010_000, 1_000_000_000, { p: 0.5 }).pValue;
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
  });
});

describe("r2dtable count", () => {
  it("rejects an infinite count or one beyond the integer range, as R", async () => {
    const { r2dtable } = await import("../src/index.js");
    for (const n of [Infinity, 2147483648, -1, NaN]) expect(() => r2dtable(n, [2, 2], [2, 2])).toThrow("invalid argument 'n'");
    expect(r2dtable(2.5, [2, 2], [2, 2])).toHaveLength(2);
  });
});

describe("input limits of r2dtable and omega", () => {
  it("r2dtable rejects margins whose total is beyond the integer range", async () => {
    const { r2dtable } = await import("../src/index.js");
    const m = 2147483647;
    expect(() => r2dtable(1, [m, m], [m, m])).toThrow("the sum of 'r' must be at most 2147483647");
  });
  it("omega rejects more factors than variables", async () => {
    const { omega } = await import("../src/index.js");
    const R = (p: number): number[][] => Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => (i === j ? 1 : 0.4)));
    expect(() => omega(null, { covmat: R(2), nfactors: 3 })).toThrow("'nfactors' (3) must not exceed the number of variables (2)");
    expect(() => omega(null, { covmat: R(4), nfactors: 5 })).toThrow("must not exceed");
    expect(Number.isFinite(omega(null, { covmat: R(4), nfactors: 4 }).omegaH)).toBe(true);
  });
});

describe("noncentral rt and rf with an infinite df", () => {
  // the limits, drawing what R draws (R 4.5.2 gives NaN but consumes the same variates; values checked in R)
  it("rt is N(ncp, 1)", async () => {
    const R = await import("../src/index.js");
    R.setSeed(1);
    const z = R.rnorm(3, { mean: 1 });
    const next = R.runif(1)[0];
    R.setSeed(1);
    expect(R.rt(3, Infinity, { ncp: 1 })).toEqual(z);
    expect(R.runif(1)[0]).toBe(next);
    expect(z[0]).toBe(0.3735461892576676);
  });
  it("rf takes chi-squared over an infinite df as 1", async () => {
    const R = await import("../src/index.js");
    // the noncentral chi-squared with df1 = Inf draws its Poisson mixture first, as R (issue 420)
    R.setSeed(1);
    R.rchisq(3, Infinity, { ncp: 2 });
    const y = R.rchisq(3, 10);
    R.setSeed(1);
    expect(R.rf(3, Infinity, 10, { ncp: 2 })).toEqual(y.map((v) => 1 / (v / 10)));
    R.setSeed(1);
    const x = R.rchisq(3, 10, { ncp: 2 });
    R.setSeed(1);
    expect(R.rf(3, 10, Infinity, { ncp: 2 })).toEqual(x.map((v) => v / 10));
    expect(R.rf(3, Infinity, Infinity, { ncp: 2 })).toEqual([1, 1, 1]);
    expect(R.rf(1, Infinity, 10, { ncp: -1 })).toEqual([NaN]);
  });
});

describe("integer parameters of the random generators, as R's R_forceint", () => {
  // values from R 4.5.2 after set.seed(1) / set.seed(3): halves go to the even integer
  it("rhyper, rwilcox and rsignrank round halves to even", async () => {
    const R = await import("../src/index.js");
    const at = (seed: number, f: () => number[]): number[] => (R.setSeed(seed), f());
    expect(at(1, () => R.rwilcox(6, 2.5, 4))).toEqual([4, 4, 5, 4, 2, 6]);
    expect(at(1, () => R.rsignrank(6, 2.5))).toEqual([0, 3, 2, 3, 1, 0]);
    expect(at(3, () => R.rhyper(8, 2.5, 4, 3))).toEqual([2, 0, 1, 1, 1, 1, 2, 1]);
    expect(at(3, () => R.rhyper(8, 5, 4, 2.5))).toEqual([2, 1, 1, 1, 1, 1, 2, 1]);
    expect(at(3, () => R.rhyper(8, 5, 4.5, 3))).toEqual([2, 1, 2, 2, 1, 1, 2, 2]);
    expect(at(3, () => R.rwilcox(6, 3, 4.5))).toEqual([4, 4, 7, 7, 6, 3]);
  });
  it("rsignrank of an infinite n is NaN, rwilcox of a huge m + n an error", async () => {
    const R = await import("../src/index.js");
    expect(R.rsignrank(2, Infinity)).toEqual([NaN, NaN]);
    expect(() => R.rwilcox(1, Infinity, 5)).toThrow("m + n must be at most 2147483647");
    expect(() => R.rwilcox(1, 2147483648, 5)).toThrow("m + n must be at most 2147483647");
  });
  it("noncentral rf with a df of 0 is NaN, drawing what R draws", async () => {
    const R = await import("../src/index.js");
    R.setSeed(1);
    expect(R.rf(5, 0, 10, { ncp: 2 })).toEqual([NaN, NaN, NaN, NaN, NaN]);
    R.setSeed(1);
    R.rchisq(5, 0, { ncp: 2 });
    R.rchisq(5, 10);
    const next = R.runif(1)[0];
    R.setSeed(1);
    R.rf(5, 0, 10, { ncp: 2 });
    expect(R.runif(1)[0]).toBe(next);
    expect(next).toBe(0.38238795707002282); // R 4.5.2: runif(1) after set.seed(1); rf(5, 0, 10, ncp = 2)
  });
  it("a Mersenne-Twister state with a negative or fractional position is refused", async () => {
    const R = await import("../src/index.js");
    R.setSeed(1);
    const s = R.getRandomSeed();
    for (const mti of [-1, 1.5, NaN]) {
      const t = Int32Array.from(s) as unknown as number[];
      const u = Array.from(t);
      u[1] = mti;
      expect(() => R.setRandomSeed(u)).toThrow("non-negative 32-bit integer");
    }
    const u = Array.from(s);
    u[1] = 1000; // past N: the next draw regenerates, as in R
    R.setRandomSeed(u);
    expect(R.runif(1)[0]).toBe(0.2655086631421);
  });
});

describe("linear algebra, coxph and generators near the ends of the range", () => {
  it("eigen and svd of the smallest subnormal", async () => {
    const R = await import("../src/index.js");
    expect((R.eigen([[Number.MIN_VALUE]]) as { values: number[] }).values).toEqual([Number.MIN_VALUE]);
    expect((R.svd([[Number.MIN_VALUE]]) as { d: number[] }).d).toEqual([Number.MIN_VALUE]);
  });
  it("expm with entries near the largest double ends and gives the limits", async () => {
    const R = await import("../src/index.js");
    const higham = { method: "Higham08" } as Parameters<typeof R.expm>[1];
    expect(R.expm([[1e308, 0], [0, 0]], higham)).toEqual([[Infinity, 0], [0, 1]]);
    expect(R.expm([[-1e308, 0], [0, -1e308]], higham)).toEqual([[0, 0], [0, 0]]);
    const full = R.expm([[1e308, 1e308], [1e308, 1e308]], higham) as number[][];
    expect(full.flat().every((v) => !Number.isFinite(v))).toBe(true); // ends (it never did)
  });
  it("coxph keeps distinct times near 1e308 apart", async () => {
    const R = await import("../src/index.js");
    const x = [[0.3], [1.2], [-0.5], [0.8]];
    const big = R.coxph([1e308, 1.1e308, 1.2e308, 1.3e308], [1, 1, 1, 1], x).coefficients[0]!;
    expect(big).toBeCloseTo(-0.0734150622315719, 12); // R 4.5.2, also for times 1, 2, 3, 4
    // a time censored at Infinity is at risk throughout: R 4.5.2 stops ("NA/NaN/Inf in foreign function call"),
    // with the censoring at 1e6 it gives 1.1475221865923
    expect(R.coxph([1, 2, Infinity, 4], [1, 1, 0, 1], x).coefficients[0]).toBeCloseTo(1.1475221865923, 12);
  });
  it("qr with an infinite tolerance takes every column as dependent", async () => {
    const R = await import("../src/index.js");
    expect((R.qr([[1, 3], [2, 4]], { tol: Infinity }) as { rank: number }).rank).toBe(0);
  });
  it("rtriang on a range wider than the largest double, rmultinom's integer size", async () => {
    const R = await import("../src/index.js");
    const t = (R as unknown as { rtriang: (n: number, o: object) => number[] }).rtriang(50, { a: -1e308, b: 1e308, c: 0 });
    expect(t.every((v) => Number.isFinite(v) && v >= -1e308 && v <= 1e308)).toBe(true);
    expect(() => R.rmultinom(1, 2 ** 31, [0.5, 0.5])).toThrow("up to 2147483647");
  });
});
