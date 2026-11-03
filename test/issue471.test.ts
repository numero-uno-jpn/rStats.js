// Issue #471: pAdjust with "hommel" and n = 2 is Hochberg's method in R (review_fix_log_issue471.md).
import { describe, expect, it } from "vitest";
import { pAdjust } from "../src/index.js";

describe("issue #471", () => {
  it("uses Hochberg's method for n = 2 as R", () => {
    // R 4.5.2 p.adjust(..., "hommel")
    expect(pAdjust([-2, 0.3], { method: "hommel" })).toEqual([-4, 0.3]);
    expect(pAdjust([1.5, 0.3], { method: "hommel" })).toEqual([1, 0.6]);
    expect(pAdjust([Infinity, 0.3], { method: "hommel" })).toEqual([1, 0.6]);
    expect(pAdjust([0.3], { method: "hommel", n: 2 })).toEqual([0.6]);
    expect(pAdjust([0.04, NaN, 0.03], { method: "hommel" })).toEqual([0.04, NaN, 0.04]);
  });

  it("keeps the Hommel loop for n = 3", () => {
    expect(pAdjust([0.01, 0.02, -1], { method: "hommel" })).toEqual([0.02, 0.02, -1]);
  });
});
