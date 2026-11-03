// Issue #363: a cross-classification of 2^31 cells or more is R's tapply error "total number of levels >= 2^31"
// (R 4.5.2 gives it for 65536 x 65536 and 46341 x 46341 levels), before the per-cell arrays are allocated.
import { describe, expect, it } from "vitest";
import { tapply } from "../src/index.js";

const labels = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe("issue #363", () => {
  it("the issue's 65536 x 65536 levels (2^32 cells)", () => {
    const n = 65536;
    expect(() => tapply(new Array(n).fill(1), [labels("a", n), labels("b", n)], (v) => v.length)).toThrow(
      "total number of levels >= 2^31",
    );
  });

  // (before the fix this attempts 2^31 arrays: excluded from the stash check with -t)
  it("alloc: 46341 x 46341 levels, just above 2^31 cells", () => {
    const n = 46341;
    expect(() => tapply(new Array(n).fill(1), [labels("a", n), labels("b", n)], (v) => v.length)).toThrow(
      "total number of levels >= 2^31",
    );
  });

  it("small cross-classifications are unchanged", () => {
    const r = tapply([1, 2, 3, 4], [["a", "a", "b", "b"], ["x", "y", "x", "y"]], (v) => v.length);
    expect(r.dim).toEqual([2, 2]);
    expect(r.values).toEqual([1, 1, 1, 1]);
  });
});
