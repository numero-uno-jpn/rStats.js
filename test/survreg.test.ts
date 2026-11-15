import { describe, expect, it } from "vitest";
import { survreg, survregPredict, survregResiduals } from "../src/index.js";

describe("survreg", () => {
  const time = [2, 3, 4, 5, 6, 7, 8, 9];
  const event = [1, 1, 0, 1, 1, 0, 1, 1];
  const x = [[0], [1], [0], [1], [0], [1], [0], [1]];

  it("fits a Weibull AFT model and exposes prediction and residual APIs", () => {
    const fit = survreg(time, event, x);
    expect(fit.coefficients).toHaveLength(2);
    expect(fit.scale[0]).toBeGreaterThan(0);
    expect(fit.var).toHaveLength(3);
    expect(fit.loglik).toHaveLength(2);
    expect(fit.linearPredictors).toHaveLength(time.length);
    expect(survregPredict(fit, { type: "lp" }) as number[]).toHaveLength(time.length);
    expect(survregPredict(fit, { type: "quantile", p: 0.5 }) as number[]).toHaveLength(time.length);
    expect(survregResiduals(fit, { type: "matrix" })).toHaveLength(time.length);
  });

  it("supports fixed-scale Gaussian and interval censoring", () => {
    const fit = survreg(time, [1, 0, 1, 3, 1, 0, 1, 1], x, {
      type: "interval", time2: [2, 3, 4, 6, 6, 7, 8, 9], dist: "gaussian", scale: 1,
    });
    expect(fit.scale).toEqual([1]);
    expect(fit.n).toBe(time.length);
  });

  it("rejects invalid weights", () => {
    expect(() => survreg(time, event, x, { weights: [1, 1, 1, 1, 1, 1, 1, 0] })).toThrow("Invalid weights, must be >0");
  });
});
