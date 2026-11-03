// Issue #206: crossprod and tcrossprod where products of finite entries overflow (review_fix_log_issue206.md).
import { describe, expect, it } from "vitest";
import { crossprod, matMul, t, tcrossprod } from "../src/index.js";

const x = [
  [1e200, 1e200],
  [1e200, -1e200],
];

describe("issue #206: crossprod and tcrossprod with overflowing products", () => {
  it("gives the exact 0 off the diagonal (was NaN, R too)", () => {
    // 1e400 - 1e400 = 0; the sums of squares 2e400 are beyond the doubles
    expect(crossprod(x)).toEqual([
      [Infinity, 0],
      [0, Infinity],
    ]);
    expect(tcrossprod(x)).toEqual([
      [Infinity, 0],
      [0, Infinity],
    ]);
    expect(crossprod(x, x)).toEqual(crossprod(x));
    expect(tcrossprod(x, x)).toEqual(tcrossprod(x));
    expect(crossprod([1e200, 1e200], [1e200, -1e200])).toEqual([[0]]);
  });

  it("agrees with matMul(t(x), x) and matMul(x, t(x))", () => {
    expect(crossprod(x)).toEqual(matMul(t(x), x));
    expect(tcrossprod(x)).toEqual(matMul(x, t(x)));
  });

  it("keeps NaN and infinite entries as before", () => {
    const c = crossprod([
      [1e200, 1e200],
      [1e200, -1e200],
      [1, NaN],
    ]);
    expect(c[0]![0]).toBe(Infinity);
    expect(c[0]![1]).toBeNaN();
    expect(crossprod([[1e200, Infinity], [1e200, -1e200]])[0]![1]).toBeNaN();
  });

  it("leaves finite sums as before", () => {
    expect(crossprod([[1, 2], [3, 4]])).toEqual([[10, 14], [14, 20]]);
    expect(tcrossprod([[1, 2], [3, 4]])).toEqual([[5, 11], [11, 25]]);
    expect(crossprod([[1e200, 1, 2], [1e200, 3, 4]])).toEqual([
      [Infinity, 4e200, 6e200],
      [4e200, 10, 14],
      [6e200, 14, 20],
    ]);
  });
});
