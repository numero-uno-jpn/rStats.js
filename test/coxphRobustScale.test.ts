// coxph's robust variance and rscore at extreme linear predictors and weight scales (the audit of the robust
// variance, findings 1-4). The reference values come from an independent O(n times) implementation of
// oracle/robust-behaviour.md 5.2-5.4 that shifts each risk set by its own largest linear predictor, or from the
// invariance of the Cox estimating equations to the scale of the weights (the values at weights times 1).
import { describe, expect, it } from "vitest";
import { coxph } from "../src/index.js";
import { fitCoxph } from "../src/models/coxph.js";
import { expectScaleInvariant } from "./helpers/scaleInvariance.js";

const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);

describe("coxph robust variance: score residuals of risk sets whose linear predictors span more than exp's range", () => {
  // an early death with a huge covariate: the linear predictors span 2129, so a shift by the stratum's largest one
  // made every later r 0 (S0 = 0, the residuals and the robust variance NaN)
  const time = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const status = [1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1];
  const x = [5000, 3, 1, 2, 4, 0, 1, -1, 2, -2, 0, -1].map((v) => [v]);
  // the reference's score residuals at the fitted coefficient
  const refScore = [
    0, 0.750456153759375, -0.7365581077069226, -0.0035904416826538256, -0.019055444362068963, -0.09763184423181698,
    0.18361945038646468, -0.813941259466691, -0.5485041772604097, -0.08607444031035905, 0.3475520801795011,
    1.0237280306959957,
  ];

  it("gives finite score residuals equal to the reference's (were NaN after the first death)", () => {
    const f = fitCoxph(time, status, x, { robust: true });
    expect(f.result.warnings).toEqual([]);
    // within 1e-12 of the largest residual, as the fixture test against R: both forms cancel in x - xbar with x ~ 5000
    // (the reference uses the raw covariate, the fit the centred and scaled one); they agree to 1e-13
    f.scoreResiduals!.forEach((s, j) => expect(Math.abs(s[0]! - refScore[j]!), `residual ${j}`).toBeLessThan(1e-12));
  });

  it("gives the robust standard error and finite tests (were NaN)", () => {
    const r = coxph(time, status, x, { robust: true });
    // for one coefficient and each row its own cluster, robustSe = V sqrt(sum s_j^2) exactly
    const norm = Math.sqrt(refScore.reduce((a, v) => a + v * v, 0));
    expect(rel(r.robustSe![0]! / r.naiveVar![0]![0]!, norm)).toBeLessThan(1e-12);
    // against the reference's 0.11323538546503649: 1e-10, since the fit's naive variance itself differs from a
    // two-pass information by 9e-12 relative here (the information cancels in S2/S0 - xbar^2 with x ~ 5000; not part
    // of the robust variance)
    expect(rel(r.robustSe![0]!, 0.11323538546503649)).toBeLessThan(1e-10);
    for (const v of [r.z[0]!, r.p[0]!, r.lower[0]!, r.upper[0]!, r.wald, r.waldtest.pValue, r.rscore!]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("gives rscore at an initial value whose linear predictors span beyond exp's range (was NaN)", () => {
    const t = [1, 2, 3, 4, 5, 6];
    const s = [1, 0, 1, 1, 0, 1];
    const xx = [[2], [1], [3], [0], [-1], [-2]];
    // the reference gives 1 (and 1 at init 100, where nothing underflowed before the fix either)
    for (const b of [100, 300, 800]) {
      const f = fitCoxph(t, s, xx, { robust: true, init: [b], control: { iterMax: 0 } });
      expect(Math.abs(f.result.rscore! - 1), `init ${b}`).toBeLessThan(1e-12);
      expect(f.scoreResiduals!.every((row) => row.every(Number.isFinite))).toBe(true);
    }
  });
});

describe("coxph with weights scaled by powers of 2 (the information and rscore no longer scale as w^2)", () => {
  const time = [1, 2, 3, 4, 5, 6, 7, 8, 3, 5];
  const status = [1, 1, 0, 1, 1, 1, 0, 1, 1, 0];
  const x = [[0.1], [1.3], [0.4], [-0.8], [2], [0.2], [-1], [0.5], [0.3], [1]];
  const w = [1.5, 0.7, 1, 2.2, 0.9, 1.1, 1.3, 0.6, 1.8, 1];
  // (robust given: from 2^900 the weights are integers, which would turn the default off)
  const fit = (e: number, cols = x) => coxph(time, status, cols, { weights: w.map((v) => v * 2 ** e), robust: true });

  it("gives the coefficient, robust se, rscore and tests of weights times 1 (were NaN, wrong or without a warning)", () => {
    const ref = fit(0);
    for (const e of [-1000, -900, -560, -540, -530, -520, -500, 500, 520, 540, 600, 900]) {
      const r = fit(e);
      expect(r.warnings, `2^${e}`).toEqual([]);
      expect(r.usedRobust).toBe(true);
      // scaling by a power of 2 is exact, and the results here come out bit for bit as at 2^0 (1e-14 leaves room for
      // the stopping rule, whose log likelihood contains the log of the weight scale)
      for (const [a, b] of [
        [r.coefficients[0]!, ref.coefficients[0]!],
        [r.robustSe![0]!, ref.robustSe![0]!],
        [r.rscore!, ref.rscore!],
        [r.z[0]!, ref.z[0]!],
        [r.wald, ref.wald],
        // the naive se scales as w^-1/2
        [r.se[0]! * 2 ** (e / 2), ref.se[0]!],
      ] as const) {
        expect(rel(a, b), `2^${e}: ${a} vs ${b}`).toBeLessThan(1e-14);
      }
    }
  });

  it("does the same with two covariates", () => {
    const x2 = x.map((row, i) => [row[0]!, (i * 7) % 3]);
    const ref = fit(0, x2);
    for (const e of [-900, -540, 540, 900]) {
      const r = fit(e, x2);
      expect(r.warnings).toEqual([]);
      for (let j = 0; j < 2; j++) {
        expect(rel(r.coefficients[j]!, ref.coefficients[j]!)).toBeLessThan(1e-14);
        expect(rel(r.robustSe![j]!, ref.robustSe![j]!)).toBeLessThan(1e-14);
      }
      expect(rel(r.rscore!, ref.rscore!)).toBeLessThan(1e-14);
    }
  });

  it("fits integer weights of 2^600 (the naive fit ran out of iterations with NaN)", () => {
    const t = [1, 2, 3, 4, 5, 6, 7, 8];
    const s = [1, 1, 0, 1, 1, 1, 0, 1];
    const xx = [[0.1], [1.3], [0.4], [-0.8], [2], [0.2], [-1], [0.5]];
    const ref = coxph(t, s, xx);
    for (const e of [-900, 520, 600, 1000]) {
      const r = coxph(t, s, xx, { weights: t.map(() => 2 ** e), robust: false });
      expect(r.warnings).toEqual([]);
      expect(rel(r.coefficients[0]!, ref.coefficients[0]!)).toBeLessThan(1e-14);
      expect(rel(r.se[0]! * 2 ** (e / 2), ref.se[0]!)).toBeLessThan(1e-14);
    }
  });

  it("does not depend on the scale of non-integer weights (also powers of 10)", () => {
    const run = (c: number) => coxph(time, status, x, { weights: w.map((v) => v * c), robust: true });
    expectScaleInvariant(
      "coxph robust",
      run,
      { unitless: (r) => [r.coefficients[0]!, r.robustSe![0]!, r.z[0]!, r.p[0]!, r.rscore!, r.wald] },
      1e-12,
    );
    // the likelihood ratio and score statistics scale with the weights. The log likelihoods contain dw log(S0) with
    // S0 of the order of the weights (log 1e-200 = -460), which cancels in the difference: 9e-12 relative at 1e-200
    expectScaleInvariant("coxph robust", run, { units: (r) => [r.logtest.statistic, r.sctest.statistic] }, 1e-10);
  });
});

describe("coxph with an infinite weight", () => {
  it("throws a RangeError (was NaN coefficients with the warning 'coefficient may be infinite')", () => {
    const t = [1, 2, 3, 4, 5, 6];
    const s = [1, 0, 1, 1, 0, 1];
    const xx = [[2], [1], [3], [0], [-1], [-2]];
    expect(() => coxph(t, s, xx, { weights: [1, 1, Infinity, 1, 1, 1] })).toThrow(RangeError);
    expect(() => coxph(t, s, xx, { weights: [1, 1, Infinity, 1, 1, 1] })).toThrow("'weights' must be finite");
    expect(() => coxph(t, s, xx, { weights: [1.5, 1, Infinity, 1, 1, 1], robust: true })).toThrow(RangeError);
  });
});
