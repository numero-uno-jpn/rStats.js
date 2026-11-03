// Issue #221: approx checks its method as R's pmatch (review_fix_log_issue221.md). The rule part of the issue is
// awaiting a decision and is not tested here.
import { describe, expect, it } from "vitest";
import { approx } from "../src/index.js";

describe("issue #221", () => {
  it("rejects a method that is not linear or constant or a unique prefix of one", () => {
    // R 4.5.2: "invalid interpolation method" for "linera", "", "Linear", "linear ", NA and 1, checked before the
    // number of points (approx(1, 1, xout = 0.5, method = "linera") is that error too)
    for (const method of ["linera", "", "Linear", "linear ", null, 1]) {
      expect(() => approx([0, 1], [0, 1], { xout: [0.5], method: method as never })).toThrow(
        "invalid interpolation method",
      );
    }
    expect(() => approx([1], [1], { xout: [0.5], method: "linera" as never })).toThrow("invalid interpolation method");
  });

  it("accepts the full names and unique prefixes, as R", () => {
    // R 4.5.2 at xout = 0.5: "lin" and "l" give 0.5, "c" and "const" give 0 (before the fix all four gave 0)
    for (const [method, y] of [["linear", 0.5], ["lin", 0.5], ["l", 0.5], ["constant", 0], ["const", 0], ["c", 0]] as const) {
      expect(approx([0, 1], [0, 1], { xout: [0.5], method: method as never }).y).toEqual([y]);
    }
    expect(approx([0, 1], [0, 1], { xout: [0.5] }).y).toEqual([0.5]);
    // R: approx(1, 1, xout = 1, method = "c") is 1
    expect(approx([1], [1], { xout: [1], method: "c" as never }).y).toEqual([1]);
  });
});
