import { describe, expect, it } from "vitest";
import { geeglm, geeAnova, geePredict, geeQIC, geeSummary, geeVcov } from "../src/models/gee.js";

const data = {
  id: [1, 1, 2, 2, 3, 3, 4, 4],
  x: [0, 1, 0, 1, 0, 1, 0, 1],
  y: [1, 4, 2, 3, 0, 2, 1, 3],
};


const geeCheckData = {
  id: Array.from({ length: 36 }, (_, i) => Math.floor(i / 3) + 1),
  wave: Array.from({ length: 36 }, (_, i) => (i % 3) + 1),
  x: Array.from({ length: 36 }, (_, i) => [-1, 0, 1][i % 3]!),
  y: [
    1.7534, 2.9203, 2.5018, 2.8479, 3.1191, 3.3040, 1.9940, 2.9519, 3.3162,
    2.0370, 3.1600, 3.7074, 2.1179, 2.7573, 3.5305, 1.8430, 2.5981, 3.7241,
    2.0848, 2.1128, 3.2114, 2.4783, 2.6839, 3.3756, 2.4709, 3.7123, 3.0934,
    2.8241, 2.1850, 3.5375, 1.5652, 3.4757, 3.8670, 2.7189, 2.3572, 3.7923,
  ],
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

  it("matches the independent 12-cluster Gaussian oracle for mean, scale, and sandwich covariance", () => {
    const fit = geeglm("y ~ x", geeCheckData, { id: "id", waves: "wave", corstr: "independence" });
    expect(fit.coefficients[0]).toBeCloseTo(2.82583888888889, 11);
    expect(fit.coefficients[1]).toBeCloseTo(0.592741666666667, 11);
    expect(fit.scale).toBeCloseTo(0.173445234552469, 11);
    expect(fit.covariance[0]![0]).toBeCloseTo(0.00369049728137860, 10);
    expect(fit.covariance[0]![1]).toBeCloseTo(-0.0000763672646604936, 10);
    expect(fit.covariance[1]![1]).toBeCloseTo(0.00589825936921296, 10);
  });

  it("matches the exchangeable and AR(1) residual-moment estimates", () => {
    const exchangeable = geeglm("y ~ x", geeCheckData, { id: "id", waves: "wave", corstr: "exchangeable", epsilon: 1e-12, maxit: 500 });
    const ar1 = geeglm("y ~ x", geeCheckData, { id: "id", waves: "wave", corstr: "ar1", epsilon: 1e-12, maxit: 500 });
    expect(exchangeable.alpha[0]).toBeCloseTo(-0.117003308068869, 9);
    expect(ar1.alpha[0]).toBeCloseTo(-0.201175106522640, 8);
  });


  it("uses explicit waves for AR(1) gaps and defaults to consecutive within-cluster waves", () => {
    const keep = geeCheckData.id.map((id, i) => !(id <= 6 && geeCheckData.wave[i] === 2));
    const gapData = {
      id: geeCheckData.id.filter((_, i) => keep[i]),
      wave: geeCheckData.wave.filter((_, i) => keep[i]),
      x: geeCheckData.x.filter((_, i) => keep[i]),
      y: geeCheckData.y.filter((_, i) => keep[i]),
    };
    const withWaves = geeglm("y ~ x", gapData, { id: "id", waves: "wave", corstr: "ar1", epsilon: 1e-12, maxit: 500 });
    const defaultWaves = geeglm("y ~ x", gapData, { id: "id", corstr: "ar1", epsilon: 1e-12, maxit: 500 });
    expect(withWaves.alpha[0]).toBeCloseTo(-0.318769908479073, 8);
    expect(defaultWaves.alpha[0]).toBeCloseTo(-0.173965690243595, 8);
  });

  it("supports unstructured, user-defined, and fixed pairwise working correlations", () => {
    const unstructured = geeglm("y ~ x", geeCheckData, { id: "id", waves: "wave", corstr: "unstructured" });
    const zcor = Array.from({ length: 12 }, () => [[1, 0], [0, 1], [1, 0]]).flat();
    const userdefined = geeglm("y ~ x", geeCheckData, { id: "id", waves: "wave", corstr: "userdefined", zcor });
    const fixed = geeglm("y ~ x", geeCheckData, {
      id: "id", waves: "wave", corstr: "fixed", zcor: new Array(36).fill(0.25),
    });
    expect(unstructured.alpha).toHaveLength(3);
    expect(userdefined.alpha).toHaveLength(2);
    expect(fixed.alpha).toHaveLength(0);
    expect([...unstructured.coefficients, ...userdefined.coefficients, ...fixed.coefficients].every(Number.isFinite)).toBe(true);
  });


  it("returns the six QIC statistics", () => {
    const fit = geeglm("y ~ x", data, { id: "id" });
    const qic = geeQIC(fit);
    expect(Object.keys(qic)).toEqual(["QIC", "QICu", "Q", "CIC", "params", "QICC"]);
    expect(Object.values(qic).every(Number.isFinite)).toBe(true);
  });


  it("drops rows with missing vector cluster ids, waves, weights, or offsets", () => {
    const fit = geeglm("y ~ x", { x: [0, 1, 0, 1], y: [1, 3, 2, 4] }, {
      id: [1, 1, NaN, 2],
      waves: [1, 2, 1, 2],
      weights: [1, 1, 1, 1],
      offset: [0, 0, 0, 0],
    });
    expect(fit.rows).toEqual([0, 1, 3]);
    expect(fit.clusterIds).toEqual([1, 1, 2]);
    expect(Number.isNaN(fit.fittedValues[2]!)).toBe(true);
  });

  it("omits rows with missing vector offsets and weights before forming clusters", () => {
    const fit = geeglm("y ~ x", { id: [1, 1, 2, 2], x: [0, 1, 0, 1], y: [1, 3, 2, 4] }, {
      id: "id", weights: [1, 1, NaN, 1], offset: [0, 0, 0, 0],
    });
    expect(fit.rows).toEqual([0, 1, 3]);
  });

});
