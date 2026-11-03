// Issue #192: zTest's estimate where the scaling set by sigma underflows the data (review_fix_log_issue192.md).
import { describe, expect, it } from "vitest";
import { zTest } from "../src/index.js";

describe("issue #192", () => {
  it("reports the sample means of data far below sigma", () => {
    // R 4.5.2 (the same doubles, as mantissa times a power of 2): mean(x) is 0x1.cc359e067a348p-1023, the double 2e-308
    // (Rmpfr agrees); the estimate of a z test is mean(x). Was 0 here
    const one = zTest([1e-308, 2e-308, 3e-308], { sigmaX: 1e308 });
    expect(one.estimate).toBe(2e-308);
    // the interval and the statistic are unchanged (the half width 1.96 sigma / sqrt(3) dwarfs the mean)
    expect(one.confInt).toEqual([-1.1315857340761718e308, 1.1315857340761718e308]);
    expect(one.statistic).toBe(0);
    const two = zTest([2e-308, 4e-308, 6e-308], [1e-308, 2e-308, 3e-308], { sigmaX: 1e308, sigmaY: 1 });
    expect(two.estimate).toEqual([4e-308, 2e-308]);
    // a subnormal mean rounded once: R's mean(c(1e-308, 1e-308, 2e-308)) is 0x996734acd366d times 2^-1074 (the exact
    // mean is 1/3 unit above it); averaging in the own scale and scaling back had given one unit more
    const sub = zTest([1e-308, 1e-308, 2e-308], { sigmaX: 1e308 }).estimate as number;
    expect(sub).toBe(0x996734acd366d * 2 ** -1000 * 2 ** -74);
  });

  it("keeps the estimates where the scaling does not underflow", () => {
    // values before the fix
    expect(zTest([1, 2, 3.5, 4], { sigmaX: 2 }).estimate).toBe(2.625);
    expect(zTest([1e-308, 1e-308, 2e-308], { sigmaX: 1 }).estimate).toBe(0x996734acd366d * 2 ** -1000 * 2 ** -74);
    expect(zTest([1e200, 2e200, 3.5e200], { sigmaX: 1e-100 }).estimate).toBe(2.1666666666666665e200);
    expect(zTest([0.1, 0.7, 0.35, 1e-5], [3, 2.2, 1.1], { sigmaX: 2, sigmaY: 1e5 }).estimate).toEqual([0.2875025, 2.1]);
  });
});
