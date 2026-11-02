// Issue #37: wilcox and signrank are NaN when the end of the support is beyond 2^53, judged exactly
// (review_fix_log_issue37.md).
import { describe, expect, it } from "vitest";
import { dsignrank, dwilcox, psignrank, pwilcox, qsignrank, qwilcox } from "../src/index.js";

describe("issue #37", () => {
  it("wilcox: an exact mn of 2^53 + 1 (rounded to 2^53) is NaN", () => {
    const m = 3;
    const n = 3002399751580331;
    expect(BigInt(m) * BigInt(n)).toBe(2n ** 53n + 1n);
    // the upper tail at 2^53 (one below the maximum) was -Inf, its endpoint taken as 2^53
    expect(pwilcox(2 ** 53, m, n, { lowerTail: false, logP: true })).toBeNaN();
    expect(pwilcox(2 ** 53, m, n)).toBeNaN();
    expect(dwilcox(2 ** 53, m, n)).toBeNaN();
    expect(qwilcox(0, m, n)).toBeNaN();
  });

  it("wilcox: an exact mn of 2^53 is kept", () => {
    const log = -Math.log(2 ** 52 + 1) - Math.log(2 ** 52 + 2) + Math.log(2);
    expect(pwilcox(0, 2, 2 ** 52, { logP: true })).toBeCloseTo(log, 12);
    expect(dwilcox(2 ** 53, 2, 2 ** 52, { log: true })).toBeCloseTo(log, 12);
    expect(pwilcox(2 ** 53 - 1, 2, 2 ** 52, { lowerTail: false, logP: true })).toBeCloseTo(log, 12);
    expect(qwilcox(0, 2, 2 ** 52)).toBe(0);
  });

  it("signrank: n(n + 1)/2 beyond 2^53 is NaN", () => {
    const n = 134217733;
    // n(n + 1)/2 = 9007199992938511 rounds to ...512, outside the support; dsignrank gave -9.3e7 there
    expect(dsignrank(9007199992938512, n, { log: true })).toBeNaN();
    expect(psignrank(5, n)).toBeNaN();
    expect(qsignrank(0, n)).toBeNaN();
    expect(dsignrank(0, 2 ** 27)).toBeNaN();
  });

  it("signrank: the largest n with n(n + 1)/2 <= 2^53 is kept", () => {
    const n = 2 ** 27 - 1;
    expect((BigInt(n) * BigInt(n + 1)) / 2n <= 2n ** 53n).toBe(true);
    expect(dsignrank(1, n, { log: true })).toBeCloseTo(-n * Math.LN2, 6);
    expect(qsignrank(0, n)).toBe(0);
    expect(dsignrank(5, 10)).toBe(dsignrank(50, 10));
  });
});
