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
