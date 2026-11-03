// Issue #395: an inner product whose products underflow while the sum is representable. Each 1e-162 * 1e-162 rounds to
// 0, so crossprod(rep(1e-162, 100)) was 0 (R 4.5.2: 0x0p+0 for crossprod, tcrossprod and %*%); the exact value rounds
// to 1e-322. With R's literals, crossprod(rep(1e-160, 3), rep(3e-161, 3)) is 0x1.c74p-1064 (8.997e-321, three
// subnormal roundings) for 9e-321. Where the plain sum is below 2^-969 and a product of nonzero factors fell below
// 2^-1022, the exact inner product of #208 (rescaledDot) is now taken (review_fix_log_issue395.md).
import { describe, expect, it } from "vitest";
import { crossprod, glm, glmPredict, lm, matMul, predict, tcrossprod } from "../src/index.js";

const M = Number.MIN_VALUE;
const x = Array<number>(100).fill(1e-162);
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

describe("issue #395", () => {
  it("gives the exact inner product where the products underflow", () => {
    expect(crossprod(x)).toEqual([[1e-322]]);
    expect(tcrossprod([x])).toEqual([[1e-322]]);
    expect(matMul([x], x.map((t) => [t]))).toEqual([[1e-322]]);
    expect(crossprod(Array(3).fill(1e-160), Array(3).fill(3e-161))).toEqual([[9e-321]]);
  });

  it("does the same in predict for lm and glm", () => {
    // 3 x 0.1 x 1e-321 = 60.6 2^-1074 (plain sum 60)
    const f = lm(I3, [0.1, 0.1, 0.1], { intercept: false });
    expect(predict(f, [[1e-321, 1e-321, 1e-321]]).fit).toEqual([61 * M]);
    // coefficients b with b 2^34 = 0.80333: 3 products b 2^-1040 of 0.8 2^-1074 each (plain sum 3 2^-1074)
    const g = glm(I3, [1, 1, 1], { family: "poisson", intercept: false });
    const t = 2 ** -1040;
    expect(glmPredict(g, { newdata: [[t, t, t]] }).fit).toEqual([2 * M]);
  });

  it("keeps the plain sum elsewhere", () => {
    // cancellation in the normal range: 0 by the plain sum (exactly 1)
    expect(crossprod([1e16, 1, -1e16], [1, 1, 1])).toEqual([[0]]);
    expect(matMul([[1e16, 1, -1e16]], [[1], [1], [1]])).toEqual([[0]]);
    // underflowed products lost in the rounding of a sum above 2^-969
    expect(crossprod([1, 1e-200], [1, 1e-200])).toEqual([[1]]);
    expect(crossprod([1e-140, 1e-200], [1e-140, 1e-200])).toEqual([[1e-140 * 1e-140]]);
  });
});
