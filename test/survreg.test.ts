import { describe, expect, it } from "vitest";
import { survreg, survregPredict, survregResiduals } from "../src/index.js";
import { midpoint } from "../src/internal/extremes.js";

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


  it("keeps Gaussian AFT coefficients and Wald z invariant under extreme predictor units", () => {
    const y = [1, 2, 3, 4];
    const event = [1, 1, 1, 1];
    const unitX = [[-1], [-1], [1], [1]];
    const factor = 2 ** 500;
    const ordinary = survreg(y, event, unitX, { dist: "gaussian", scale: 1 });
    const scaled = survreg(y, event, unitX.map(([v]) => [v! * factor]), { dist: "gaussian", scale: 1 });
    const weight = 2 ** 500;
    const weighted = survreg(y, event, unitX, {
      dist: "gaussian", scale: 1, weights: Array(4).fill(weight),
    });

    // The exact Gaussian MLE with fixed scale is weighted least squares:
    // X'X = diag(4, 4), X'y = (10, 4), so beta = (2.5, 1).
    // Scaling x by 2^500 changes beta[1] by 2^-500 and var[1,1] by 2^-1000,
    // while z is invariant. Scaling all case weights by 2^500 leaves beta
    // unchanged and divides the covariance by 2^500.
    expect(ordinary.coefficients[0]).toBeCloseTo(2.5, 11);
    expect(ordinary.coefficients[1]).toBeCloseTo(1, 11);
    expect(scaled.coefficients[0]).toBeCloseTo(ordinary.coefficients[0]!, 11);
    expect(scaled.coefficients[1]! * factor).toBeCloseTo(ordinary.coefficients[1]!, 11);
    expect(scaled.var[0]![0]).toBeCloseTo(ordinary.var[0]![0]!, 11);
    expect(scaled.var[1]![1]! * factor * factor).toBeCloseTo(ordinary.var[1]![1]!, 11);
    expect(scaled.z[0]).toBeCloseTo(ordinary.z[0]!, 10);
    expect(scaled.z[1]).toBeCloseTo(ordinary.z[1]!, 10);
    expect(weighted.coefficients[0]).toBeCloseTo(ordinary.coefficients[0]!, 11);
    expect(weighted.coefficients[1]).toBeCloseTo(ordinary.coefficients[1]!, 11);
    expect(weighted.var[0]![0]! * weight).toBeCloseTo(ordinary.var[0]![0]!, 11);
    expect(weighted.var[1]![1]! * weight).toBeCloseTo(ordinary.var[1]![1]!, 11);
    expect(weighted.z[0]! / ordinary.z[0]!).toBeCloseTo(Math.sqrt(weight), 10);
    expect(weighted.z[1]! / ordinary.z[1]!).toBeCloseTo(Math.sqrt(weight), 10);
  });

  it("computes a finite midpoint when the endpoint sum overflows", () => {
    // The exact midpoint is (9e307 + 9.5e307)/2 = 9.25e307, within Number.MAX_VALUE.
    // The direct binary64 sum overflows, so the helper must halve the endpoints first.
    expect(9e307 + 9.5e307).toBe(Infinity);
    expect(midpoint(9e307, 9.5e307)).toBe(9.25e307);
  });

  it("rejects invalid weights", () => {
    expect(() => survreg(time, event, x, { weights: [1, 1, 1, 1, 1, 1, 1, 0] })).toThrow("Invalid weights, must be >0");
  });
});
