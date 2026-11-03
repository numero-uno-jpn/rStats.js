// Issue #401: the first derivative of splinefunH where the secant overflows (review_fix_log_issue401.md).
import { describe, expect, it } from "vitest";
import { splinefunH } from "../src/index.js";

describe("issue #401", () => {
  it("keeps the finite derivative where the secant overflows", () => {
    // R 4.5.2: Inf, as it was here. The exact derivative of the Hermite cubic of these doubles is 6e300 to the
    // nearest double (checked in rationals)
    expect(splinefunH([0, 1e-200], [0, 1e200], [0, 0])([1e-300], 1)).toEqual([6e300]);
    // also where y1 - y0 itself overflows (the halved ordinates): 6 t (1 - t) (2^1023 + 2^1023) / 2^-100 at
    // t = 2^-200, 6 2^924 in doubles
    const M = 2 ** 1023;
    expect(splinefunH([0, 2 ** -100], [-M, M], [0, 0])([2 ** -300], 1)).toEqual([6 * 2 ** 924]);
  });

  it("keeps values in the ordinary range", () => {
    expect(splinefunH([0, 3], [1, 2], [0.5, 0.25])([1], 1)).toEqual([0.36111111111111116]);
    expect(splinefunH([0, 2], [0, 0], [1, 1])([1], 1)).toEqual([-0.5]);
  });
});
