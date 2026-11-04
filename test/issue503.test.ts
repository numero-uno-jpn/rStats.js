// Issue #503: optimHess formed fnscale (g+ - g-) / (2 step ps_i ps_j) directly, so the product in the denominator
// (2 · 1 · 1e200 · 1e200) or the difference of the scaled gradients (1e308 - (-1e308)) overflowed where the Hessian is
// representable, giving 0 or Inf. R 4.5.2's optimHess gives [[0]] and [[Inf]] as well. Only there is the quotient now
// formed from factors scaled by powers of 2.
import { describe, expect, it } from "vitest";
import { optimHess } from "../src/index.js";

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("issue #503", () => {
  it("the denominator overflows", () => {
    const h = optimHess([0], (x) => 0.5e-200 * x[0]! * x[0]!, (x) => [1e-200 * x[0]!], { parscale: 1e200, ndeps: 1e200 });
    expect(rel(h[0]![0]!, 1e-200)).toBeLessThan(1e-15);
  });

  it("the difference of the gradients overflows", () => {
    const h = optimHess([0], (x) => 0.5e8 * x[0]! * x[0]!, (x) => [1e8 * x[0]!], { parscale: 1e200, ndeps: 1e100 });
    expect(rel(h[0]![0]!, 1e8)).toBeLessThan(1e-15);
  });

  it("an off-diagonal term whose denominator overflows", () => {
    const h = optimHess(
      [0, 0],
      (x) => 1e-200 * x[0]! * x[1]!,
      (x) => [1e-200 * x[1]!, 1e-200 * x[0]!],
      { parscale: [1e200, 1e200], ndeps: [1e200, 1e200] },
    );
    expect(rel(h[0]![1]!, 1e-200)).toBeLessThan(1e-15);
    expect(rel(h[1]![0]!, 1e-200)).toBeLessThan(1e-15);
    expect(h[0]![0]).toBe(0);
  });
});
