// Issue #208: the fallback of matMul, crossprod and tcrossprod where large products cancel (review_fix_log_issue208.md).
import { describe, expect, it } from "vitest";
import { crossprod, matMul, tcrossprod } from "../src/index.js";
import { rescaledDot } from "../src/linalg/dot.js";

describe("issue #208: the exact inner product where the plain sum is not finite", () => {
  it("keeps the remainder after the large products cancel (was 0; R NaN)", () => {
    // 1e308 * 1e308 - 1e308 * 1e308 + 1e-308 * 1e308; the double product 1e-308 * 1e308 is
    // 0x1.fffffffffffffp-1 (Rmpfr: 0.99999999999999992030...)
    expect(matMul([[1e308, 1e308, 1e-308]], [[1e308], [-1e308], [1e308]])).toEqual([[0.9999999999999999]]);
    expect(crossprod([1e308, 1e308, 1e-308], [1e308, -1e308, 1e308])).toEqual([[0.9999999999999999]]);
    expect(tcrossprod([[1e308, 1e308, 1e-308]], [[1e308, -1e308, 1e308]])).toEqual([[0.9999999999999999]]);
  });

  it("rounds the exact sum once", () => {
    // 2^-1075 is half way between 0 and the smallest subnormal: ties to even
    expect(rescaledDot([1e308, 1e308, 5e-324], [1e308, -1e308, 0.5], NaN)).toBe(0);
    expect(rescaledDot([1e308, 1e308, 5e-324], [1e308, -1e308, 1.5], NaN)).toBe(1e-323);
    expect(rescaledDot([1e308, 1e308, 3e-308], [1e308, -1e308, 1e-10], NaN)).toBe(3e-308 * 1e-10);
    expect(rescaledDot([1e308, 1e308, Number.MAX_VALUE], [1e308, -1e308, 1], NaN)).toBe(Number.MAX_VALUE);
    // 3e308 - 2.9e308 (review 49, LINALG-004): the exact sum of the two double products, rounded once
    expect(matMul([[3e200, 1e200]], [[1e108], [-2.9e108]])).toEqual([[1.0000000000000002e307]]);
  });

  it("keeps overflow, infinite factors and finite sums as before", () => {
    expect(matMul([[1e200, 1e200]], [[1e200], [1e200]])).toEqual([[Infinity]]);
    expect(rescaledDot([-1e308, -1e308], [10, 10], NaN)).toBe(-Infinity);
    expect(matMul([[1e308, Infinity]], [[1e308], [-1]])[0]![0]).toBeNaN();
    expect(matMul([[1e308, 1e308]], [[1e308], [-1e308]])).toEqual([[0]]);
    expect(matMul([[1, 2], [3, 4]], [[5], [6]])).toEqual([[17], [39]]);
    expect(matMul([[0.1, 0.2, 0.3]], [[0.3], [0.2], [0.1]])).toEqual([[0.1 * 0.3 + 0.2 * 0.2 + 0.3 * 0.1]]);
  });
});
