// Issue #458: qrX rejects ncol above max(nrow, ncol of x); ncol 0 stays empty as in R (review_fix_log_issue458.md).
import { describe, expect, it } from "vitest";
import { qr, qrX } from "../src/index.js";

describe("issue #458", () => {
  it("rejects ncol above max(nrow, ncol of x), where R pads zero columns", () => {
    // R: qr.X(qr(matrix(c(1, 2), 2, 1)), ncol = 3) and the 2x2 / 2x3 cases add an all-zero column
    expect(() => qrX(qr([[1], [2]]), { ncol: 3 })).toThrow("ncol must be at most max(nrow, ncol of x) = 2 (got 3)");
    expect(() => qrX(qr([[1, 3], [2, 4]]), { ncol: 3 })).toThrow(RangeError);
    expect(() => qrX(qr([[1, 3, 5], [2, 4, 7]]), { ncol: 4 })).toThrow("= 3 (got 4)");
    expect(() => qrX(qr([[1, 2, 1], [2, 4, 0], [3, 6, 1]]), { ncol: 4 })).toThrow(RangeError);
  });

  it("keeps ncol up to max(nrow, ncol of x) and ncol 0 as R", () => {
    const tall = qr([[1], [2]]);
    // R: qr.X(q1, ncol = 2): [[1, -0.8944272], [2, 0.4472136]]
    const two = qrX(tall, { ncol: 2 });
    expect(two[0]![0]).toBeCloseTo(1, 14);
    expect(two[1]![1]).toBeCloseTo(0.4472135954999579, 14);
    expect(qrX(tall, { ncol: 1 }).map((r) => r.length)).toEqual([1, 1]);
    // R: qr.X(q3, ncol = 3) is the whole wide x
    const wide = qrX(qr([[1, 3, 5], [2, 4, 7]]), { ncol: 3 });
    expect(wide.flat().map((v) => Math.round(v * 1e12) / 1e12)).toEqual([1, 3, 5, 2, 4, 7]);
    // R: ncol = 0 gives a 2 x 0 matrix; so does the default for a 2 x 0 decomposition
    expect(qrX(tall, { ncol: 0 })).toEqual([[], []]);
    expect(qrX(qr([[1, 3], [2, 4]]), { ncol: 0 })).toEqual([[], []]);
  });
});
