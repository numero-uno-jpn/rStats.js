// Issue #244: distSummary("hyper") formed the excess kurtosis from products of four counts and N^3, which overflow for
// large counts (m = n = k = 1e150: NaN for about -1e-150). Where they overflow, numerator and denominator are now
// divided by N^5 and formed in the ratios m / N, n / N, k / N and (N - k) / N (review_fix_log_issue244.md). References:
// exact rationals (Python fractions) on the exact integers, rounded once.
import { describe, expect, it } from "vitest";
import { distSummary } from "../src/index.js";

const kurt = (m: number, n: number, k: number): number => distSummary("hyper", { m, n, k }).kurtosis;

describe("issue #244", () => {
  it("gives the kurtosis of m = n = k = 1e150", () => {
    expect(kurt(1e150, 1e150, 1e150)).toBe(-1e-150);
    expect(distSummary("hyper", { m: 1e150, n: 1e150, k: 1e150 }).skewness).toBe(0);
  });

  it("agrees with exact rationals where the products overflow", () => {
    const cases: [number, number, number, number][] = [
      [1e200, 1e200, 1e200, -1e-200],
      [1e200, 3e200, 1e200, -1.388888888888889e-200],
      [3e200, 1e200, 2e199, -4.008771929824561e-200],
      [1e200, 1e100, 1e150, 1e-50],
      [1e100, 1e100, 1e100, -1e-100],
      [1e80, 3e79, 5e79, -4.11474358974359e-80],
      [1e150, 2e150, 3e149, -4.555555555555555e-150],
      [1e300, 1e300, 7, -0.2857142857142857],
    ];
    for (const [m, n, k, ref] of cases) expect(Math.abs(kurt(m, n, k) / ref - 1), `${m} ${n} ${k}`).toBeLessThan(5e-16);
  });

  it("keeps the values where the products are finite", () => {
    // (these are the values of the closed form before the fix)
    expect(kurt(10, 7, 5)).toBe(-0.22786394557823128);
    expect(kurt(1e15, 1e6, 40)).toBe(24999999.899995122);
    expect(kurt(1e6, 1e15, 1e6)).toBe(999.9999910000049);
  });
});
