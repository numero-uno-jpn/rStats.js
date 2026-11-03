// Issue #399: the third derivative of splinefunH where h^2 overflows (review_fix_log_issue399.md).
import { describe, expect, it } from "vitest";
import { splinefunH } from "../src/index.js";

describe("issue #399", () => {
  it("divides by h twice where h^2 leaves the range", () => {
    // R 4.5.2: 12 (R divides by h once); was 0 here. The exact (6 m0 + 6 m1 - 12 delta) / h^2 of the doubles is
    // 1.2e-199, the nearest double (checked in rationals)
    expect(splinefunH([0, 1e200], [0, 0], [1e200, 1e200])([5e199], 3)).toEqual([1.2e-199]);
    // h^2 = 2^-1200 underflows (was Infinity): 12 2^-1000 / 2^-1200
    expect(splinefunH([0, 2 ** -600], [0, 0], [2 ** -1000, 2 ** -1000])([2 ** -601], 3)).toEqual([12 * 2 ** 200]);
  });

  it("keeps values in the ordinary range", () => {
    // exact: (6 + 18 - 12 * 0.5) / 4 = 4.5, and 1 / 18 for h = 3 (R: 9 and 1 / 6, dividing by h once)
    expect(splinefunH([0, 2], [0, 1], [1, 3])([1], 3)).toEqual([4.5]);
    expect(splinefunH([0, 3], [1, 2], [0.5, 0.25])([1], 3)).toEqual([0.05555555555555555]);
  });
});
