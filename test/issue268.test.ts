// Issue #268: mcnemarTest's continuity correction stops at 0 where fractional counts give abs(b - c) < 1
// (review_fix_log_issue268.md).
import { describe, expect, it } from "vitest";
import { mcnemarTest } from "../src/entries/tests.js";

describe("issue #268", () => {
  it("clamps the corrected difference at 0", () => {
    // R 4.5.2 squares abs(b - c) - 1 = -0.5: statistic 0x1.999999999999ap-4 (0.1), p 0.7518296 (the same as without
    // the correction); the corrected difference max(0, 0.5 - 1) is 0
    const r = mcnemarTest([[0, 1.5], [1, 0]], { correct: true });
    expect(r.statistic).toBe(0);
    expect(r.pValue).toBe(1);
    expect(r.method).toBe("McNemar's Chi-squared test with continuity correction");
    // R: 0x1.6666666666666p-1 (0.7, larger than 0.129 without the correction)
    expect(mcnemarTest([[0, 0.5], [0.2, 0]]).statistic).toBe(0);
  });

  it("leaves abs(b - c) >= 1 as before", () => {
    // R 4.5.2 mcnemar.test(matrix(c(3, 2, 5, 4), 2)) and the others, printed with %a (0x1.2492492492492p-1,
    // 0x1.cc7c01b6392a8p-2; 0, 1; 0x1.2492492492492p-4, 0x1.941af0500ce87p-1). The statistics are R's; the p-values
    // are the values before the fix, 2 ulps below and 1 ulp above R's (the chi-squared tail, not the correction)
    const cases: [number[][], number, number][] = [
      [[[3, 5], [2, 4]], 0.5714285714285714, 0.4496917979688909],
      [[[3, 3], [2, 4]], 0, 1],
      [[[0, 2.5], [1, 0]], 0.07142857142857142, 0.7892680261342813],
    ];
    for (const [x, statistic, p] of cases) {
      const r = mcnemarTest(x);
      expect(r.statistic).toBe(statistic);
      expect(r.pValue).toBe(p);
    }
  });
});
