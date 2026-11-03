// Issue #221: approx checks its method as R's pmatch, and its rule is 1 or 2 (review_fix_log_issue221.md)
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

  it("rejects a rule other than 1 or 2", () => {
    // R 4.5.2 takes 3, 0, 1.5, -1 and Inf as rule 2 (y 0 1 at xout -1 2) and c(1, 3) as c(1, 2) (NA 1); NA, a length
    // of 3 and numeric(0) are R's errors
    for (const rule of [3, 0, 1.5, -1, Infinity, NaN, [1, 3], [1, 2, 2], [], null, "2"]) {
      expect(() => approx([0, 1], [0, 1], { xout: [-1, 2], rule: rule as never })).toThrow(
        "'rule' must be 1 or 2, or a pair of them",
      );
    }
    // checked before the number of points, as R
    expect(() => approx([1], [1], { xout: [0.5], rule: 3 })).toThrow("'rule' must be 1 or 2, or a pair of them");
  });

  it("keeps the rules 1 and 2, once or as a pair, as R", () => {
    // R 4.5.2 at xout = c(-1, 2): 1 NA NA, 2 0 1, c(1, 2) NA 1, c(2, 1) 0 NA, c(1) NA NA, c(2, 2) 0 1
    const cases: [unknown, number[]][] = [
      [undefined, [NaN, NaN]], [1, [NaN, NaN]], [2, [0, 1]], [[1, 2], [NaN, 1]], [[2, 1], [0, NaN]], [[1], [NaN, NaN]], [[2, 2], [0, 1]],
    ];
    for (const [rule, y] of cases) {
      expect(approx([0, 1], [0, 1], rule === undefined ? { xout: [-1, 2] } : { xout: [-1, 2], rule: rule as never }).y).toEqual(y);
    }
  });
});
