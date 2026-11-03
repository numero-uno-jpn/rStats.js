// Issue #467: barylag where the second form's denominator cancels to 0 (review_fix_log_issue467.md).
import { describe, expect, it } from "vitest";
import { barylag } from "../src/index.js";

const xi = [0, 2 ** -250, 2 ** -249, 2 ** -600];

describe("issue #467", () => {
  it("the identity at the nodes 0, 2^-250, 2^-249, 2^-600 is reproduced", () => {
    // the interpolant of y = x is x; the exact rational values (BigInt) are these doubles. pracma gives NaN
    expect(barylag(xi, xi, [2 ** -300])).toEqual([2 ** -300]);
    expect(barylag(xi, xi, [2 ** -400])).toEqual([2 ** -400]);
    expect(barylag(xi, xi, [2 ** -260])).toEqual([2 ** -260]);
  });

  it("values where the denominator does not cancel are unchanged", () => {
    expect(barylag(xi, xi, [2 ** -650])).toEqual([2.1404388173910186e-196]);
    // issue #402
    expect(barylag(xi, [1, 0, 0, 0], [2 ** -1074])).toEqual([1]);
    expect(barylag([0, 1, 2], [1, 3, 7], [0.5, 1.5])).toEqual([1.7500000000000002, 4.75]);
  });

  it("constant data keep the second form, which reproduces them", () => {
    // y = 1 + x is 1 in double; the numerator cancels as the denominator does, the first form would not give 1
    expect(barylag(xi, xi.map((v) => 1 + v), [2 ** -650, 2 ** -610])).toEqual([1, 1]);
  });
});
