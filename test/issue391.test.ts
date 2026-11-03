// Issue #391: the Hommel method of pAdjust has a limit on n (review_fix_log_issue391.md).
import { describe, expect, it } from "vitest";
import { pAdjust } from "../src/index.js";

describe("issue #391", () => {
  it("is a RangeError above n = 65536 (boundary)", () => {
    // n = 65536 takes 5.7 s on the development machine (not run here)
    expect(() => pAdjust([0.01], { method: "hommel", n: 65537 })).toThrow(/at most 65536/);
  });

  it("is a RangeError before the quadratic loop (the issue's n and a long p)", () => {
    expect(() => pAdjust([0.01], { method: "hommel", n: 100_000 })).toThrow(RangeError);
    expect(() => pAdjust(new Array<number>(65537).fill(0.5), "hommel")).toThrow(RangeError);
    // the other methods and the cases that return before the adjustment are not limited
    expect(pAdjust([0.01], { method: "holm", n: 100_000 })).toEqual([1]);
    expect(pAdjust([], { method: "hommel", n: 100_000 })).toEqual([]);
  });

  it("keeps small n", () => {
    expect(pAdjust([0.01], { method: "hommel", n: 3 })).toEqual([0.03]);
  });
});
