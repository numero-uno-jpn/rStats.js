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

  it("takes the normal approximation of F where both degrees of freedom exceed 1e16, as pwrAnovaTest", () => {
    // the issue's example: df1 = 1e200, df2 = Inf, lambda = 1e100; the power is pnorm(qnorm(0.95) - 1 / sqrt(2), upper)
    // to O(1e-100) (R: 0x1.64bc4a803b038p-3); was 0.7602499389065251 (the critical value rounds to 1; R: NaN)
    const p = powerAnovaTest({ groups: 1e200, n: 1e200, betweenVar: 1e8, withinVar: 1e308 }).power;
    expect(rel(p, 0.1741872616179323)).toBeLessThan(1e-14);
    // df1 = df2 = 1e17, 1e18 with lambda = 2 sqrt(df1): the 256-bit references of the #202 follow-up (Davies sum);
    // were 0.2595111267699508 and 0.2595108972704641 (R: 1 with "pnchisq not converged")
    const a = powerAnovaTest({ groups: 1e17, n: 2, betweenVar: Math.sqrt(1e17) / 1e17, withinVar: 1 }).power;
    expect(Math.abs(a - 0.25951102181670718)).toBeLessThan(3e-9);
    const b = powerAnovaTest({ groups: 1e18, n: 2, betweenVar: 1e-9, withinVar: 1 }).power;
    expect(Math.abs(b - 0.25951102251739381)).toBeLessThan(1e-9);
    // lambda = 2 sqrt(df1) for df1 = 1e30: the limit pnorm(qnorm(0.95) - 1, upper) (was 5.2e-175)
    const c = powerAnovaTest({ groups: 1e30, n: 2, betweenVar: 1, withinVar: 1e15 }).power;
    expect(rel(c, 0.25951102284144434)).toBeLessThan(1e-12);
  });

  it("leaves the other cases as before", () => {
    expect(powerAnovaTest({ groups: 4, n: 5, betweenVar: 1, withinVar: 3 }).power).toBe(0.3535594237229933);
    expect(powerAnovaTest({ groups: 3, n: 10, betweenVar: 1e308, withinVar: 1e308 }).power).toBe(0.9732550750514971);
    // a noncentrality beyond the doubles keeps the limit 1
    expect(powerAnovaTest({ groups: 3, n: 1e308, betweenVar: 1, withinVar: 1e-10 }).power).toBe(1);
    // groups - 1 up to 1e16 keeps the exact path (groups 1e16 + 2 has df1 = 1e16)
    expect(powerAnovaTest({ groups: 1e16, n: 2, betweenVar: 1e-8, withinVar: 1 }).power).toBe(0.25951103333841163);
    expect(powerAnovaTest({ groups: 1e16 + 2, n: 2, betweenVar: 1e-8, withinVar: 1 }).power).toBe(0.2595110300979085);
  });
});
