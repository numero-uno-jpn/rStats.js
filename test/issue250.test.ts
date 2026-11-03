// Issue #250: rcond with triangular = TRUE checks uplo as R does (review_fix_log_issue250.md).
import { describe, expect, it } from "vitest";
import { rcond } from "../src/index.js";

const m = [
  [1, 100],
  [0, 1],
];

describe("issue #250", () => {
  it("rejects a uplo other than U or L for a square triangular matrix", () => {
    // R 4.5.2: 'uplo' must be "U" or "L" for "X", "u", "" and "Upper" (before the fix all were taken as "L": 1)
    for (const uplo of ["X", "u", "", "Upper", 1]) {
      expect(() => rcond(m, { triangular: true, uplo: uplo as never })).toThrow(`'uplo' must be "U" or "L"`);
    }
  });

  it("keeps U, L, the default, and ignores uplo where R does", () => {
    // R 4.5.2: U 0x1.9b2a7c9fe8b62p-14, L 1 (also with norm "I")
    const u = parseInt("19b2a7c9fe8b62", 16) * 2 ** -66;
    expect(rcond(m, { triangular: true, uplo: "U" })).toBe(u);
    expect(rcond(m, { triangular: true })).toBe(u);
    expect(rcond(m, { triangular: true, uplo: "L" })).toBe(1);
    expect(rcond(m, { triangular: true, uplo: "L", norm: "I" })).toBe(1);
    // not triangular: uplo is not used (R: the same value as rcond(m))
    expect(rcond(m, { uplo: "X" as never })).toBe(rcond(m));
    // not square: R of the QR decomposition, uplo not used (R: 0.0443860786...)
    const w = [
      [1, 3, 5],
      [2, 4, 6],
    ];
    expect(rcond(w, { triangular: true, uplo: "X" as never })).toBe(rcond(w));
  });
});
