// Issue #272: powerAnovaTest where (groups - 1) n overflows but the noncentrality is in range (review_fix_log_issue272.md).
import { describe, expect, it } from "vitest";
import { powerAnovaTest } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #272", () => {
  it("forms the noncentrality from the scaled factors where (groups - 1) n overflows", () => {
    // lambda = 2 with df1 = 2 and df2 = Inf: R's pchisq(qchisq(0.05, 2, lower = FALSE), 2, ncp = 2, lower = FALSE)
    // 0.22554491576956397; was the limit 1 (R: NaN)
    const p = powerAnovaTest({ groups: 3, n: 1e308, betweenVar: 1, withinVar: 1e308 }).power;
    expect(rel(p, 0.22554491576956397)).toBeLessThan(1e-14);
    // between 0: lambda 0 and the power is the significance level (was NaN from 0 Inf)
    expect(powerAnovaTest({ groups: 3, n: 1e308, betweenVar: 0, withinVar: 1e308 }).power).toBeCloseTo(0.05, 14);
  });

  it("leaves the other cases as before", () => {
    expect(powerAnovaTest({ groups: 4, n: 5, betweenVar: 1, withinVar: 3 }).power).toBe(0.3535594237229933);
    expect(powerAnovaTest({ groups: 3, n: 10, betweenVar: 1e308, withinVar: 1e308 }).power).toBe(0.9732550750514971);
    // a noncentrality beyond the doubles keeps the limit 1
    expect(powerAnovaTest({ groups: 3, n: 1e308, betweenVar: 1, withinVar: 1e-10 }).power).toBe(1);
  });
});
