// Issue #472: coxph with no events takes R's zero-event branch before the fit (review_fix_log_issue472.md).
import { describe, expect, it } from "vitest";
import { coxph } from "../src/index.js";

describe("issue #472", () => {
  it("returns R's zero-event result instead of init", () => {
    // R 4.5.2, survival 3.8.3: coxph(Surv(t, s) ~ x, weights = w, init = 5, control = coxph.control(iter.max = 0))
    const fit = coxph([1, 2], [0, 0], [[0], [1]], { weights: [1, 3], init: [5], control: { iterMax: 0 } });
    expect(fit.coefficients).toEqual([NaN]);
    expect(fit.var).toEqual([[0]]);
    expect(fit.loglik).toEqual([0, 0]);
    expect(fit.score).toBe(0);
    expect(fit.wald).toBe(0);
    expect(fit.iter).toBe(0);
    expect(fit.means).toEqual([0.5]);
    expect(fit.n).toBe(2);
    expect(fit.nevent).toBe(0);
    expect(fit.linearPredictors).toEqual([0, 0]);
    // summary(fit)
    expect(fit.se).toEqual([0]);
    expect(fit.z).toEqual([NaN]);
    expect(fit.p).toEqual([NaN]);
    expect(fit.lower).toEqual([NaN]);
    expect(fit.upper).toEqual([NaN]);
    for (const t of [fit.logtest, fit.sctest, fit.waldtest]) expect(t).toEqual({ statistic: 0, df: 0, pValue: 1 });
    expect(fit.rsq).toEqual({ rsq: 0, maxrsq: 0 });
    expect(fit.warnings).toEqual([]);
  });

  it("uses the unweighted column means of all covariates with the default control", () => {
    // R: coxph(Surv(t, s) ~ x + I(x^2 + 3)) for t = 1:3, s = 0, x = c(2, 5, 7): means 4.666667, 29
    const fit = coxph([1, 2, 3], [0, 0, 0], [[2, 7], [5, 28], [7, 52]]);
    expect(fit.coefficients).toEqual([NaN, NaN]);
    expect(fit.var).toEqual([[0, 0], [0, 0]]);
    expect(fit.iter).toBe(0);
    expect(fit.means).toEqual([14 / 3, 29]);
    expect(fit.linearPredictors).toEqual([0, 0, 0]);
  });
});
