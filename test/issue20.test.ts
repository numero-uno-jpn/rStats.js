// Issue #20: determinant of a singular matrix keeps R's sign 1 (no change; review_fix_log_issue20.md).
import { describe, expect, it } from "vitest";
import { det, determinant } from "../src/index.js";

describe("issue #20 (no change: as R)", () => {
  it("gives the modulus of 0 with sign 1 for a singular matrix, as R (whose sign is +1 or -1)", () => {
    // R 4.5.2: determinant(matrix(c(1, 2, 2, 4), 2)) is modulus -Inf, sign 1 (logarithm = FALSE: 0, 1); a zero matrix too
    for (const m of [[[1, 2], [2, 4]], [[0, 0], [0, 0]]]) {
      expect(determinant(m)).toEqual({ modulus: -Infinity, logarithm: true, sign: 1 });
      expect(determinant(m, { logarithm: false })).toEqual({ modulus: 0, logarithm: false, sign: 1 });
      expect(det(m)).toBe(0);
    }
  });
});
