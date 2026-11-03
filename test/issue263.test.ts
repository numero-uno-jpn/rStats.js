// Issue #263: the pwr normal tests' upper critical value for a tiny significance level (review_fix_log_issue263.md).
// References: Rmpfr with qnorm of the upper tail (the log), and pwr 1.3.0, which uses qnorm(sig, lower = FALSE).
import { describe, expect, it } from "vitest";
import { pwr2p2nTest, pwr2pTest, pwrNormTest, pwrPTest } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("issue #263", () => {
  it("takes the quantile of the upper tail where the tail probability is below 1e-8", () => {
    // two-sided, sigLevel 1e-20: Rmpfr 2.7021638088512897e-13 (was 1.08e-30, the lower rejection region only)
    expect(rel(pwrNormTest({ d: 0.3, n: 50, sigLevel: 1e-20 }).power, 2.7021638088512897e-13)).toBeLessThan(5e-14);
    expect(rel(pwrPTest({ h: 0.3, n: 50, sigLevel: 1e-20 }).power, 2.7021638088512897e-13)).toBeLessThan(5e-14);
    // Rmpfr 2.3247992937403084e-15 and 8.5139703098455701e-16 (were 1.16e-27 and 4.53e-27)
    expect(rel(pwr2pTest({ h: 0.3, n: 50, sigLevel: 1e-20 }).power, 2.3247992937403084e-15)).toBeLessThan(5e-14);
    expect(rel(pwr2p2nTest({ h: 0.3, n1: 30, n2: 70, sigLevel: 1e-20 }).power, 8.51397030984557e-16)).toBeLessThan(5e-14);
    // greater: Rmpfr 4.6320520391789115e-13 (was 0)
    const g = pwrNormTest({ d: 0.3, n: 50, sigLevel: 1e-20, alternative: "greater" }).power;
    expect(rel(g, 4.6320520391789115e-13)).toBeLessThan(5e-14);
    // pwr 1.3.0: 7.8568302310827054e-268 for 1e-300 (was 0), 0.0001534479854131442 for 1e-8 (was 4e-9 off)
    expect(rel(pwrNormTest({ d: 0.3, n: 50, sigLevel: 1e-300 }).power, 7.8568302310827054e-268)).toBeLessThan(1e-12);
    expect(rel(pwrNormTest({ d: 0.3, n: 50, sigLevel: 1e-8 }).power, 0.0001534479854131442)).toBeLessThan(1e-14);
    // solving n: pwr 1.3.0 968.4637047396252 (was an error: no sign change on the interval)
    expect(rel(pwrNormTest({ d: 0.3, sigLevel: 1e-20, power: 0.5 }).n, 968.4637047396252)).toBeLessThan(1e-10);
  });

  it("leaves the other levels as before", () => {
    expect(pwrNormTest({ d: 0.3, n: 50 }).power).toBe(0.5641160254310038);
    expect(pwrNormTest({ d: 0.3, n: 50, alternative: "greater" }).power).toBe(0.6831290430800077);
    expect(pwrNormTest({ d: 0.3, n: 50, sigLevel: 2e-8 }).power).toBe(0.00024089565995133398);
    expect(pwrNormTest({ d: 0.3, n: 50, sigLevel: 1e-20, alternative: "less" }).power).toBe(2.521867024772904e-30);
    expect(pwrNormTest({ d: 0.3, n: 50, sigLevel: 0 }).power).toBe(0);
  });
});
