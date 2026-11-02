// Issue #134: Kendall's corTest with exact: false gave NaN for n = 2. The second tie term of the variance of S,
// sum t(t-1)(t-2) * sum u(u-1)(u-2) / (9 n (n-1)(n-2)), is 0/0 there (R also gives NaN); with n = 2 every tie group
// has t <= 2, so the term is 0 (review_fix_log_issue134.md). Var S = n(n-1)(2n+5)/18 = 1, S = 1, z = 1.
import { describe, expect, it } from "vitest";
import { corTest } from "../src/index.js";

describe("issue #134", () => {
  it("drops the zero tie term for n = 2", () => {
    const r = corTest([1, 2], [1, 2], { method: "kendall", exact: false });
    expect(r.statistic).toBe(1);
    expect(r.pValue).toBeCloseTo(0.31731050786291404, 15);
    const less = corTest([1, 2], [2, 1], { method: "kendall", exact: false, alternative: "less" });
    expect(less.statistic).toBe(-1);
    const cc = corTest([1, 2], [1, 2], { method: "kendall", exact: false, continuity: true });
    expect(cc.statistic).toBe(0);
    expect(cc.pValue).toBe(1);
  });

  it("keeps n >= 3 as R", () => {
    // R: cor.test(c(1,2,3), c(1,3,2), method = "kendall", exact = FALSE) (0x1.0b621e9bc3addp-1, 0x1.33f8dfcb668e6p-1)
    const r = corTest([1, 2, 3], [1, 3, 2], { method: "kendall", exact: false });
    expect(r.statistic).toBe(0.5222329678670935);
    expect(r.pValue).toBe(0.6015081344405899);
  });
});
