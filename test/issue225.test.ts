// Issue #225: tabulate treats infinite values and values beyond the integer range as R's NA
// (review_fix_log_issue225.md).
import { describe, expect, it } from "vitest";
import { tabulate } from "../src/index.js";

describe("issue #225", () => {
  it("ignores infinite values, also for the default nbins", () => {
    // R 4.5.2 (with the warning "NAs introduced by coercion to integer range"): tabulate(c(1, Inf)) 1,
    // tabulate(c(1, -Inf)) 1, tabulate(c(2, Inf, NaN)) 0 1, tabulate(c(1, Inf), 3) 1 0 0, tabulate(Inf) 0
    expect(tabulate([1, Infinity])).toEqual([1]);
    expect(tabulate([1, -Infinity])).toEqual([1]);
    expect(tabulate([2, Infinity, NaN])).toEqual([0, 1]);
    expect(tabulate([1, Infinity], 3)).toEqual([1, 0, 0]);
    expect(tabulate([Infinity])).toEqual([0]);
  });

  // (not run with src stashed: 3e9 made the process run out of memory before the fix)
  it("ignores finite values beyond the integer range, as R's as.integer", () => {
    // R 4.5.2: tabulate(c(1, 3e9)), tabulate(c(1, -3e9)), tabulate(c(1, 2147483648)) are all 1 (with the warning)
    expect(tabulate([1, 3e9])).toEqual([1]);
    expect(tabulate([1, -3e9])).toEqual([1]);
    expect(tabulate([1, 2147483648])).toEqual([1]);
    expect(tabulate([1, 2, 2, 5])).toEqual([1, 2, 0, 0, 1]);
    expect(tabulate([3, 3.5, -2147483647.5])).toEqual([0, 0, 2]);
  });
});
