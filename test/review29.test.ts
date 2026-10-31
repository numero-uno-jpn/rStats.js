// Fixes of the 29th review round (review_fix_log_20261031_29.md): schur of matrices with entries near the largest
// double, scaled by a power of 2 as eigen and svd.
import { describe, expect, it } from "vitest";
import { eigen, schur, svd } from "../src/index.js";

const mul = (a: number[][], b: number[][]): number[][] => a.map((r) => b[0]!.map((_, j) => r.reduce((s, v, k) => s + v * b[k]![j]!, 0)));
const tr = (m: number[][]): number[][] => m[0]!.map((_, j) => m.map((r) => r[j]!));
/** max |Q T Q' - x| / max |x|, computed on x and T divided by max |x| */
function reconstructionError(x: number[][]): number {
  const s = schur(x);
  const scale = Math.max(...x.flat().map(Math.abs));
  const sc = (m: number[][]): number[][] => m.map((r) => r.map((v) => v / scale));
  const r = mul(mul(s.Q, sc(s.T)), tr(s.Q)).flat();
  const xs = sc(x).flat();
  return Math.max(...r.map((v, i) => Math.abs(v - xs[i]!)));
}

describe("review 29", () => {
  it("schur of matrices with entries near 1e308 (R 4.5.2 Matrix::Schur reconstructs them)", () => {
    // T lost its off-diagonal entry (error 1)
    expect(reconstructionError([[1e308, 0], [1e308, 1e308]])).toBeLessThan(1e-15);
    expect(schur([[1e308, 0], [1e308, 1e308]]).T[0]![1]).toBe(-1e308);
    // "the eigendecomposition did not converge"
    expect(reconstructionError([[1e308, 0, 0], [1e308, 1e308, 0], [1e308, 0, 1e308]])).toBeLessThan(1e-15);
    // the 2 x 2 block of a complex pair was [[0, -1e308], [0, 0]]
    const c = schur([[0, -1e308], [1e308, 0]]);
    expect(c.T).toEqual([[0, -1e308], [1e308, 0]]);
    expect(c.valuesIm).toEqual([1e308, -1e308]);
    expect(reconstructionError([[0, -1e308], [1e308, 0]])).toBeLessThan(1e-15);
  });
  it("small entries and the unscaled range are unchanged", () => {
    expect(schur([[1, 0], [1, 1]]).T).toEqual([[1, -1], [0, 1]]);
    expect(schur([[1e-300, 0], [1e-300, 1e-300]]).T).toEqual([[1e-300, -1e-300], [0, 1e-300]]);
  });
  it("eigen and svd at the ends of the range (reported, already right)", () => {
    for (const v of [Number.MIN_VALUE, 2 ** -1022, Number.MAX_VALUE]) {
      expect(eigen([[v]]).values).toEqual([v]);
      expect(svd([[v]]).d).toEqual([v]);
    }
  });
});
