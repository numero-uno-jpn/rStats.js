// Issue #157: qchisq with ncp where df + ncp overflows.
import { describe, expect, it } from "vitest";
import { pchisq, qchisq } from "../src/index.js";

describe("issue #157", () => {
  it("a quantile beyond the largest double is Infinity", () => {
    // mean 2e308, standard deviation 2.4e154: RangeError (call stack) before; R: NaN
    expect(qchisq(0.5, 1e308, { ncp: 1e308 })).toBe(Infinity);
    expect(qchisq(0.5, 1e308, { ncp: 1e308, lowerTail: false })).toBe(Infinity);
    expect(qchisq(1e-300, 1e308, { ncp: 1e308 })).toBe(Infinity);
    expect(qchisq(1e-300, 1e308, { ncp: 1e308, lowerTail: false })).toBe(Infinity);
    expect(qchisq(-1e5, 1e308, { ncp: 1e308, lowerTail: false, logP: true })).toBe(Infinity);
    // mean 1.8e308
    expect(qchisq(0.5, 1.7e308, { ncp: 1e307 })).toBe(Infinity);
  });

  it("a finite quantile where df + ncp is finite but large", () => {
    // the distribution function steps from 0 to 1 within one double (a spread far below the spacing): RangeError before
    for (const [p, lowerTail] of [[0.5, true], [1e-300, true], [1e-300, false]] as const)
      expect(qchisq(p, 1e308, { ncp: 7e307, lowerTail })).toBe(1.7000000000000001e308);
    expect(pchisq(1.7000000000000001e308, 1e308, { ncp: 7e307 })).toBe(1);
    expect(pchisq(1.7e308, 1e308, { ncp: 7e307 })).toBe(0);
    expect(qchisq(0.999, 8e307, { ncp: 8e307 })).toBe(1.6000000000000002e308);
  });

  it("as before where the bracket stays finite", () => {
    expect(qchisq(0.5, 5e307, { ncp: 5e307 })).toBe(1e308);
    expect(qchisq(0.5, 1.7e308, { ncp: 1e306 })).toBe(1.71e308);
    // 4.13751512339911725 (mpmath): 4.137515123399119 before pgamma's double-double continued fraction (1.2.0)
    expect(qchisq(0.5, 3, { ncp: 2 })).toBe(4.137515123399117);
    expect(qchisq(0.01, 100, { ncp: 1e5, lowerTail: false })).toBe(101576.08685642914);
  });
});
