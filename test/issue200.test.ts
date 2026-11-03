// Issue #200: pwrAnovaTest where k n overflows, and the F test with huge degrees of freedom (review_fix_log_issue200.md).
import { describe, expect, it } from "vitest";
import { pwrAnovaTest } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #200", () => {
  it("forms the noncentrality from the scaled factors and takes the normal approximation of F for huge k", () => {
    // ncp = 1 with df1 = 1e160 and df2 = Inf: the power is 0.05 + 7e-82 (was the limit 1; R: NaN)
    expect(rel(pwrAnovaTest({ k: 1e160, n: 1e160, f: 1e-160 }).power, 0.05)).toBeLessThan(1e-14);
    // f = 0 there: ncp 0 and the significance level (was NaN from Inf 0)
    expect(rel(pwrAnovaTest({ k: 1e160, n: 1e160, f: 0 }).power, 0.05)).toBeLessThan(1e-14);
    // ncp = 3 with df1 = 2 and df2 = Inf: R's pwr.anova.test(k = 3, n = 1e300, f = 1e-150) 0x1.493d98d7bc4e9p-2 (was 1)
    expect(rel(pwrAnovaTest({ k: 3, n: 1e308, f: 1e-154 }).power, 0.3215240365671677)).toBeLessThan(1e-14);
    // n = 2, so df1 = df2 = k - 1, and ncp = 2 sqrt(df1): the limit pnorm(qnorm(0.95) - 1, upper)
    // (R: 0x1.09bd41f038d84p-2); was 0.2592 for k = 1e24 and 0 for 1e40 and 1e200
    for (const [k, f] of [[1e24, 1e-6], [1e40, 1e-10], [1e200, 1e-50]] as const) {
      expect(rel(pwrAnovaTest({ k, n: 2, f }).power, 0.25951102284144434)).toBeLessThan(1e-10);
    }
  });

  it("leaves the other cases as before", () => {
    expect(pwrAnovaTest({ k: 4, n: 20, f: 0.25 }).power).toBe(0.42039009037704295);
    expect(pwrAnovaTest({ k: 4, f: 0.25, power: 0.8 }).n).toBe(44.599274320396226);
    expect(pwrAnovaTest({ k: 3, n: 1e300, f: 1e-150 }).power).toBe(0.32152403656716777);
    // (k = 1e20, n = 2 is above the threshold since it was lowered to 1e16: test/issue202.test.ts; k = 1e16 is not)
    expect(pwrAnovaTest({ k: 1e16, n: 2, f: 1e-4 }).power).toBe(0.25951103333841163);
    // a noncentrality beyond the doubles keeps the limit 1
    expect(pwrAnovaTest({ k: 4, n: 20, f: 1e200 }).power).toBe(1);
    expect(pwrAnovaTest({ k: Infinity, n: 20, f: 0.1 }).power).toBe(1);
  });
});
