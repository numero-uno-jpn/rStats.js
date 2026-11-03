// Issue #465: a product whose exact value is just below 2^-1022 rounds up to 2^-1022, so the check of #395 (on the
// rounded products) let the plain sum stand: crossprod(rep(2^-511, 100), rep(2^-511 (1 - 2^-53), 100)) was
// 0x1.9p-1016 (R 4.5.2 too) for the exact 100 (2^-1022 - 2^-1075) rounded once, 0x1.8ffffffffffffp-1016. A product
// rounded to 2^-1022 is now compared exactly; one just above 2^-1022 keeps the plain sum (review_fix_log_issue465.md).
import { describe, expect, it } from "vitest";
import { crossprod, matMul, tcrossprod } from "../src/index.js";

const a = Array<number>(100).fill(2 ** -511);
const b = Array<number>(100).fill(2 ** -511 * (1 - 2 ** -53));
const exact = 0x18ffffffffffff * 2 ** -1068; // 0x1.8ffffffffffffp-1016
const plain = 100 * 2 ** -1022; // 0x1.9p-1016

describe("issue #465", () => {
  it("takes the exact inner product where a product rounds up to 2^-1022", () => {
    expect(crossprod(a, b)).toEqual([[exact]]);
    expect(tcrossprod([a], [b])).toEqual([[exact]]);
    expect(matMul([a], b.map((t) => [t]))).toEqual([[exact]]);
  });

  it("keeps the plain sum where the products are 2^-1022 or just above it", () => {
    // exact products 2^-1022 + 2^-1075 - 2^-1127, normal, rounded down to 2^-1022 (outside #395, recorded)
    const c = Array<number>(100).fill(2 ** -511 + 2 ** -563);
    const d = Array<number>(100).fill(2 ** -511 - 2 ** -564);
    expect(crossprod(c, d)).toEqual([[plain]]);
    expect(crossprod(a, a)).toEqual([[plain]]);
  });
});
