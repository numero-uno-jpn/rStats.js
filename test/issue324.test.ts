// Issue #324: binomTest's upper tail P[X >= x] as pbinom(x - 1, upper) where x - 1 or n - (x - 1) rounds (beyond
// 2^53) (review_fix_log_issue324.md).
import { describe, expect, it } from "vitest";
import { binomTest, dbinom, pbinom } from "../src/index.js";

describe("issue #324", () => {
  it("keeps the point mass at x in the upper tail", () => {
    // true values 1/2 + dbinom(n / 2) / 2 = 0.5000000029724 at the mean
    for (const [x, n] of [[2 ** 53, 2 ** 54], [2 ** 53 + 2, 2 ** 54 + 4]] as const) {
      const r = binomTest(x, n, { p: 0.5, alternative: "greater" });
      expect(r.pValue, `${x}`).toBe(pbinom(x, n, 0.5, { lowerTail: false }) + dbinom(x, n, 0.5));
      expect(r.pValue).toBeCloseTo(0.5000000029724, 12);
    }
  });

  it("keeps exact x - 1 and n - (x - 1) as before", () => {
    expect(binomTest(7, 20, { p: 0.3, alternative: "greater" }).pValue).toBe(pbinom(6, 20, 0.3, { lowerTail: false }));
    expect(binomTest(0, 2 ** 54, { p: 0.5, alternative: "greater" }).pValue).toBe(1);
  });
});
