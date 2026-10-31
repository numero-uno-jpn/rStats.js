// External review of linalg and numerics (review_fix_log_20261031_49.md).
import { describe, expect, it } from "vitest";
import { backsolve, determinant, forwardsolve, grad, hessian, matMul, optimize, prcomp, solve } from "../src/index.js";

describe("review 49", () => {
  const D = [[1e-308, 0], [0, 1e-308]];

  it("LINALG-001: an overflowed component does not spoil the others through a coefficient of 0", () => {
    // 0 * Infinity = NaN went into x1 (NaN, Infinity before; R's backsolve too)
    expect(solve(D, [1, 2])).toEqual([1e308, Infinity]);
    expect(backsolve(D, [1, 2])).toEqual([1e308, Infinity]);
    expect(forwardsolve(D, [1, 2])).toEqual([1e308, Infinity]);
    expect(backsolve(D, [1, 2], { transpose: true })).toEqual([1e308, Infinity]);
    expect(forwardsolve(D, [1, 2], { transpose: true })).toEqual([1e308, Infinity]);
    // x1 depends on x3 only: (1 - 3) / 1e-308 overflows to -Infinity, not NaN
    expect(backsolve([[1e-308, 0, 1], [0, 1e-308, 0], [0, 0, 1]], [1, 2, 3])).toEqual([-Infinity, Infinity, 3]);
    // the ordinary range as before
    expect(backsolve([[2, 1], [0, 4]], [3, 8])).toEqual([0.5, 2]);
  });

  it("LINALG-002: prcomp's sdev when the singular value overflows", () => {
    // sdev = 1e308 sqrt(4/3); Infinity before (R too)
    const s = prcomp([[1e308], [-1e308], [1e308], [-1e308]]).sdev[0]!;
    expect(Math.abs(s / (1e308 * Math.sqrt(4 / 3)) - 1)).toBeLessThan(4e-16);
    const v = [[1, 0.5], [-1, 0.25], [1, -0.5], [-1, -0.25]];
    const base = prcomp(v).sdev;
    expect(prcomp(v.map((r) => r.map((x) => x * 2 ** 1023))).sdev).toEqual(base.map((d) => d * 2 ** 1023));
  });

  it("LINALG-003: determinant without the logarithm through overflowing and underflowing products", () => {
    const big = determinant([[1e308, 0, 0, 0], [0, 1e308, 0, 0], [0, 0, 1e-308, 0], [0, 0, 0, 1e-308]], { logarithm: false });
    expect(Math.abs(big.modulus - 1)).toBeLessThan(4e-16); // Infinity before (R too); the exact value is 1 + 5e-17
    const small = determinant([[1e-308, 0, 0], [0, 1e-308, 0], [0, 0, 1e308]], { logarithm: false });
    expect(Math.abs(small.modulus / 1e-308 - 1)).toBeLessThan(4e-16); // 0 before
    expect(determinant([[1e300, 0], [0, 1e300]], { logarithm: false }).modulus).toBe(Infinity);
    expect(determinant([[1, 2], [3, 4]], { logarithm: false })).toEqual({ modulus: 2, logarithm: false, sign: -1 });
  });

  it("LINALG-004: matMul when products overflow but the sum does not", () => {
    expect(matMul([[1e308, 1e308]], [[1e308], [-1e308]])).toEqual([[0]]); // NaN before (R too)
    // 3e308 - 2.9e308: both products overflow, the sum is 1e307
    expect(matMul([[3e200, 1e200]], [[1e108], [-2.9e108]])[0]![0]! / 1e307 - 1).toBeCloseTo(0, 13);
    expect(matMul([[1e200, 1e200]], [[1e200], [1e200]])).toEqual([[Infinity]]); // the sum itself overflows
    expect(matMul([[1, 2], [3, 4]], [[5], [6]])).toEqual([[17], [39]]);
  });

  it("NUM-001: optimize where lower + upper overflows", () => {
    // the midpoint 0.5 (a + b) was Infinity and the search did not end (R too)
    const t0 = performance.now();
    const r = optimize((x) => (x / 1e308 - 1.05) ** 2, 1e308, 1.1e308, { tol: 1e-8 });
    expect(performance.now() - t0).toBeLessThan(500);
    expect(Math.abs(r.optimum / 1.05e308 - 1)).toBeLessThan(1e-7);
  });

  it("NUM-002: steps of numerical derivatives", () => {
    const f = (x: number[]) => x[0]! ** 2;
    expect(() => grad(f, [1], { d: 0 })).toThrow(/'d' must be/);
    expect(() => grad(f, [1], { method: "simple", eps: 0 })).toThrow(/'eps' must be/); // NaN before (numDeriv too)
    expect(() => grad(f, [1], { eps: Infinity })).toThrow(/'eps' must be/);
    expect(() => hessian(f, [1], { zeroTol: NaN })).toThrow(/'zeroTol' must be/);
    // a negative step is a difference the other way, as in numDeriv
    expect(hessian(f, [1], { d: -0.1 })).toEqual([[2.000000000000556]]);
  });
});
