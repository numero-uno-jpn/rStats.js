// Issue #364: weightedMean lost products that underflow (review_fix_log_issue364.md).
import { describe, expect, it } from "vitest";
import { weightedMean } from "../src/index.js";

describe("issue #364", () => {
  it("keeps products below the normal range", () => {
    // R 4.5.2: weighted.mean(2^-664, 2^-664) is 0 (the product underflows); was 0 here
    expect(weightedMean([1e-200], [1e-200])).toBe(1e-200);
    expect(weightedMean([2 ** -664], [2 ** -664])).toBe(2 ** -664);
    // (2^-1400 + 3 2^-1400) / (2 2^-700) = 2^-699
    expect(weightedMean([2 ** -700, 3 * 2 ** -700], [2 ** -700, 2 ** -700])).toBe(2 ** -699);
    // a subnormal product and one below the double range: (2^-1050 + 2^-1100) / (2^-1050 + 2^-600) rounds to
    // 2^-450 + 2^-500 (was 2^-450)
    expect(weightedMean([1, 2 ** -500], [2 ** -1050, 2 ** -600])).toBe(2 ** -450 + 2 ** -500);
  });

  it("keeps the values of products in range", () => {
    expect(weightedMean([1, 2, 3], [3, 1, 1])).toBe(1.6);
    expect(weightedMean([0, 1e-200], [1e-200, 1])).toBe(1e-200);
    expect(weightedMean([1e-300, 2e-300], [1, 1])).toBe(1.5e-300);
  });
});
