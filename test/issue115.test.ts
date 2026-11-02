// Issue #115: dnchisq and pnchisq at a subnormal x whose half rounds, with a df large enough that the correction
// factor (x/x2)^(df/2 - 1) overflows while the value at x2 has underflowed to 0 (0 * Inf was NaN)
// (review_fix_log_issue115.md). R 4.5.2: 0 and 0.
import { describe, expect, it } from "vitest";
import { dchisq, pchisq } from "../src/index.js";

const x = 5 * Number.MIN_VALUE;

describe("issue #115", () => {
  it("gives 0, not NaN, where the correction factor overflows", () => {
    expect(dchisq(x, 8000, { ncp: 1 })).toBe(0);
    expect(pchisq(x, 8000, { ncp: 1 })).toBe(0);
    expect(pchisq(x, 8000, { ncp: 1, lowerTail: false })).toBe(1);
    // the logs as before
    expect(dchisq(x, 8000, { ncp: 1, log: true })).toBe(-3002525.7646189737);
    expect(pchisq(x, 8000, { ncp: 1, logP: true })).toBe(-3003276.8893026225);
  });

  it("keeps the finite factors as before", () => {
    expect(dchisq(x, 3, { ncp: 1 })).toBe(1.202652491910255e-162);
    expect(dchisq(x, 1.5, { ncp: 2 })).toBe(8.00682913056487e79);
    expect(pchisq(x, 1.5, { ncp: 2 })).toBe(2.6372661370220695e-243);
  });
});
