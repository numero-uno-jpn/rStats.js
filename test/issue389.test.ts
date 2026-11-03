// Issue #389: propTrendTest with scores far from 1 (review_fix_log_issue389.md).
import { describe, expect, it } from "vitest";
import { propTrendTest } from "../src/index.js";

describe("issue #389", () => {
  it("gives the statistic of the rescaled scores", () => {
    // R 4.5.2: prop.trend.test(c(0, 1), c(1, 1), c(0, 2^664)) has X-squared 2 (+ 1 ulp), as with scores c(0, 1);
    // was 0 with p 1 here (sxx overflowed)
    const base = propTrendTest([0, 1], [1, 1], [0, 1]);
    for (const score of [[0, 1e200], [0, 2 ** 664], [0, 2 ** -664]]) {
      const r = propTrendTest([0, 1], [1, 1], score);
      expect(r.statistic).toBe(base.statistic);
      expect(r.pValue).toBe(base.pValue);
    }
    // R: 4.655172413793104 (0x1.29ee58469ee59p+2) for scores (1, 2, 3) times 2^700, 1 and 2^-700; here the value for
    // (1, 2, 3) before the fix for all three (was 0 and Infinity for the scaled scores)
    for (const c of [2 ** 700, 1, 2 ** -700]) {
      expect(propTrendTest([15, 10, 7], [30, 30, 30], [1, 2, 3].map((v) => v * c)).statistic).toBe(4.655172413793106);
    }
  });
});
