import { describe, expect, it } from "vitest";
import { crr, predictCrr, rmst2, survfit } from "../src/index.js";

describe("survival numerical audit: scale and cancellation", () => {
  // Times at a tiny common scale are merged by the absolute tolerance of the tie merging, as R's timefix does
  // (oracle/coxph2-behaviour.md decision 12 (a), oracle/survfit2-behaviour.md: rmst2 fixture case 43)

  it("computes RMST and its standard error without overflowing endpoint subtraction", () => {
    const m = Number.MAX_VALUE;
    const fit = survfit([-m, m], [1, 1], { rmean: "common" });
    // S=1/2 throughout (-M,M), hence RMST=M. Greenwood's first area is M
    // and its variance is M^2/(2*1), so SE=M/sqrt(2); both are representable.
    expect(fit.rmean[0]).toBe(m);
    expect(fit.seRmean[0]! / (m / Math.SQRT2)).toBeCloseTo(1, 14);
  });

  it("centers large-offset Fine-Gray covariates before forming information", () => {
    const b = 2 ** 500, u = 2 ** 448;
    const fit = crr([1, 2, 3, 4], [1, 0, 0, 0], [[b], [b + u], [b + 2 * u], [b + 3 * u]],
      { maxiter: 0 });
    // At the sole failure time all four subjects have equal risk weight.
    // Var([0,u,2u,3u]) = (5/4)u^2 exactly; E[x^2]-E[x]^2 loses this value
    // when x is offset by 2^500. The centered weighted-product identity is the reference.
    expect(fit.inf[0]![0]! / (1.25 * u * u)).toBeCloseTo(1, 14);
    expect(fit.inf[0]![0]!).toBeGreaterThan(0);
  });

  it("retains small predicted incidence and combines extreme baseline and linear predictor in log space", () => {
    const base = {
      coefficients: [0], names: ["x"], var: [[0]], loglik: 0, loglikNull: 0,
      logtest: { statistic: 0, df: 1 }, score: [0], inf: [[1]], invinf: [[1]],
      converged: true, iterations: 0, n: 1, nMissing: 0, uftime: [1],
      res: null, tfs: [[0]], warnings: [], covariateDimensions: [1, 0] as [number, number],
    };
    const tiny = { ...base, bfitj: [2 ** -60] } as Parameters<typeof predictCrr>[0];
    const tinyPrediction = predictCrr(tiny, [[0]])[0]![1]!;
    // -expm1(-x) retains x=2^-60; 1-exp(-x) rounds to zero.
    expect(tinyPrediction / (2 ** -60)).toBeCloseTo(1, 14);

    const extreme = { ...base, coefficients: [742.1374868283872], bfitj: [Number.MIN_VALUE] } as Parameters<typeof predictCrr>[0];
    // MIN_VALUE * exp(eta) is about 0.1; exp(eta) alone overflows.
    expect(predictCrr(extreme, [[1]])[0]![1]).toBeCloseTo(0.09516258196403892, 14);
  });

  it("scales extreme adjusted RMST covariates around the validated lm/glm routines", () => {
    const scale = 2 ** 600;
    const time = [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6];
    const status = [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0];
    const arm = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
    const x = [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0].map(v => v * scale);
    const fit = rmst2(time, status, arm, { tau: 6, covariates: x });
    // Dividing this exact power-of-two column by 2^600 gives values 0..5.
    // Fitting and sandwich products on that equivalent design avoids forming 2^1200;
    // coefficients and covariance are then transformed back to the original units.
    expect(fit.adjusted).toBeDefined();
    expect(fit.coefficients?.difference.estimate.every(Number.isFinite)).toBe(true);
    expect(fit.coefficients?.difference.se.every(Number.isFinite)).toBe(true);
  });
});
