// Issue #380: interpolation paths whose ordinate difference overflows (review_fix_log_issue380.md).
import { describe, expect, it } from "vitest";
import { hermiteInterp, spline, splinefun, splinefunH } from "../src/index.js";

const M = 2 ** 1023;

describe("issue #380", () => {
  it("keeps the finite secant where y1 - y0 overflows", () => {
    // R 4.5.2: spline(c(0, 2), c(-2^1023, 2^1023), xout = 1)$y and splinefun(...)(1) are Inf; was Infinity here
    expect(spline([0, 2], [-M, M], { xout: [1] }).y).toEqual([0]);
    expect(spline([0, 2], [-1e308, 1e308], { xout: [1] }).y).toEqual([0]);
    expect(splinefun([0, 2], [-M, M])([1, 0.5])).toEqual([0, -M / 2]);
    expect(splinefun([0, 2], [-M, M])([1], 1)).toEqual([M]);
    expect(splinefun([0, 2], [-M, M], { method: "natural" })([1])).toEqual([0]);
    // R: splinefunH(c(0, 2), c(-2^1023, 2^1023), c(0, 0))(1, 1) is Inf; the derivative 1.5 secant
    expect(splinefunH([0, 2], [-M, M], [0, 0])([1], 1)).toEqual([1.5 * M]);
    expect(splinefunH([0, 2], [-1e308, 1e308], [0, 0])([1], 1)).toEqual([1.5e308]);
    expect(splinefunH([0, 2], [-M, M], [0, 0])([1])).toEqual([0]);
    // the line through the end points (slopes equal to the secant): exactly 0 at the midpoint (was NaN)
    expect(hermiteInterp([0, 2], [-1e308, 1e308], [1e308, 1e308], [1])).toEqual([0]);
  });

  it("keeps values where the difference is in range", () => {
    expect(spline([0, 2], [1, 5], { xout: [0.5] }).y).toEqual([2]);
    expect(splinefunH([0, 2], [0, 0], [1, 1])([1], 1)).toEqual([-0.5]);
    expect(splinefun([0, 1, 2], [-M, 0, M])([0.5])).toEqual([-M / 2]);
    expect(hermiteInterp([0, 1], [0, 1], [0, 0], [0.25, 0.5])).toEqual([0.15625, 0.5]);
  });
});
