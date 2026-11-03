// Issue #236: distSummary("nbinom") with mu formed p = size / (size + mu), and the sum overflowed for size = mu = 1e308
// (p = 0, NaN throughout). Where the sum overflows, p is now formed from the halved parameters
// (review_fix_log_issue236.md).
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

describe("issue #236", () => {
  it("accepts size and mu whose sum overflows", () => {
    const s = distSummary("nbinom", { size: 1e308, mu: 1e308 });
    // the same as prob = 1/2
    expect(s).toEqual(distSummary("nbinom", { size: 1e308, prob: 0.5 }));
    expect(s.mean).toBe(1e308);
    expect(s.variance).toBe(Infinity); // 2e308
    expect(s.mode).toBe(1e308);
    expect(s.sd).toBe(1.4142135623730953e154);
    expect(s.skewness).toBe(2.1213203435596425e-154);
    expect(s.kurtosis).toBe(6.499999999999999e-308);
    // the median is beyond 2^53: NaN, as qnbinom
    expect(s.median).toBeNaN();
  });

  it("agrees with the parameters divided by a power of 2", () => {
    const k = 2 ** 10;
    const s = distSummary("nbinom", { size: 1.5e308, mu: 1.7e308 });
    const t = distSummary("nbinom", { size: 1.5e308 / k, mu: 1.7e308 / k });
    expect(s.mean).toBe(t.mean * k);
    expect(s.mean).toBe(1.7e308);
    expect(s.mode).toBe(1.7e308);
    // (sd from the factors where the variance overflows: within an ulp of sqrt(variance))
    expect(Math.abs(s.sd / (t.sd * 2 ** 5) - 1)).toBeLessThan(3e-16);
    expect(s.skewness).toBe(t.skewness / 2 ** 5);
    expect(s.kurtosis).toBe(t.kurtosis / k);
    expect(s.variance).toBe(Infinity);
  });

  it("keeps the values where the sum is finite", () => {
    expect(distSummary("nbinom", { size: 1e200, mu: 1e200 })).toEqual({
      mean: 1e200,
      variance: 2e200,
      sd: 1.414213562373095e100,
      median: 1e200,
      mode: 1e200,
      skewness: 2.1213203435596425e-100,
      kurtosis: 6.5e-200,
    });
    expect(distSummary("nbinom", { size: 1, mu: 1e308 }).mean).toBe(1e308);
    expect(distSummary("nbinom", { size: 1, mu: Infinity }).mean).toBeNaN();
  });
});
