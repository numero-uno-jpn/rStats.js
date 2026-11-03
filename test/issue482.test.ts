// Issue #482: poissonTest with two samples, T2 / T1 overflowing while the binomial limits are subnormal: the interval
// (p / (1 - p)) (T2 / T1) was [Inf, Inf] around an estimate of 1e12 (review_fix_log_issue482.md).
import { describe, expect, it } from "vitest";
import { poissonTest } from "../src/index.js";

const M = Number.MAX_VALUE;

describe("issue #482", () => {
  it("gives the finite limits", () => {
    const r = poissonTest([1, M], { T: [1e-12, M] });
    expect(r.estimate).toBe(1e12);
    // Rmpfr: p / (1 - p) MAX_VALUE / 1e-12 for the binomial limits p = 28505317650971 2^-1074 and
    // 6273112774818427 2^-1074 (R 4.5.2 gives [0, 5.571643e12]: its qbeta(0.025, 1, MAX_VALUE) is 0)
    expect(r.confInt).toEqual([0x17943c5dc12874 * 2 ** -18, 0x1444ff4cef6b97 * 2 ** -10]);
  });

  it("keeps 0, Infinity and ordinary limits", () => {
    expect(poissonTest([0, M], { T: [1e-12, M] }).confInt[0]).toBe(0);
    expect(poissonTest([1, M], { T: [1e-12, M], alternative: "greater" }).confInt[1]).toBe(Infinity);
    expect(poissonTest([5, 0], { T: [1e-12, M] }).confInt).toEqual([Infinity, Infinity]);
    expect(poissonTest([11, 23], { T: [800, 3011] }).confInt).toEqual([0.7922050858330061, 3.8438627403949535]);
  });
});
