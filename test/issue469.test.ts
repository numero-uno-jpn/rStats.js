// Issue #469: ode rk4 where the quarter-weighted slope sum of the #394 fallback overflows although the step's increment
// is finite (review_fix_log_issue469.md).
import { describe, expect, it } from "vitest";
import { ode } from "../src/index.js";

const ulps = (v: number, ref: number): number => Math.abs(v - ref) / (Math.abs(ref) * 2 ** -52);
const end = (y0: number, t1: number, slope: number): number =>
  ode([y0], [0, t1], () => [slope], [], { method: "rk4" })[1]![1]!;

describe("issue #469", () => {
  it("gives the finite state for slopes near the largest double", () => {
    // a constant slope: y0 + t1 slope exactly (was Infinity)
    expect(ulps(end(0, 0.5, 1.7e308), 8.5e307)).toBeLessThanOrEqual(1);
    expect(ulps(end(0, 0.5, Number.MAX_VALUE), Number.MAX_VALUE / 2)).toBeLessThanOrEqual(1);
    expect(ulps(end(0, 1e-300, 1.7e308), 1.7e8)).toBeLessThanOrEqual(1);
    expect(ulps(end(-1e308, 1, 1.7e308), 7e307)).toBeLessThanOrEqual(1);
    // the true increment overflows
    expect(end(0, 2, 1.7e308)).toBe(Infinity);
  });

  it("keeps the earlier values", () => {
    expect(end(0, 0.5, 1e308)).toBe(5e307);
    const out = ode([1], [0, 0.5, 1], (_t, y, p) => [-p[0]! * y[0]!], [0.7], { method: "rk4" });
    expect(out[2]![1]).toBe(0.4966435653972032);
  });
});
