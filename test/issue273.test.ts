// Issue #273: svd's nu and nv checked before they are reduced to the dimensions (review_fix_log_issue273.md).
import { describe, expect, it } from "vitest";
import { svd } from "../src/index.js";

// R 4.5.2: m3 <- matrix(c(1, 2, 3, 4, 5, 7), 3, 2); m2 <- diag(2)
const m3 = [[1, 4], [2, 5], [3, 7]];
const m2 = [[1, 0], [0, 1]];
const shape = (m?: number[][]) => (m ? [m.length, m[0]!.length] : undefined);

describe("issue #273", () => {
  it("truncates a non-negative fraction, then reduces it to the dimension (as R)", () => {
    expect(shape(svd(m3, { nu: 1.5 }).u)).toEqual([3, 1]);
    expect(shape(svd(m3, { nv: 1.5 }).v)).toEqual([2, 1]);
    expect(shape(svd(m3, { nu: 2.5 }).u)).toEqual([3, 2]);
    expect(shape(svd(m2, { nu: 2.5 }).u)).toEqual([2, 2]);
    expect(svd(m3, { nu: 0.5 }).u).toBeUndefined();
    expect(svd(m3, { nv: 1e-9 }).v).toBeUndefined();
    expect(shape(svd(m3, { nu: Infinity }).u)).toEqual([3, 3]);
    expect(shape(svd(m3, { nv: Infinity }).v)).toEqual([2, 2]);
    expect(shape(svd(m3, { nu: 2147483648 }).u)).toEqual([3, 3]);
  });

  it("rejects negative values and NaN whatever the shape", () => {
    for (const m of [m3, m2]) {
      for (const v of [-0.5, -1, -Infinity, NaN]) {
        expect(() => svd(m, { nu: v })).toThrow("nu must be a non-negative number");
        expect(() => svd(m, { nv: v })).toThrow("nv must be a non-negative number");
      }
    }
  });

  it("leaves the decomposition unchanged", () => {
    const a = svd(m3, { nu: 1.5, nv: 2.5 });
    const b = svd(m3, { nu: 1, nv: 2 });
    expect(a).toEqual(b);
  });
});
