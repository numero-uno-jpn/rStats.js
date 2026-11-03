// Issue #413: r2dtable truncates the margins before checking them, as R 4.5.2's r2dtable (r <- as.integer(r), then
// any(r < 0) and sum(r) != sum(c)). Margins in (-1, 0) are 0 and fractional margins whose truncated sums agree are
// accepted in R as well (review_fix_log_issue413.md).
import { describe, expect, it } from "vitest";
import { r2dtable, setSeed } from "../src/index.js";

describe("issue #413: fractional margins of r2dtable, as R", () => {
  it("accepts the margins R accepts, with R's table", () => {
    // R: set.seed(1); r2dtable(1, c(-0.5, 1.5), c(0, 1)) and the three other calls: matrix(c(0, 0, 0, 1), 2)
    for (const [r, c] of <[number[], number[]][]>[
      [[-0.5, 1.5], [0, 1]],
      [[0.5, 1], [0, 1]],
      [[0, 1], [-0.5, 1.5]],
      [[0, 1], [0.5, 1]],
    ]) {
      setSeed(1);
      expect(r2dtable(1, r, c)).toEqual([[[0, 0], [0, 1]]]);
    }
  });

  it("rejects what R rejects after truncation", () => {
    expect(() => r2dtable(1, [0, 1], [-1, 2])).toThrow("invalid argument 'c'");
    expect(() => r2dtable(1, [0.5, 1], [0, 2])).toThrow("arguments 'r' and 'c' must have the same sums");
  });
});
