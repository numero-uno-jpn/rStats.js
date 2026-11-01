// Issue #26: chisq with df = -5e-324, whose half rounds to -0 (review_fix_log_issue26.md).
import { describe, expect, it } from "vitest";
import { dchisq, pchisq, qchisq } from "../src/index.js";

describe("issue #26", () => {
  it("is NaN for a negative df, also the least subnormal", () => {
    // df / 2 rounded to -0, the point mass at 0: Infinity, 0, 1, 0 (R 4.5.2 too)
    const df = -Number.MIN_VALUE;
    expect([dchisq(0, df), dchisq(1, df), pchisq(1, df), qchisq(0.5, df)]).toEqual([NaN, NaN, NaN, NaN]);
    // df = 0 is the point mass, as before
    expect([dchisq(1, 0), pchisq(1, 0), qchisq(0.5, 0)]).toEqual([0, 1, 0]);
    expect(pchisq(3, 2)).toBeCloseTo(-Math.expm1(-1.5), 15);
  });
});
