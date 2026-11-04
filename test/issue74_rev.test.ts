// Revision of issue 74: uniroot with tol = 0 is an error, as R's "invalid 'tol' value" (review_fix_log_issue74_rev.md).
import { describe, expect, it } from "vitest";
import { cohensD, uniroot } from "../src/index.js";

describe("issue 74 revision: uniroot tol", () => {
  it("rejects tol = 0, -0 and a negative tol, as R", () => {
    for (const tol of [0, -0, -1]) {
      expect(() => uniroot((x) => x * x - 2, 0, 2, { tol }), String(tol)).toThrow("'tol' must be a positive finite number");
    }
  });

  it("accepts the smallest positive tol (R returns 1.414214 for tol = 5e-324)", () => {
    expect(uniroot((x) => x * x - 2, 0, 2, { tol: 5e-324 }).root).toBeCloseTo(Math.SQRT2, 15);
  });

  it("keeps the internal tol = 0 roots of the effect sizes (noncentrality of t)", () => {
    const r = cohensD([1, 2, 3, 4, 5], [2, 4, 6, 8, 11]);
    expect(Number.isFinite(r.ciLow!) && Number.isFinite(r.ciHigh!)).toBe(true);
  });
});
