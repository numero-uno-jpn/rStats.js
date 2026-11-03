// Issue #325: poissonTest with two samples, x1 = 0 and T2 / T1 overflowing: the rate ratio and the lower limit were
// 0 Inf = NaN (review_fix_log_issue325.md).
import { describe, expect, it } from "vitest";
import { poissonTest } from "../src/index.js";

describe("issue #325", () => {
  it("gives the rate ratio 0 and the interval [0, Inf) as R", () => {
    for (const alternative of ["two.sided", "less", "greater"] as const) {
      const r = poissonTest([0, 1], { T: [Number.MIN_VALUE, 1e308], alternative });
      expect(r.estimate).toBe(0);
      expect(r.confInt).toEqual([0, Infinity]);
      expect(r.pValue).toBe(1);
    }
  });
});
