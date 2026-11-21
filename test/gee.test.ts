import { describe, expect, it } from "vitest";
import { geeglm, geeAnova, geePredict, geeSummary, geeVcov } from "../src/models/gee.js";

const data = {
  id: [1, 1, 2, 2, 3, 3, 4, 4],
  x: [0, 1, 0, 1, 0, 1, 0, 1],
  y: [1, 4, 2, 3, 0, 2, 1, 3],
};

describe("generalized estimating equations", () => {
  it("solves the independence Gaussian estimating equations and retains cluster rows", () => {
    const fit = geeglm("y ~ x", data, { id: "id", family: "gaussian", corstr: "independence" });
    expect(fit.coefficients[0]).toBeCloseTo(1, 12);
    expect(fit.coefficients[1]).toBeCloseTo(2, 12);
    expect(fit.converged).toBe(true);
    expect(fit.fittedValues).toHaveLength(8);
    expect(fit.residuals).toHaveLength(8);
    expect(fit.model.ids).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("returns robust covariance, Wald summaries, an overall Wald test, and marginal predictions", () => {
    const fit = geeglm("y ~ x", data, { id: "id", family: "gaussian" });
    const vc = geeVcov(fit);
    const summary = geeSummary(fit);
    const anova = geeAnova(fit);
    expect(vc.values).toHaveLength(2);
    expect(summary.rows).toEqual(["(Intercept)", "x"]);
    expect(summary.values).toHaveLength(2);
    expect(anova.rows).toEqual(["Model"]);
    expect(anova.values[0]![0]).toBe(2);
    expect(geePredict(fit, { newdata: { x: [2, 3] } })).toEqual([5, 7]);
    expect(geePredict(fit, { newdata: { x: [2, 3] }, type: "response" })).toEqual([5, 7]);
  });
});
