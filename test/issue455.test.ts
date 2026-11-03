// Issue #455: lm's matrix form checks negative weights on the rows kept only (review_fix_log_issue455.md).
import { describe, expect, it } from "vitest";
import { lm } from "../src/index.js";

describe("issue #455", () => {
  it("drops a row with a negative weight and a missing value", () => {
    // R: lm(c(2, 3, 5, 9) ~ c(1, 2, 4, NA), weights = c(1, 2, 1, -1)) and lm(c(2, 3, 5, NA) ~ c(1, 2, 4, 8), ...):
    // coefficients 0x1p+0 0x1p+0 (the same with x as a one-column matrix)
    const w = [1, 2, 1, -1];
    for (const fit of [
      lm([[1], [2], [4], [NaN]], [2, 3, 5, 9], { weights: w }),
      lm([1, 2, 4, 8], [2, 3, 5, NaN], { weights: w }),
      lm([1, 2, 4, 8], [2, 3, 5, 9], { weights: [1, 2, 1, NaN] }),
    ]) {
      expect(fit.coefficients.map((c) => Math.abs(c - 1) < 1e-14)).toEqual([true, true]);
    }
    // R: lm(c(2, NA) ~ c(1, NA), weights = c(1, -1)): intercept 2, slope NA
    const one = lm([[1], [NaN]], [2, NaN], { weights: [1, -1] });
    expect(one.coefficients[0]).toBeCloseTo(2, 14);
    expect(one.coefficients[1]).toBeNaN();
  });

  it("keeps the error for a negative weight on a complete row", () => {
    // R: lm(c(2, 3, 5, 9) ~ c(1, 2, 4, 8), weights = c(1, 2, 1, -1)): "missing or negative weights not allowed"
    expect(() => lm([1, 2, 4, 8], [2, 3, 5, 9], { weights: [1, 2, 1, -1] })).toThrow("missing or negative weights not allowed");
  });
});
