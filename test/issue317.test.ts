import { describe, expect, it } from "vitest";
import { propTrendTest } from "../src/index.js";

// #317: an infinite score entered the weighted regression, the centred score was Inf - Inf and the statistic NaN.
// R's prop.trend.test stops in lm ("NA/NaN/Inf in 'x'"); NaN stays a missing score.
describe("propTrendTest rejects infinite scores (#317)", () => {
  it("throws for an infinite score", () => {
    expect(() => propTrendTest([1, 2, 3], [10, 10, 10], [1, Infinity, 3])).toThrow("non-missing scores must be finite");
    expect(() => propTrendTest([1, 2, 3], [10, 10, 10], [1, -Infinity, 3])).toThrow("non-missing scores must be finite");
  });

  it("keeps a NaN score as missing", () => {
    // R: prop.trend.test(c(1, 2, 3), c(10, 10, 10), c(1, NA, 3)): X-squared 1.25, p 0.2635525
    const r = propTrendTest([1, 2, 3], [10, 10, 10], [1, NaN, 3]);
    expect(r.statistic).toBeCloseTo(1.25, 14);
    expect(r.pValue).toBeCloseTo(0.2635525, 7);
  });
});
