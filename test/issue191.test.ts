// Issue #191: rcond where the norm of the inverse overflows (review_fix_log_issue191.md).
import { describe, expect, it } from "vitest";
import { rcond, solve } from "../src/index.js";

describe("issue #191: rcond of a nonsingular matrix whose inverse norm overflows", () => {
  it("gives 1e-310 for diag(1, 1e-310) (was 0, R too)", () => {
    const a = [
      [1, 0],
      [0, 1e-310],
    ];
    expect(rcond(a)).toBe(1e-310);
    expect(rcond(a, { norm: "I" })).toBe(1e-310);
    expect(rcond(a, { triangular: true })).toBe(1e-310);
    expect(rcond(a, { triangular: true, uplo: "L" })).toBe(1e-310);
    // a non-square matrix: R of its QR decomposition
    expect(rcond([...a, [0, 0]])).toBe(1e-310);
  });

  it("gives the exact value where the products in the substitution overflow", () => {
    // [[1, 2], [3e, 4e]]: 1-norm 2 + 4e, inverse norm 1.5 / e; rcond e / 3 (R: 2^-1000 / 3 for e = 2^-1000)
    const e = 2 ** -1030;
    expect(rcond([[1, 2], [3 * e, 4 * e]])).toBe(e / 3);
    expect(rcond([[1, 2], [3 * e, 4 * e]], { norm: "I" })).toBe(e / 3);
    // the triangle [[1, 2], [0, 2^-1060]]: norm 2, inverse norm 3 2^1060
    expect(rcond([[1, 2], [0, 2 ** -1060]], { triangular: true })).toBe(2 ** -1060 / 6);
  });

  it("no longer gives a wrong estimate where the substitution overflowed (was 0.282)", () => {
    // a 3 x 3 matrix with its last row times 2^-1040: rcond is 2^-1040 times about 0.407 (0.4074074074073611 at 2^-40)
    const b = [
      [4, 3, 2],
      [1, 5, 2],
      [2 * 2 ** -1040, 2 ** -1040, 6 * 2 ** -1040],
    ];
    expect(rcond(b) / 2 ** -1040).toBeCloseTo(0.4074074074073611, 9);
    expect(rcond(b, { norm: "I" }) / 2 ** -1040).toBeCloseTo(0.575163398692472, 9);
  });

  it("reports the value in solve's check", () => {
    expect(() => solve([[1, 0], [0, 1e-310]], [1, 1])).toThrow("reciprocal condition number = 1.00000e-310");
    expect(solve([[1, 0], [0, 1e-310]], [1, 1e-20], { tol: 1e-320 })).toEqual([1, 1e-20 / 1e-310]);
  });

  it("leaves matrices whose estimate is in range as before", () => {
    expect(rcond([[1, 2], [3, 4]])).toBe(0.04761904761904762);
    expect(rcond([[1, 2], [3, 4]], { triangular: true })).toBe(0.16666666666666666);
    expect(rcond([[1, 2], [3, 4], [0, 0]])).toBe(0.05208333333333329);
    expect(rcond([[1, 0], [0, 1e-200]])).toBe(1e-200);
    expect(rcond([[1, 1], [1, 1 + 2 ** -52]])).toBe(5.551115123125783e-17);
    // the reciprocal condition number below the doubles stays 0
    expect(rcond([[1e200, 0], [0, 1e-200]])).toBe(0);
  });
});
