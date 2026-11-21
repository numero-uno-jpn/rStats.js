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
    expect(anova.rows).toEqual(["x"]);
    expect(anova.values[0]![0]).toBe(2);
    expect(geePredict(fit, { newdata: { x: [2, 3] } })).toEqual([5, 7]);
    expect(geePredict(fit, { newdata: { x: [2, 3] }, type: "response" })).toEqual([5, 7]);
  });

  it("treats offset(log(variable)) as fixed and uses it for newdata predictions", () => {
    const t = [1, 2, 1, 2, 1, 2, 1, 2];
    const x = [0, 1, 0, 1, 0, 1, 0, 1];
    const residual = [0, 1, 1, 0, -1, -1, 0, 0];
    const y = t.map((v, i) => 1 + 2 * x[i]! + Math.log(v) + residual[i]!);
    const fit = geeglm("y ~ offset(log(t)) + x", { id: data.id, t, x, y }, { id: "id" });
    expect(fit.coefficients[0]).toBeCloseTo(1, 10);
    expect(fit.coefficients[1]).toBeCloseTo(2, 10);
    expect(geePredict(fit, { newdata: { t: [4, 4], x: [0, 1] } })[0]).toBeCloseTo(1 + Math.log(4), 10);
    expect(geePredict(fit, { newdata: { t: [4, 4], x: [0, 1] } })[1]).toBeCloseTo(3 + Math.log(4), 10);
  });


  it("distinguishes approximate, one-step, and fully iterated delete-cluster covariance", () => {
    const jack = geeglm("y ~ x", data, { id: "id", "std.err": "jack" });
    const j1s = geeglm("y ~ x", data, { id: "id", "std.err": "j1s" });
    const fij = geeglm("y ~ x", data, { id: "id", "std.err": "fij" });
    for (const fit of [jack, j1s, fij]) {
      expect(fit.covariance).toHaveLength(2);
      expect(fit.covariance.flat().every(Number.isFinite)).toBe(true);
    }
    expect(jack.covariance).not.toEqual(fij.covariance);
  });


  it("tests added terms in sequential and nested GEE Wald comparisons", () => {
    const dataZ = { ...data, z: [0, 0, 1, 1, 0, 1, 1, 0] };
    const reduced = geeglm("y ~ x", dataZ, { id: "id" });
    const full = geeglm("y ~ x + z", dataZ, { id: "id" });
    const sequential = geeAnova(full);
    const nested = geeAnova(full, reduced);
    expect(sequential.rows).toEqual(["x", "z"]);
    expect(sequential.values).toHaveLength(2);
    expect(nested.values[0]![0]).toBe(1);
    expect(Number.isFinite(nested.values[0]![1]!)).toBe(true);
  });

});
