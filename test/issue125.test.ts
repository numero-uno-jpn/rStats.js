// Issue #125: splinefun (all methods) and splinefunH where the range of the knots overflows.
import { describe, expect, it } from "vitest";
import { spline, splinefun, splinefunH } from "../src/index.js";

describe("issue #125", () => {
  it("splinefun's cubic methods on knots from -1e308 to 1e308", () => {
    // 0 (R too; hyman and monoH.FC NaN in R) where the spacing overflowed
    for (const method of ["fmm", "natural", "monoH.FC"] as const) {
      const s = splinefun([-1e308, 1e308], [0, 1], { method });
      expect(s([0, -1e308, 1e308, -5e307])).toEqual([0.5, 0, 1, 0.25]);
      expect(s([0, -5e307], 1)).toEqual([5e-309, 5e-309]); // the slope 1 / 2e308
      expect(s([0], 2)).toEqual([0]);
      expect(s([0], 3)).toEqual([0]);
    }
    // hyman's Hermite rebuild rounds by an ulp here, as on the ordinary scale (R's too, the other way)
    const h = splinefun([-1e308, 1e308], [0, 1], { method: "hyman" });
    expect(h([0, -5e307])).toEqual([0.5000000000000001, 0.25]);
    expect(h([0], 1)).toEqual([5e-309]);
  });

  it("periodic, where only the period overflows", () => {
    // the spacings 1.5e308 are finite; NaN before (R: 0 and 1, wrong)
    const p = splinefun([-1.5e308, 0, 1.5e308], [0, 1, 0], { method: "periodic" });
    expect(p([0, -7.5e307, 7.5e307, 1.5e308])).toEqual([1, 0.5, 0.5, 0]);
    expect(p([-7.5e307, 7.5e307], 1)).toEqual([1e-308, -1e-308]);
    // spline takes the same condition (the range, not only neighbouring spacings): NaN before
    expect(spline([-1.5e308, 0, 1.5e308], [0, 1, 0], { method: "periodic", xout: [0, -7.5e307, 7.5e307] }).y).toEqual([1, 0.5, 0.5]);
  });

  it("four knots whose outer differences overflow", () => {
    for (const method of ["fmm", "natural", "hyman", "monoH.FC"] as const) {
      const s = splinefun([-1.5e308, -5e307, 5e307, 1.5e308], [0, 1, 2, 3], { method });
      expect(s([0, 1e308])).toEqual([1.5, 2.5]);
      expect(s([0, 1e308], 1)).toEqual([1e-308, 1e-308]);
    }
  });

  it("splinefunH keeps the given slopes in their units", () => {
    // NaN at 0 before (R too)
    const h = splinefunH([-1e308, 1e308], [0, 1], [0, 0]);
    expect(h([0, -5e307, 5e307, -1.5e308, 1.5e308])).toEqual([0.5, 0.15625, 0.84375, 0, 1]);
    expect(h([0, -5e307], 1)).toEqual([7.5e-309, 5.625e-309]);
    // slopes beyond 2, which would overflow if multiplied by 2^k: h m overflows, and so does the true value
    const h2 = splinefunH([-1e308, 1e308], [0, 1], [10, -3]);
    expect(h2([0, 1.5e308])).toEqual([Infinity, -1.5e308]);
    expect(h2([0, -5e307, 1.5e308], 1)).toEqual([-1.75, 2.8125, -3]);
    expect(h2([0, -5e307], 2)).toEqual([-6.5e-308, -1.175e-307]);
  });

  it("the ordinary range as before", () => {
    const s = splinefun([1, 2, 3, 4], [1, 4, 9, 16]);
    expect(s([2.5])).toEqual([6.25]);
    expect(s([2.5], 1)).toEqual([5]);
    expect(splinefunH([0, 2], [0, 0], [1, 1])([1], 3)).toEqual([3]);
    expect(splinefun([0, 1, 3], [0, 1, 2], { method: "monoH.FC" })([2, 4])).toEqual(
      splinefunH([0, 1, 3], [0, 1, 2], [1, 0.75, 0.5])([2, 4]),
    );
  });
});
