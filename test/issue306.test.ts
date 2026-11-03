// Issue #306: pAdjust without p-values returns before the adjustment (review_fix_log_issue306.md).
import { describe, expect, it } from "vitest";
import { pAdjust } from "../src/index.js";

describe("issue #306: pAdjust with no non-NaN p-values", () => {
  it("returns the input for any n", () => {
    expect(pAdjust([], { method: "hommel", n: 2 ** 32 })).toEqual([]);
    expect(pAdjust([NaN], { method: "hommel", n: 2 ** 32 })).toEqual([NaN]);
    expect(pAdjust([NaN, NaN], { method: "BY", n: 1e6 })).toEqual([NaN, NaN]);
  });

  it("the checks of n still apply", () => {
    expect(() => pAdjust([], { method: "hommel", n: Infinity })).toThrow(/finite/);
    expect(() => pAdjust([], { method: "hommel", n: -1 })).toThrow(/at least/);
  });
});
