// Issue #107: lchoose for small k where a nonzero coefficient is below the doubles (review_fix_log_issue107.md).
import { describe, expect, it } from "vitest";
import { lchoose } from "../src/index.js";

const MIN = Number.MIN_VALUE;
const exact = { rCompatible: false };

describe("issue #107", () => {
  it("gives the finite log of a coefficient below the doubles", () => {
    // MIN (MIN - 1) / 2: 2^-1075 in magnitude, log -1075 ln 2 = -745.13321910194110762...
    expect(Math.abs(lchoose(MIN, 2, exact) / (-1075 * Math.LN2) - 1)).toBeLessThan(4e-16);
    expect(Math.abs(lchoose(-MIN, 2, exact) / (-1075 * Math.LN2) - 1)).toBeLessThan(4e-16);
    // MIN (MIN - 1) (MIN - 2) / 6
    expect(Math.abs(lchoose(MIN, 3, exact) - (Math.log(MIN) + Math.LN2 - Math.log(6)))).toBeLessThan(1e-13);
  });

  it("keeps -Infinity for exact zeros", () => {
    for (const [n, k] of [[3, 5], [0, 2], [2, 3]] as [number, number][]) {
      expect(lchoose(n, k, exact), `${n}, ${k}`).toBe(-Infinity);
      expect(lchoose(n, k), `${n}, ${k}`).toBe(-Infinity);
    }
  });

  it("keeps R's rounding of n to an integer by default", () => {
    // R: lchoose(1e-200, 3) and lchoose(MIN, 2) are -Inf (n is taken as 0)
    expect(lchoose(1e-200, 3)).toBe(-Infinity);
    expect(lchoose(MIN, 2)).toBe(-Infinity);
  });
});
