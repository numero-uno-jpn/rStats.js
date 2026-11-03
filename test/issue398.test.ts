// Issue #398: the hyman limiter where the product of two small secants underflows (review_fix_log_issue398.md).
import { describe, expect, it } from "vitest";
import { splinefun } from "../src/index.js";

const close = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-15 * Math.abs(b);

describe("issue #398", () => {
  it("keeps the sign of the secants where their product underflows", () => {
    // R 4.5.2: the derivative at 5 is -0x1.56ebfd2a518b4p-662 (-7e-200), as it was here; increasing data
    const f = splinefun([0, 1, 5], [0, 2e-199, 4e-199], { method: "hyman" });
    expect(f([5], 1)).toEqual([0]);
    // the same spline as for y = (0, 2, 4), scaled by 1e-199
    const g = splinefun([0, 1, 5], [0, 2, 4], { method: "hyman" });
    const u = [0.5, 3, 4, 4.9];
    const fu = f(u);
    g(u).forEach((v, i) => expect(close(fu[i]!, v * 1e-199)).toBe(true));
    for (let i = 1; i < fu.length; i++) expect(fu[i]!).toBeGreaterThan(fu[i - 1]!);
  });

  it("keeps values in the ordinary range", () => {
    expect(splinefun([0, 1, 5], [0, 2, 4], { method: "hyman" })([3, 4, 5])).toEqual([3.75, 3.96875, 4]);
  });
});
