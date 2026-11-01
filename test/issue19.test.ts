// Issue #19: distSummary of a hypergeometric point mass (review_fix_log_issue19.md).
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

describe("issue #19", () => {
  it("gives the moments of a point mass for any degenerate population", () => {
    // N = m + n of 0 or 1 gave 0/0: variance NaN, and the mean NaN for N = 0
    for (const [m, n, k] of [[0, 1, 0], [0, 0, 0], [1, 0, 1], [3, 0, 2], [0, 4, 4], [2, 3, 0], [2, 3, 5]] as const) {
      const s = distSummary("hyper", { m, n, k });
      const at = m + n === 0 ? 0 : (k * m) / (m + n);
      expect([s.mean, s.variance, s.sd, s.median, s.mode]).toEqual([at, 0, 0, at, at]);
    }
  });

  it("leaves a proper hypergeometric distribution as before", () => {
    const s = distSummary("hyper", { m: 5, n: 7, k: 4 });
    expect(s.mean).toBe((4 * 5) / 12);
    expect(s.variance).toBeCloseTo((4 * (5 / 12) * (7 / 12) * 8) / 11, 14);
  });
});
