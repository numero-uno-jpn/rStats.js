// Issue #504: hessian formed the second difference f(x + h) - 2 f(x) + f(x - h) before dividing by the step, so with
// eps 1e200 the sum of two finite values near 1e308 overflowed and the curvature 2e-92 came out Infinity (the case
// #214's fallback did not reach). Only there is every term now divided by the step first, on and off the diagonal.
import { describe, expect, it } from "vitest";
import { hessian } from "../src/index.js";

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("issue #504", () => {
  it("a diagonal numerator that overflows", () => {
    const h = hessian((x) => 1e-92 * x[0]! * x[0]!, [0], { eps: 1e200, r: 1 });
    expect(rel(h[0]![0]!, 2e-92)).toBeLessThan(1e-15);
  });

  it("an off-diagonal numerator that overflows", () => {
    const h = hessian((x) => 1e-92 * x[0]! * x[1]! + 0.5e-92 * x[0]! * x[0]!, [0, 0], { eps: 1e200, r: 1 });
    expect(rel(h[0]![0]!, 1e-92)).toBeLessThan(1e-15);
    expect(rel(h[0]![1]!, 1e-92)).toBeLessThan(1e-15);
    expect(rel(h[1]![0]!, 1e-92)).toBeLessThan(1e-15);
    expect(h[1]![1]).toBe(0);
  });
});
