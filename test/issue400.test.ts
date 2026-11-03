// Issue #400: the value of splinefunH where h m overflows before the basis factor (review_fix_log_issue400.md).
import { describe, expect, it } from "vitest";
import { splinefunH } from "../src/index.js";

describe("issue #400", () => {
  it("keeps the term whose h m overflows", () => {
    // R 4.5.2: NaN, as it was here. The exact value of the Hermite cubic of these doubles is 1e300 to the nearest
    // double (checked in rationals); at the first knot the value 0 (was NaN: Inf times the basis 0)
    expect(splinefunH([0, 1e200], [0, 0], [1e200, 1e200])([1e100, 0])).toEqual([1e300, 0]);
  });

  it("keeps values in the ordinary range", () => {
    expect(splinefunH([0, 3], [1, 2], [0.5, 0.25])([1])).toEqual([1.4259259259259258]);
    expect(splinefunH([0, 2], [0, 0], [1, 1])([0.5, 1])).toEqual([0.1875, 0]);
  });
});
