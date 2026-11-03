import { describe, expect, it } from "vitest";
import { propTrendTest } from "../src/index.js";

// #318: with fewer than two distinct scores among the groups with a score there is no slope; the statistic was 0 / 0 =
// NaN (R: NA). It is now an error, reversing the NaN chosen in #50 for one score left (review_fix_log_issue318.md).
describe("propTrendTest needs two distinct scores (#318)", () => {
  const message = "at least 2 distinct non-missing scores are needed";

  it("is an error with identical scores or one group with a score", () => {
    expect(() => propTrendTest([1, 2, 3], [10, 10, 10], [5, 5, 5])).toThrow(message);
    expect(() => propTrendTest([1, 2, 3], [10, 10, 10], [5, NaN, 5])).toThrow(message);
    expect(() => propTrendTest([1, 2, 3], [10, 10, 10], [5, NaN, NaN])).toThrow(message);
    expect(() => propTrendTest([1], [10])).toThrow(message);
  });

  it("keeps two distinct scores (R: 0.93749999999999964, p 0.3329216080655661)", () => {
    const r = propTrendTest([1, 2, 3], [10, 10, 10], [1, 1, 3]);
    expect(Math.abs(r.statistic / 0.93749999999999964 - 1)).toBeLessThan(1e-14);
    expect(Math.abs(r.pValue / 0.3329216080655661 - 1)).toBeLessThan(1e-14);
  });
});
