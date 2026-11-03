// Issue #402: barylag where a product of node differences underflows (review_fix_log_issue402.md).
import { describe, expect, it } from "vitest";
import { barylag } from "../src/index.js";

describe("issue #402", () => {
  it("keeps the products and the terms whose plain values leave the range", () => {
    // pracma 2.4.4 (R 4.5.2): NaN, as it was here. The Lagrange basis of node 0 at 2^-1074 is
    // (1 - 2^-824)(1 - 2^-825)(1 - 2^-474), which is 1 in doubles
    expect(barylag([0, 2 ** -250, 2 ** -249, 2 ** -600], [1, 0, 0, 0], [Number.MIN_VALUE])).toEqual([1]);
  });

  it("keeps values in the ordinary range", () => {
    expect(barylag([0, 1, 2], [1, 3, 7], [0.5, 1.5])).toEqual([1.7500000000000002, 4.75]);
    expect(barylag([0, 2 ** -660, 3 * 2 ** -660], [1, 2, 5], [2 * 2 ** -660])).toEqual(barylag([0, 1, 3], [1, 2, 5], [2]));
  });
});
