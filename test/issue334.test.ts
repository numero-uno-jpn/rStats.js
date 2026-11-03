// Issue #334: weightedMean lost a small residual weight in its overflow fallback (review_fix_log_issue334.md).
import { describe, expect, it } from "vitest";
import { weightedMean } from "../src/index.js";

describe("issue #334", () => {
  it("keeps the residual of signed weights that cancel", () => {
    // R 4.5.2: weighted.mean(c(1e308, 1e308, 1e308), c(1e308, -1e308, 1e-308)) is NaN (Inf - Inf); was NaN here
    expect(weightedMean([1e308, 1e308, 1e308], [1e308, -1e308, 1e-308])).toBe(1e308);
    // (2^1000 - 2^1000 + 3 2^-1000) / 2^-1000
    expect(weightedMean([2 ** 1000, 2 ** 1000, 3], [2 ** 1000, -(2 ** 1000), 2 ** -1000])).toBe(3);
    // (1 2^-1022 + 2 (3 2^-1022)) / (4 2^-1022) = 7 / 4
    expect(weightedMean([1e308, 1e308, 1, 2], [1e308, -1e308, 2 ** -1022, 3 * 2 ** -1022])).toBe(1.75);
    // the exact quotient is beyond the double range
    expect(weightedMean([1e308, 2, 3], [1e308, -1e308, 1e-308])).toBe(Infinity);
  });

  it("keeps the earlier values", () => {
    expect(weightedMean([1, 2, 3], [3, 1, 1])).toBe(1.6);
    expect(weightedMean([1e308, 1e308], [1, 1])).toBe(1e308);
    expect(weightedMean([1e308, -1e308, 3], [1, 1, 1])).toBe(1);
    expect(weightedMean([1.5e308, 1.7e308], [3, 1])).toBe(1.55e308);
    expect(weightedMean([1e-308, 2e-308, 1e308], [1e308, 1e308, 0])).toBe((1e-308 + 2e-308) / 2);
    // weights that sum to 0: no mean, as before
    expect(weightedMean([1, 2], [1, -1])).toBe(-Infinity);
    expect(weightedMean([1e308, 1e308], [1e308, -1e308])).toBeNaN();
  });
});
