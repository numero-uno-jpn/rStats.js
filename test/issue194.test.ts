// Issue #194: the formula fit with weights so far apart that the common scaling took the small one below the normal
// range before the square root (review_fix_log_issue194.md).
import { describe, expect, it } from "vitest";
import { lm } from "../src/index.js";

describe("issue #194: lm weights scaled before the square root", () => {
  it("keeps a row of weight 1e-308 next to one of 1e308 (was NaN; R 1, 2)", () => {
    const f = lm("y ~ 0 + a + b", { y: [1, 2], a: [1, 0], b: [0, 1], w: [1e308, 1e-308] }, { weights: "w" });
    expect(f.rank).toBe(2);
    expect(f.coefficients).toEqual([1, 2]);
    expect(f.fittedValues).toEqual([1, 2]);
    expect(f.residuals).toEqual([0, 0]);
    // the effects sqrt(w) y: 1e154 and 2e-154 (up to sign and the rounding of sqrt)
    expect(Math.abs(f.effects[0]!) / Math.sqrt(1e308)).toBeCloseTo(1, 14);
    expect(Math.abs(f.effects[1]!) / (2 * Math.sqrt(1e-308))).toBeCloseTo(1, 14);
    // the matrix form (double precision only) gave the same before
    const m = lm([[1, 0], [0, 1]], [1, 2], { weights: [1e308, 1e-308], intercept: false });
    expect(m.coefficients).toEqual([1, 2]);
  });

  it("leaves weights within range as before", () => {
    const f = lm("y ~ 0 + a + b", { y: [1, 1.5, 2, 3], a: [1, 1, 0, 0], b: [0, 0, 1, 1], w: [1, 1, 1e-16, 3e-16] }, { weights: "w" });
    expect(f.coefficients).toEqual([1.25, 2.75]);
    expect(f.coefTable.stdError).toEqual([0.17677669529663692, 12500000.000000004]);
    expect(f.effects).toEqual([-1.7677669529663689, -5.4999999999999996e-8, -0.17677670279663688, -0.30618621351777026]);
    expect(f.sigma).toBe(0.25000000000000006);
  });
});
