// External review of binomTest and poissonTest (review_fix_log_20261031_57.md).
import { describe, expect, it } from "vitest";
import { binomTest, poissonTest } from "../src/index.js";

describe("review 57", () => {
  it("HTEST-006, HTEST-007, HTEST-008: totals that overflow and a time base of 0 are errors", () => {
    // NaN p-values before (R: NaN for binom.test, an error for poisson.test); T = 0 gave NaN and Infinity (R too)
    expect(() => binomTest([1e308, 1e308], { alternative: "less" })).toThrow(/'n' must be/);
    expect(() => poissonTest([1e308, 1e308])).toThrow(/'x' must be/);
    expect(() => poissonTest(0, { T: 0 })).toThrow(/'T' must be positive/);
    expect(() => poissonTest(1, { T: 0 })).toThrow(/'T' must be positive/);
    expect(() => poissonTest([1, 2], { T: [1, 0] })).toThrow(/'T' must be positive/);
    // a rate r of 0 is still accepted, as in R
    expect(poissonTest(0, { r: 0 }).pValue).toBe(1);
  });

  it("HTEST-009: two-sample poissonTest where the time bases overflow or are subnormal", () => {
    // p0 = r T1 / (r T1 + T2) was 0 (p-value 0) at T = 1e308, and the rate ratio NaN at 1e-308 (R too)
    for (const T of [[1e308, 1e308], [1e-308, 1e-308]]) {
      const r = poissonTest([5, 5], { T });
      expect(r.pValue).toBe(1);
      expect(r.parameter).toBe(5);
      expect(r.estimate).toBe(1);
    }
    // ordinary time bases as before
    const o = poissonTest([11, 23], { T: [800, 3011] });
    expect(o.estimate).toBe(11 / 800 / (23 / 3011));
    expect(o.parameter).toBe((34 * 800) / (800 + 3011));
  });

  it("HTEST-010: the upper confidence limit at a confidence level next to 1", () => {
    // 1 - alpha rounded to 1: the limits were 1 and Infinity
    const b = binomTest(5, 10, { confLevel: 0.9999999999999999 }).confInt;
    expect(Math.abs(b[1] / 0.9998143636044187 - 1)).toBeLessThan(1e-13);
    const p = poissonTest(5, { confLevel: 0.9999999999999999 }).confInt;
    expect(Math.abs(p[1] / 52.54906424873604 - 1)).toBeLessThan(1e-12);
    // the ordinary levels as before (R's 1 - alpha)
    expect(binomTest(5, 10).confInt[1]).toBe(0.8129139715526015); // R: 0.812914
    expect(poissonTest(5).confInt[1]).toBe(poissonTest(5, { confLevel: 0.95 }).confInt[1]);
  });
});

describe("review 57 large counts", () => {
  it("HTEST-005: binomTest and poissonTest with counts beyond 2^53 return", () => {
    // the bisection in firstTrue and lastTrue never ended once its midpoint rounded to an end (R: "too long a vector")
    const t0 = performance.now();
    for (const v of [binomTest(0, 1e20).pValue, binomTest(1e20, 1e20).pValue, poissonTest(0, { r: 1e20 }).pValue]) {
      expect(v >= 0 && v <= 1).toBe(true);
    }
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
