// Issue #302 (and its duplicate #348): lm with a positive infinite weight (review_fix_log_issue302.md).
import { describe, expect, it } from "vitest";
import { lm } from "../src/index.js";

describe("issue #302: lm rejects infinite weights", () => {
  it("throws for a model with no columns (was residuals [NaN, 2, 3]; R residuals y, sigma Inf)", () => {
    expect(() => lm([[], [], []], [1, 2, 3], { intercept: false, weights: [Infinity, 1, 1] })).toThrow("non-finite weights not allowed");
    expect(() => lm("y ~ 0", { y: [1, 2, 3] }, { weights: [Infinity, 1, 1] })).toThrow("non-finite weights not allowed");
  });

  it("throws the same error with columns (R: NA/NaN/Inf in 'x')", () => {
    expect(() => lm([1, 2, 4], [1, 2, 3], { weights: [Infinity, 1, 1] })).toThrow("non-finite weights not allowed");
    expect(() => lm("y ~ x", { y: [1, 2, 3], x: [1, 2, 4] }, { weights: [1, 1, Infinity] })).toThrow("non-finite weights not allowed");
  });

  it("keeps finite weights and NaN weights (rows dropped) as before", () => {
    const m = lm([1, 2, 4, 5], [1, 2, 3, 7], { weights: [1, 2, NaN, 1] });
    const r = lm([1, 2, 5], [1, 2, 7], { weights: [1, 2, 1] });
    expect(m.coefficients).toEqual(r.coefficients);
    expect(m.sigma).toBe(r.sigma);
  });
});
