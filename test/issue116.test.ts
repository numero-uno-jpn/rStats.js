// Issue #116: df and pf where m x is beyond 1e290 but n is larger still, which took the callers' p ≈ 1 (meant for
// m x far above n) and gave the wrong tail (review_fix_log_issue116.md). The references are the beta coordinates:
// pf(x, m, n) = pbeta(p, m/2, n/2), p = m x / (n + m x), and log df = log dbeta(p, m/2, n/2) + log(dp/dx),
// dp/dx = m n / (n + m x)^2. R 4.5.2 gives the lower tail (log 0) but -Inf for the upper tail and the log density.
import { describe, expect, it } from "vitest";
import { dbeta, df, pbeta, pf } from "../src/index.js";

const S = 2 ** -600;
const rel = (a: number, b: number): number => (a === b ? 0 : Math.abs(a - b) / Math.max(1, Math.abs(b)));

describe("issue #116", () => {
  it("takes the beta coordinate from m x and n scaled together", () => {
    for (const [x, m, n] of [[1e150, 1e150, 1e308], [1e200, 1e100, 1e305], [3e295, 1, 1e300]] as [number, number, number][]) {
      const mx = m * S * x;
      const p = mx / (n * S + mx);
      const label = `${x}, ${m}, ${n}`;
      expect(rel(pf(x, m, n, { logP: true }), pbeta(p, m / 2, n / 2, { logP: true })), label).toBeLessThan(1e-14);
      expect(rel(pf(x, m, n, { lowerTail: false, logP: true }), pbeta(p, m / 2, n / 2, { lowerTail: false, logP: true })), label).toBeLessThan(1e-14);
      const logJacobian = Math.log(m) + Math.log(n) - 2 * (Math.log(n) + Math.log1p(mx / (n * S)));
      expect(rel(df(x, m, n, { log: true }), dbeta(p, m / 2, n / 2, { log: true }) + logJacobian), label).toBeLessThan(1e-14);
    }
    expect(pf(1e150, 1e150, 1e308)).toBe(1);
  });

  it("keeps m x far above n as before", () => {
    expect(pf(1e300, 5, 7, { lowerTail: false, logP: true })).toBe(-2414.487622514107);
    expect(df(1e300, 5, 7, { log: true })).toBe(-3104.0103874438255);
    expect(df(1e295, 10, 1e10, { log: true })).toBe(-3292696683552.2627);
  });
});
