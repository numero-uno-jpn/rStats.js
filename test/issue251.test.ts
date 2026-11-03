// Issue #251: rcond with triangular: true on a non-square matrix. As R, a non-square matrix goes to the triangular
// factor of its QR decomposition before the triangular option is looked at, so no column is ignored.
import { describe, expect, it } from "vitest";
import { rcond } from "../src/index.js";

describe("issue #251", () => {
  it("the 2x3 example gives the QR-based estimate whatever triangular and uplo say", () => {
    const A = [[1, 0, 100], [0, 1, 0]];
    const plain = rcond(A);
    // R 4.5.2: rcond(A), rcond(A, triangular = TRUE, uplo = "U") and uplo = "L" are all 0x1.47a9e2d196518p-7 (0.0099995);
    // the value here is the one before this judging
    expect(plain).toBe(0.009999500037496877);
    expect(Math.abs(plain / 0.009999500037496875 - 1)).toBeLessThan(1e-15);
    expect(rcond(A, { triangular: true, uplo: "U" })).toBe(plain);
    expect(rcond(A, { triangular: true, uplo: "L" })).toBe(plain);
    // tall: the transpose, as R
    expect(rcond([[1, 0], [0, 1], [100, 0]], { triangular: true })).toBe(plain);
  });

  it("the third column matters: without it the estimate is 1", () => {
    expect(rcond([[1, 0], [0, 1]], { triangular: true })).toBe(1);
  });
});
