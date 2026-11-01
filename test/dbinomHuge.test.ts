// dbinom where n - x is not a double (n beyond 2^53), found while fixing #24 (review_fix_log_dbinom_huge.md).
import { describe, expect, it } from "vitest";
import { dbinom } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("dbinom with n - x rounded", () => {
  it("is exact at the mean of n = 1.6e308 with p = 1/4", () => {
    // n rebuilt as x + fl(n - x) was an ulp off, 1e137 standard deviations: 0 (log -2.6e274); R: 7.283656203947058e-155
    expect(rel(dbinom(4e307, 1.6e308, 0.25), 7.283656203947058e-155)).toBeLessThan(1e-13);
    expect(rel(dbinom(4e307, 1.6e308, 0.25, { log: true }), Math.log(7.283656203947058e-155))).toBeLessThan(1e-15);
    // (x = 1.2e308 with p = 3/4 is not the mean: 0.75 n is 1.2e308 + 5e291, 3e137 standard deviations away, so 0)
    expect(dbinom(1.2e308, 1.6e308, 0.75)).toBe(0);
  });

  it("matches exact values at n = 1e20 (Rmpfr, 400 bits)", () => {
    // x = 3e19 + 20480: n - x rounds; the result was 1.2e-12 off
    const cases: [number, number][] = [
      [3e19, 8.705634275513377581e-11],
      [30000000000000020480, 8.7056342754170117383e-11],
      [29999999998771200000, 8.3982161630370166059e-11],
      [30000000003999997952, 5.9477811352754912731e-11],
    ];
    for (const [x, want] of cases) expect(rel(dbinom(x, 1e20, 0.3), want)).toBeLessThan(1e-14);
  });
});
