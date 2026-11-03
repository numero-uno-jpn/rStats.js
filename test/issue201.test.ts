// Issue #201: weightedMean where only the sum of the weights overflows (review_fix_log_issue201.md).
import { describe, expect, it } from "vitest";
import { weightedMean } from "../src/index.js";

describe("issue #201", () => {
  it("gives the finite mean where the sum of the weights overflows", () => {
    // R 4.5.2: weighted.mean(c(1e-308, 2e-308, 1e308), c(1e308, 1e308, 0)) is 0 (3 / Inf); was 0 here.
    // The mean of the two values of equal weight: (x1 + x2) / 2 rounded once (the halving is exact)
    expect(weightedMean([1e-308, 2e-308, 1e308], [1e308, 1e308, 0])).toBe((1e-308 + 2e-308) / 2);
    expect(weightedMean([0, 0], [1e308, 1e308])).toBe(0);
  });

  it("keeps the values that did not reach the fallback, and those of the earlier fallback", () => {
    // values before the fix
    expect(weightedMean([1, 2, 3], [3, 1, 1])).toBe(1.6);
    expect(weightedMean([1, 2], [1e308, 1e308])).toBe(1.5);
    expect(weightedMean([1, 2, 3], [1e308, 1e308, 1e308])).toBe(2);
    expect(weightedMean([1e308, 1e308], [1, 1])).toBe(1e308);
    expect(weightedMean([1e308, -1e308, 3], [1, 1, 1])).toBe(1);
    expect(weightedMean([1.5e308, 1.7e308], [3, 1])).toBe(1.55e308);
    expect(weightedMean([1e300, 2e300, 3e300], [1, 2, 1e300])).toBe(3e300);
  });
});
