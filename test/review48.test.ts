// External review of models, survival, random, htest and descriptive (review_fix_log_20261031_48.md).
import { describe, expect, it } from "vitest";
import {
  binomTest,
  factanal,
  glm,
  glmAnova,
  kappa2,
  lchoose,
  omega,
  poissonTest,
  polyserial,
  rbinom,
  rexp,
  setSeed,
  shapiroTest,
  survdiff,
  survfit,
} from "../src/index.js";
import { btpeLogRatio } from "../src/random/binomial.js";

describe("review 48", () => {
  const y = [1, 2, 4, 8, 3, 5, 9, 6];
  const x = [0, 1, 2, 3, 4, 5, 6, 7];

  it("MOD-001: glm fits with other offsets are compared only when nested as affine models", () => {
    const f1 = glm(x.map(() => []), y, { family: "poisson" });
    // offset log y - x/2 is not in the span of 1 and x: not nested, no test (R tests: p = 0.000417)
    const f2 = glm(x, y, { family: "poisson", offset: y.map((v, i) => Math.log(v) - 0.5 * x[i]!) });
    const a = glmAnova([f1, f2], { test: "LRT" });
    expect(a.table[1]![3]).toBeCloseTo(12.452226185676762, 12);
    expect(a.table[1]![4]).toBeNaN();
    expect(glmAnova([f1, f2], { test: "Rao" }).table[1]!.slice(4).every(Number.isNaN)).toBe(true);
    // offset 2x is in the span: nested, tested as before (the same deviances as without the offset)
    const f3 = glm(x, y, { family: "poisson", offset: x.map((v) => 2 * v) });
    const f4 = glm(x, y, { family: "poisson" });
    const p3 = glmAnova([f1, f3], { test: "LRT" }).table[1]![4]!;
    expect(p3).toBeCloseTo(glmAnova([f1, f4], { test: "LRT" }).table[1]![4]!, 10);
    expect(p3).toBeGreaterThan(0);
  });

  it("MOD-002: glm with all prior weights zero is an error", () => {
    // it returned rank 2 with -2 residual degrees of freedom (R stops with an internal error)
    expect(() => glm([1, 2], [1, 0], { family: "gaussian", weights: [0, 0] })).toThrow(/all weights are zero/);
    expect(() => glm([[0, 1], [1, 1]], [[0, 0], [0, 0]], { family: "binomial" })).toThrow(/all weights are zero/);
    const f = glm([1, 2, 3], [1, 0, 1], { family: "gaussian", weights: [0, 0, 1] });
    expect(f.rank).toBe(1);
  });

  it("SURV-001: times within rounding error are one time, as R's timefix", () => {
    const time = [1, 1 + 1e-9, 2, 3];
    const status = [0, 1, 1, 0];
    const s = survfit(time, status);
    expect(s.time).toEqual([1, 2, 3]);
    expect(s.nRisk).toEqual([4, 2, 1]);
    expect(s.surv).toEqual([0.75, 0.375, 0.375]);
    expect(survdiff(time, status, ["A", "B", "A", "B"]).chisq).toBe(0);
  });

  it("RNG-001: BTPE's final test is log f(ix) / f(m)", () => {
    for (const [n, pr] of [[60, 0.5], [100, 0.3], [10000, 0.5]] as const) {
      const p = Math.min(pr, 1 - pr);
      const q = 1 - p;
      const m = Math.trunc(n * p + p);
      const sd = Math.sqrt(n * p * q);
      for (let ix = Math.round(m - 3 * sd); ix <= m + 3 * sd; ix++) {
        const exact = lchoose(n, ix) - lchoose(n, m) + (ix - m) * Math.log(p / q);
        // R's signs were off by up to 1.3e-2 (n = 60)
        expect(Math.abs(btpeLogRatio(n, p, q, m, ix) - exact)).toBeLessThan(1e-11);
      }
    }
    setSeed(439);
    expect(rbinom(1, 10000, 0.5)).toEqual([4879]); // R: 5023
  });

  it("RNG-002: rexp with a positive rate whose reciprocal overflows", () => {
    setSeed(1);
    const e = rexp(500);
    setSeed(1);
    const t = rexp(500, { rate: 1e-310 }); // NaN before, as R
    expect(t).toEqual(e.map((v) => v / 1e-310));
    expect(t.some(Number.isFinite)).toBe(true);
    expect(t.every((v) => v > 0)).toBe(true);
  });

  it("HTEST-001, HTEST-004, DESC-001: inputs that define nothing are errors", () => {
    expect(() => binomTest([0, 0])).toThrow(/positive integer/); // R: p = 1
    expect(binomTest([0, 1]).pValue).toBe(1);
    // poissonTest compares two counts of 0 as R (through the binomial test without the check)
    expect(poissonTest([0, 0]).pValue).toBe(1);
    expect(() => kappa2([])).toThrow(/no complete rating pairs/);
    expect(() => kappa2([[NaN, NaN]])).toThrow(/no complete rating pairs/);
    const asym = [[1, 0.5, 0.4], [0.2, 1, 0.3], [0.4, 0.3, 1]];
    expect(() => factanal(null, 1, { covmat: asym })).toThrow(/symmetric/);
    expect(() => omega(null, { covmat: asym, nfactors: 1 })).toThrow(/symmetric/);
    expect(() => factanal(null, 1, { covmat: [[1, 0.5, 0.4], [0.5, 0, 0.3], [0.4, 0.3, 1]] })).toThrow(/diagonal/);
    expect(() => factanal(null, 1, { covmat: [[1, 0.5], [0.5, 1], [0.4, 0.3]] })).toThrow(/square/);
    // a rounding-level asymmetry is accepted, as R's isSymmetric
    const sym = [[1, 0.5, 0.4], [0.5, 1, 0.3], [0.4, 0.3, 1]];
    const near = sym.map((r, i) => r.map((v, j) => (i === 0 && j === 1 ? v + 1e-16 : v)));
    expect(factanal(null, 1, { covmat: near }).uniquenesses).toEqual(factanal(null, 1, { covmat: sym }).uniquenesses);
  });

  it("HTEST-002, HTEST-003: Shapiro-Wilk and polyserial at any scale", () => {
    // the range overflowed: NaN before (R too)
    expect(shapiroTest([-1e308, 0, 1e308])).toEqual(shapiroTest([-1, 0, 1]));
    const d = [-1, -0.3, 0.2, 1, 0.5, 0.05];
    expect(shapiroTest(d.map((v) => v * 2 ** 1022))).toEqual(shapiroTest(d));
    // the sum of squares overflowed: rho 2.2e-9 instead of 0.589 (R: 0)
    const qx = [0.3, -1.2, 0.8, 1.9, -0.4, 0.1, 2.2, -0.9, 1.1, 0.5, -1.6, 0.7, -0.2, 1.4, -0.7, 0.9];
    const qy = [1, 1, 3, 2, 2, 1, 3, 2, 2, 3, 1, 1, 3, 3, 1, 2];
    const base = polyserial(qx, qy, { stdErr: true });
    expect(base.rho).toBeCloseTo(0.589378114901656, 6); // polycor
    expect(polyserial(qx.map((v) => v * 2 ** 664), qy, { stdErr: true })).toEqual(base);
    const big = polyserial(qx.map((v) => v * 1e200), qy, { stdErr: true }); // rounded products: within rounding
    expect(big.rho).toBeCloseTo(base.rho, 13);
    expect(big.chisq).toBeCloseTo(base.chisq, 12);
  });
});
