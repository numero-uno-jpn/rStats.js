// Issue #466: the second derivative of splinefunH formed the secant (y1 - y0) / h before the basis factor 6 - 12 t, so
// with y1 - y0 = 1e200 over h = 1e-200 at t = 1/2 it was Inf * 0 = NaN (R 4.5.2: NaN) for 0. As the first derivative
// (#401), where the secant overflows for finite ordinates the term is (y1 - y0) (6 - 12 t) / h^2 with the exponents
// apart (review_fix_log_issue466.md).
import { describe, expect, it } from "vitest";
import { splinefunH } from "../src/index.js";

describe("issue #466", () => {
  it("keeps a finite second derivative where the secant overflows", () => {
    expect(splinefunH([0, 1e-200], [0, 1e200], [0, 0])([5e-201], 2)).toEqual([0]);
    // y1 - y0 = 3e308 overflows (R: Inf, NaN): 3e308 x 12 2^-10
    expect(splinefunH([0, 1], [-1.5e308, 1.5e308], [0, 0])([0.5 - 2 ** -10, 0.5], 2)).toEqual([1.5e308 * 2 ** -10 * 24, 0]);
  });

  it("keeps the ordinary values", () => {
    expect(splinefunH([0, 3], [1, 2], [0.5, 0.25])([1, 1.5], 2)).toEqual([-0.11111111111111112, -0.08333333333333333]);
  });
});
