import { describe, expect, it } from "vitest";
import { rq, rqPredict } from "../src/models/rq.js";

describe("quantile regression", () => {
  it("fits a one-column median and upper quantile", () => {
    const data = { y: [0, 0, 1] };
    const median = rq("y ~ 1", data, { tau: 0.5 });
    const upper = rq("y ~ 1", data, { tau: 0.75 });
    expect(median.coefficients["(Intercept)"]).toBeCloseTo(0, 8);
    expect(upper.coefficients["(Intercept)"]).toBeCloseTo(1, 8);
    expect(median.rho).toBeCloseTo(0.5, 8);
    expect(upper.rho).toBeCloseTo(0.25, 8);
    expect(median.converged).toBe(true);
    expect(upper.converged).toBe(true);
  });

  it("uses prior weights in the quantile objective", () => {
    const fit = rq("y ~ 1", { y: [0, 0, 1] }, { tau: 0.5, weights: [1, 1, 10] });
    expect(fit.coefficients["(Intercept)"]).toBeCloseTo(1, 8);
    expect(fit.rho).toBeCloseTo(1, 8);
  });

  it("fits several quantiles and predicts without a response column", () => {
    const fit = rq("y ~ x", { x: [0, 1, 2, 3, 4], y: [0, 1, 1, 3, 4] }, { tau: [0.25, 0.5, 0.75] });
    const predicted = rqPredict(fit, { x: [1, 2] });
    expect(Array.isArray(predicted[0])).toBe(true);
    expect((predicted as number[][]).length).toBe(3);
    expect((predicted as number[][])[0]!.length).toBe(2);
  });

  it("rejects tau outside the open unit interval and invalid weights", () => {
    expect(() => rq("y ~ 1", { y: [1, 2, 3] }, { tau: 1 })).toThrow(/tau/);
    expect(() => rq("y ~ 1", { y: [1, 2, 3] }, { weights: [1, -1, 1] })).toThrow(/weights/);
  });

  it("is equivariant to response scaling", () => {
    const data = { x: [0, 1, 2, 3, 4, 5], y: [0, 1, 1, 3, 4, 7] };
    const fit = rq("y ~ x", data, { tau: 0.5 });
    const scaled = rq("y ~ x", { x: data.x, y: data.y.map((v) => v * 1e100) }, { tau: 0.5 });
    for (const name of Object.keys(fit.coefficients)) {
      expect((scaled.coefficients[name] as number) / 1e100).toBeCloseTo(fit.coefficients[name] as number, 8);
    }
  });
});
