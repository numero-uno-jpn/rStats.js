// Issues #131, #132 and #127: eigen, schur, svd and the condition estimates divided a matrix beyond 2^256 by the power of
// 2 of its largest entry, so every entry below 2 of a matrix near 1e308 became subnormal or 0 before the decomposition:
// svd(diag(1e308, 1e-15)) gave 8.9e-16 and diag(1e308, 1e-80) gave 0, and ginv's reciprocal of the subnormal singular
// value overflowed (NaN and Inf for diag(1e308, 1e-15), #127). The matrix is now brought down only to 2^256
// (decompositionExponent), and ginv inverts a singular value whose reciprocal overflows in the scaled units separately
// (review_fix_log_issue131.md). The issues' own example diag(1e308, 1e-308) keeps 0, as in R: the ratio of its entries is
// beyond what one scale for the whole matrix can hold, and 1e-308 is itself subnormal.
import { describe, expect, it } from "vitest";
import { eigen, ginv, kappa, rcond, schur, solve, svd } from "../src/index.js";

const diag = (a: number, b: number) => [[a, 0], [0, b]];
const rel = (x: number, y: number) => Math.abs(x - y) / Math.abs(y);

describe("issues #131, #132, #127", () => {
  it("keeps small singular values and eigenvalues of a matrix near 1e308", () => {
    for (const small of [1e-15, 1e-10, 1e-5]) {
      const m = diag(1e308, small);
      expect(svd(m).d).toEqual([1e308, small]);
      expect(eigen(m).values).toEqual([1e308, small]);
      expect(schur(m).valuesRe).toEqual([1e308, small]);
    }
    expect(svd(diag(1e300, 1e-10)).d).toEqual([1e300, 1e-10]); // was 1.000000000000009e-10
    // 1e-80 sits in the subnormal range of the matrix divided by 2^767: a few bits are lost (R: 1e-80)
    for (const v of [svd(diag(1e308, 1e-80)).d[1]!, eigen(diag(1e308, 1e-80)).values[1]!, schur(diag(1e308, 1e-80)).valuesRe[1]!]) {
      expect(rel(v, 1e-80)).toBeLessThan(1e-13);
    }
  });

  it("leaves the issues' diag(1e308, 1e-308) at 0, as R", () => {
    const m = diag(1e308, 1e-308);
    expect(svd(m).d).toEqual([1e308, 0]);
    expect(eigen(m).values).toEqual([1e308, 0]);
    expect(schur(m).valuesRe).toEqual([1e308, 0]);
  });

  it("gives ginv of the issue's matrix (#127)", () => {
    const g = ginv(diag(1e308, 1e-15), { tol: 0 });
    expect([g[0]![0], g[0]![1], g[1]![0]]).toEqual([1e-308, 0, 0]);
    expect(rel(g[1]![1]!, 1e15)).toBeLessThan(3e-16);
    expect(ginv(diag(1e308, 1e-5), { tol: 0 })[1]![1]).toBeCloseTo(1e5, 9);
    // 1/d overflows in the scaled units: inverted as 1/(d 2^600) and added in the original units
    const h = ginv(diag(1e308, 1e-80), { tol: 0 });
    expect([h[0]![0], h[0]![1], h[1]![0]]).toEqual([1e-308, 0, 0]);
    expect(rel(h[1]![1]!, 1e80)).toBeLessThan(1e-13);
    // a reciprocal beyond the largest double is Inf, without NaN from 0 x Inf
    expect(ginv(diag(1, 1e-320), { tol: 0 })).toEqual([[1, 0], [0, Infinity]]);
    // the default tolerance drops it, as before
    expect(ginv(diag(1e308, 1e-15))).toEqual([[1e-308, 0], [0, 0]]);
  });

  it("solves from the scaled copy (#128) where its small entries no longer underflow", () => {
    // tol = 0: the copy divided by 2^1023 lost 1e-60 and was singular, so the overflowing LU of the matrix was used
    const m = [[1e308, 1e308, 0], [1e308, -1e308, 0], [0, 0, 1e-60]];
    expect(solve(m, [1, 0, 1], { tol: 0 })).toEqual([5e-309, 5e-309, 1e60]);
  });

  it("gives the eigenvector of a balanced matrix with 1e160 to full precision", () => {
    // [1, 1e160; 1e-160, 2]: the component 1.618e-160 had a relative error of 1.7e-5 (R: 1.618034e-160)
    const v = eigen([[1, 1e160], [1e-160, 2]]).vectors!;
    expect(rel(Math.abs(v[1]![0]!), 1.618033988749895e-160)).toBeLessThan(1e-14);
  });

  it("keeps the bits of matrices whose results were finite and correct", () => {
    // values of the implementation before the fix
    const D = [[1e300, 2e299, -5e298], [3e299, -4e300, 1e299], [7e298, 2e299, 6e299]];
    expect(svd(D).d).toEqual([4.0187012243614375e300, 1.0150440769459044e300, 6.059092268425471e299]);
    expect(eigen(D).values).toEqual([-4.0163599021057364e300, 1.0025294689189767e300, 6.138304331867575e299]);
    expect(eigen([[1e300, 2e299], [2e299, -4e300]]).values).toEqual([1.0079872407968905e300, -4.007987240796891e300]);
    expect(schur(D).valuesRe).toEqual([1.0025294689189767e300, 6.1383043318675726e299, -4.0163599021057364e300]);
    expect(ginv(D)[0]).toEqual([9.791228354102615e-301, 5.259750768732808e-302, 7.282731833630047e-302]);
    expect(kappa(D, { exact: true })).toBe(6.63251366100379);
    expect(kappa(D)).toBe(6.134072306214856);
    expect(rcond(D)).toBe(0.12898444838743345);
  });
});
