// Fixes of the 31st review round (review_fix_log_20261031_31.md): matMul with an inner dimension of 0; rcond and solve's
// condition check scaled by a power of 2; qrSolve with a LAPACK decomposition of deficient rank; kappa(exact) of a
// singular matrix in a norm other than 2.
import { describe, expect, it } from "vitest";
import { kappa, matMul, qr, qrSolve, rcond, solve } from "../src/index.js";

describe("review 31", () => {
  it("matMul with an inner dimension of 0 gives zeros (it read b[0])", () => {
    expect(matMul([[], []], [])).toEqual([[0], [0]]); // R: matrix(0, 2, 0) %*% numeric(0)
    expect(matMul([], [])).toEqual([[0]]); // R: numeric(0) %*% numeric(0)
    expect(() => matMul([[1, 2]], [1, 2, 3])).toThrow("non-conformable arguments");
  });
  it("rcond does not depend on the scale of the matrix", () => {
    const big = [[1e308, 1e308], [0, 1e308]];
    // R 4.5.2: error -5 from dgecon; 0 for triangular: TRUE
    expect(rcond(big)).toBeCloseTo(0.3, 14);
    expect(rcond(big, { triangular: true })).toBeCloseTo(0.3, 14);
    expect(rcond(big, { norm: "I" })).toBeCloseTo(rcond([[1, 1], [0, 1]], { norm: "I" }), 14);
    // the same matrix scaled by an exact power of 2 has the same value
    const ill = [[1e308, 1e308], [1e308, 9.999999999999998e307]];
    const k = Math.floor(Math.log2(1e308));
    const exact = ill.map((r) => r.map((v) => v * 2 ** -k));
    expect(rcond(ill)).toBe(rcond(exact)); // was 0
    expect(rcond(ill)).toBeGreaterThan(0);
    expect(rcond([[1, 2], [3, 4]])).toBe(0.04761904761904762); // unchanged
    // a wide matrix through its QR
    expect(rcond([[1e308, 0, 1e308], [0, 1e308, 0]])).toBe(rcond([[1, 0, 1], [0, 1, 0]]));
  });
  it("solve checks the condition of a matrix near the largest double", () => {
    // the 1-norm overflowed and the check was skipped; a well-conditioned one is solved
    expect(solve([[1e308, 1e308], [0, 1e308]], [1, 1])).toEqual([0, 1e-308]);
    // reciprocal condition about 5e-17 at any scale: computationally singular
    const ill = (s: number) => [[s, s], [s, s * (1 - 2 ** -52)]];
    expect(() => solve(ill(1), [1, 0])).toThrow("computationally singular");
    // (the 1-norm 2^1024 overflows: the solution was returned without the check)
    expect(() => solve(ill(2 ** 1023), [1, 0])).toThrow("computationally singular");
  });
  it("qrSolve with a LAPACK decomposition of deficient rank is an error", () => {
    // R 4.5.2: qr.solve(qr(m, LAPACK = TRUE), c(3, 6)) is (8, -2.5)
    expect(() => qrSolve(qr([[1, 2], [2, 4]], { lapack: true }), [3, 6])).toThrow("singular matrix in qrSolve");
    const s = qrSolve(qr([[2, 1], [1, 3]], { lapack: true }), [3, 5]) as number[];
    expect(s[0]).toBeCloseTo(0.8, 14);
    expect(s[1]).toBeCloseTo(1.4, 14);
  });
  it("kappa(exact) of a singular matrix is Infinity in every norm", () => {
    // R 4.5.2: "system is exactly singular"
    expect(kappa([[1, 2], [2, 4]], { exact: true, norm: "1" })).toBe(Infinity);
    expect(kappa([[1, 2], [2, 4]], { exact: true, norm: "I" })).toBe(Infinity);
    expect(kappa([[1, 2], [3, 4]], { exact: true, norm: "1" })).toBeCloseTo(21, 12);
  });
});
