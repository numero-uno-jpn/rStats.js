import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rq, rqPredict } from "../src/models/rq.js";

const oracle = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/rq.json", import.meta.url)), "utf8")) as {
  data: { X: { values: number[][] }; y: number[] };
  br_0_25?: { value?: { coef: number[]; rho: number } };
};

describe("quantile regression", () => {
  it("matches the pinned R public-output cases for br", () => {
    const data = { x: oracle.data.X.values.map((row) => row[1]!), y: oracle.data.y };
    const expected = [
      { tau: 0.25, coef: [2, 0.8], rho: 8.05 },
      { tau: 0.5, coef: [4.2, 0.733333333333333], rho: 12.4333333333333 },
      { tau: 0.75, coef: [4.78571428571429, 0.928571428571428], rho: 8.03571428571429 },
    ];
    for (const item of expected) {
      const fit = rq("y ~ x", data, { tau: item.tau, method: "br", eps: 1e-10 });
      expect(fit.coefficients["(Intercept)"]).toBeCloseTo(item.coef[0]!, 7);
      expect(fit.coefficients.x).toBeCloseTo(item.coef[1]!, 7);
      expect(fit.rho).toBeCloseTo(item.rho, 7);
      expect(fit.converged).toBe(true);
    }
  });

  it("fits a one-column median and upper quantile", () => {
    const data = { y: [0, 0, 1] };
    const median = rq("y ~ 1", data, { tau: 0.5 });
    const upper = rq("y ~ 1", data, { tau: 0.75 });
    expect(median.coefficients["(Intercept)"]).toBeCloseTo(0, 8);
    expect(upper.coefficients["(Intercept)"]).toBeCloseTo(1, 8);
    expect(median.rho).toBeCloseTo(0.5, 8);
    expect(upper.rho).toBeCloseTo(0.5, 8);
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


  it("matches the fixture with the dual interior-point method", () => {
    const data = { x: oracle.data.X.values.map((row) => row[1]!), y: oracle.data.y };
    const fit = rq("y ~ x", data, { tau: 0.5, method: "fn", eps: 1e-12, maxit: 200 });
    expect(fit.coefficients["(Intercept)"]).toBeCloseTo(4.2, 7);
    expect(fit.coefficients.x).toBeCloseTo(0.733333333333333, 7);
    expect(fit.rho).toBeCloseTo(12.4333333333333, 8);
    expect(fit.converged).toBe(true);
  });

  it("agrees between vertex descent and the dual solver on a weighted two-predictor problem", () => {
    const data = {
      x: [0, 1, 2, 3, 4, 5, 6, 7],
      z: [0, 1, 0, 1, 0, 1, 0, 1],
      y: [2, 1, 5, 2, 7, 4, 9, 6],
    };
    const weights = [1, 2, 1, 3, 2, 1, 4, 2];
    for (const tau of [0.1, 0.5, 0.9]) {
      const br = rq("y ~ x + z", data, { tau, method: "br", weights, maxit: 500 });
      const fn = rq("y ~ x + z", data, { tau, method: "fn", weights, eps: 1e-12, maxit: 200 });
      expect(br.rho).toBeCloseTo(fn.rho as number, 9);
      expect(br.converged).toBe(true);
      expect(fn.converged).toBe(true);
    }
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
