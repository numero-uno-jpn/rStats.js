// Issue #223: poissonTest's expected count where both n r and r T2 / T1 overflow (review_fix_log_issue223.md).
import { describe, expect, it } from "vitest";
import { poissonTest } from "../src/index.js";

/** |a - b| within k units in the last place of b */
const ulps = (a: number, b: number, k: number): boolean => Math.abs(a - b) <= k * Math.abs(b) * 2 ** -52;

describe("issue #223", () => {
  it("gives the finite expected count", () => {
    // R 4.5.2 (the same doubles as hex): poisson.test(c(1e308, 0), r = 2, T = c(1, 1e308))$parameter is NaN; was NaN
    // here. Rmpfr: n r T1 / (T1 + r T2) = 2D / (1 + 2D) rounds to 1
    expect(poissonTest([1e308, 0], { r: 2, T: [1, 1e308] }).parameter).toBe(1);
    // n r overflows (R: "result would be too long a vector"; was Infinity here). Rmpfr: 0x1.c7b1f3cac7433p+1022
    const p4 = poissonTest([1e308, 0], { r: 4, T: [1, 1] }).parameter;
    expect(ulps(p4, 0x1c7b1f3cac7433 * 2 ** (1022 - 52), 2)).toBe(true);
    // r T2 / T1 overflows (R: 0; was 0 here). Rmpfr: 0x1.2725dd1d243acp-60
    const pt = poissonTest([1e300, 0], { r: 2, T: [1e-10, 1e308] }).parameter;
    expect(ulps(pt, 0x12725dd1d243ac * 2 ** (-60 - 52), 2)).toBe(true);
  });

  it("gives 0 for r = 0 where the time bases are out of range", () => {
    // R 4.5.2: poisson.test(c(0, 0), r = 0, T = c(1e-320, 1e308))$parameter is 0 (also for c(1, 1)); was NaN here
    // (0 times T2 / T1 = Inf)
    expect(poissonTest([0, 0], { r: 0, T: [1e-320, 1e308] }).parameter).toBe(0);
    expect(poissonTest([1, 1], { r: 0, T: [1e-320, 1e308] }).parameter).toBe(0);
  });

  it("keeps the expected counts that did not overflow", () => {
    // values before the fix
    expect(poissonTest([11, 23], { T: [800, 3011] }).parameter).toBe(7.137234321700341);
    expect(poissonTest([5, 5], { T: [1e308, 1e308] }).parameter).toBe(5);
    expect(poissonTest([5, 5], { T: [1e-308, 1e-308] }).parameter).toBe(5);
  });
});
