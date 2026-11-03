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

// Follow-up: with mu far below size, q = 1 - p rounded to 0 and the mode search started at 0 and walked to mu one by one
// (size 1e100, mu 1e30 did not end). Before the fix these tests do not end: the stash check leaves them out and a copy
// with a loop counter showed the search passing 1e6 steps.
describe("issue #236 follow-up: nbinom with mu far below size", () => {
  it("ends for size 1e100, mu 1e30 with the mode and median at 1e30", () => {
    const s = distSummary("nbinom", { size: 1e100, mu: 1e30 });
    // mode floor(mu (size - 1) / size) and R's qnbinom(0.5, 1e100, mu = 1e30) round to 1e30
    expect(s.mode).toBe(1e30);
    expect(s.median).toBe(1e30);
  });

  it("finds the mode below 2^53 (R's qnbinom for the median)", () => {
    // mode floor(mu - mu / size): 1e10 and 123456; qnbinom(0.5, ...) in R: 1e10 and 123456
    const a = distSummary("nbinom", { size: 1e100, mu: 1e10 + 0.5 });
    expect([a.mode, a.median]).toEqual([1e10, 1e10]);
    const b = distSummary("nbinom", { size: 1e30, mu: 123456.5 });
    expect([b.mode, b.median]).toEqual([123456, 123456]);
  });
});

describe("issue #236 follow-up: unchanged values", () => {
  it("keeps the summary where the search ended before", () => {
    // median as before the fix; the moments are those of follow-up 2 (mu / size = 1e-10 < 2^-26: before it, the mean
    // was 10000011930.633959, 1.2e-6 off) and the mode that of follow-up 3 (1e10 before; exact floor(mu - mu / size))
    expect(distSummary("nbinom", { size: 1e20, mu: 1e10 })).toEqual({
      mean: 10000000000,
      variance: 10000000001,
      sd: 100000.000005,
      median: 10000000000,
      mode: 9999999999,
      skewness: 0.000010000000001500001,
      kurtosis: 1.0000000005e-10,
    });
    expect(distSummary("nbinom", { size: 1e100, mu: 2.5 }).mode).toBe(2);
  });
});

// Follow-up 2: with mu / size below 2^-26, q = 1 - p kept only the rounding of p, so the moments were off (size 1e10,
// mu 1: mean 1.0000000828) or 0 and NaN (size 1e20 and beyond with mu 1). They are now formed directly in mu and
// t = mu / size; the expected values are the Rmpfr values of the closed forms rounded to double (within 0.5 ulp).
describe("issue #236 follow-up 2: moments with mu / size below 2^-26", () => {
  it("gives the moments for size 1e10, mu 1", () => {
    expect(distSummary("nbinom", { size: 1e10, mu: 1 })).toEqual({
      mean: 1,
      variance: 1.0000000001,
      sd: 1.00000000005,
      median: 1,
      mode: 0,
      skewness: 1.00000000015,
      kurtosis: 1.0000000005,
    });
  });

  it("gives finite moments where q rounded to 0", () => {
    // (mode 0 since follow-up 3: P(1) / P(0) = size mu / (size + mu) < 1; it was 1 as size - 1 rounded to size)
    for (const size of [1e20, 1e308]) {
      expect(distSummary("nbinom", { size, mu: 1 })).toEqual({ mean: 1, variance: 1, sd: 1, median: 1, mode: 0, skewness: 1, kurtosis: 1 });
    }
    expect(distSummary("nbinom", { size: 1e100, mu: 1e30 })).toEqual({
      mean: 1e30,
      variance: 1e30,
      sd: 1e15,
      median: 1e30,
      mode: 1e30,
      skewness: 1e-15,
      kurtosis: 9.999999999999999e-31,
    });
    // the closed forms' products underflow and overflow here
    expect(distSummary("nbinom", { size: 1e300, mu: 1e-300 })).toEqual({
      mean: 1e-300,
      variance: 1e-300,
      sd: 1e-150,
      median: 0,
      mode: 0,
      skewness: 1e150,
      kurtosis: 9.999999999999999e299,
    });
  });

  it("keeps the values at and above 2^-26 and for mu = 0", () => {
    // values before the fix
    expect(distSummary("nbinom", { size: 1e10, mu: 150 })).toEqual({
      mean: 150.0000002281563,
      variance: 150.00000247815632,
      sd: 12.247448815086198,
      median: 150,
      mode: 149,
      skewness: 0.08164965986779363,
      kurtosis: 0.0066666671565263885,
    });
    expect(distSummary("nbinom", { size: 2 ** 26, mu: 1 })).toEqual({
      mean: 0.9999999999999998,
      variance: 1.000000014901161,
      sd: 1.0000000074505804,
      median: 1,
      mode: 0,
      skewness: 1.0000000223517418,
      kurtosis: 1.0000000745058064,
    });
    // a point mass at 0
    expect(distSummary("nbinom", { size: 1e10, mu: 0 })).toEqual({
      mean: 0,
      variance: 0,
      sd: 0,
      median: 0,
      mode: 0,
      skewness: NaN,
      kurtosis: NaN,
    });
  });
});

// Follow-up 3: the mode test x size <= (size - 1) mu overflowed where (size - 1) mu > 1.8e308, so the bound was
// Infinity and every step passed (size 4.3e305, mu 1.8e11 did not end), and beyond 2^53 size - 1 rounded to size, so an
// integer mu was its own mode. For size beyond 2^53 the test is now exact in integers; the expected modes are
// floor((size - 1) mu / size) in BigInt. The first test does not end before the fix (left out of the stash check).
describe("issue #236 follow-up 3: the mode where size is beyond 2^53", () => {
  it("ends where (size - 1) mu overflows", () => {
    const s = distSummary("nbinom", { size: 4.3258831225385124e305, mu: 180497287704.3662 });
    expect([s.mode, s.median]).toEqual([180497287704, 180497287704]);
    expect(distSummary("nbinom", { size: 1e300, mu: 1e9 }).mode).toBe(999999999);
    expect(distSummary("nbinom", { size: 1e308, mu: 1e10 + 0.5 }).mode).toBe(1e10);
  });

  it("gives the exact mode where the old search ended at a wrong value", () => {
    // before: 1 and 218 (the overflowed bound gave NaN in some steps)
    expect(distSummary("nbinom", { size: 1.7976931348623157e308, mu: 3.5 }).mode).toBe(3);
    expect(distSummary("nbinom", { size: 8.226426892117994e305, mu: 518136.5 }).mode).toBe(518136);
    // an integer mu: floor(mu - mu / size) = mu - 1 (before: mu)
    expect(distSummary("nbinom", { size: 1e30, mu: 1e10 }).mode).toBe(9999999999);
  });
});
