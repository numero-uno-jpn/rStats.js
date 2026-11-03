// Issue #214: hessian where the squared step overflows (review_fix_log_issue214.md).
import { describe, expect, it } from "vitest";
import { hessian } from "../src/index.js";

const q = (v: number) => (v / 1e100) * (v / 1e100);
const near = (v: number, exact: number) => expect(Math.abs(v / exact - 1)).toBeLessThan(1e-14);

describe("issue #214: hessian with steps beyond sqrt(MAX_VALUE)", () => {
  it("keeps the diagonal curvature 2e-200 (was 0 for r = 1; 2.0007e-200 for r = 4, numDeriv too)", () => {
    for (const r of [1, 4]) near(hessian((x) => q(x[0]!), [1e100], { d: 2e54, r })[0]![0]!, 2e-200);
  });

  it("keeps the off-diagonal terms (was NaN, numDeriv too)", () => {
    for (const r of [1, 4]) {
      const H = hessian((x) => q(x[0]!) + (x[0]! / 1e100) * (x[1]! / 1e100), [1e100, 1e100], { d: 2e54, r });
      near(H[0]![0]!, 2e-200);
      near(H[0]![1]!, 1e-200);
      near(H[1]![0]!, 1e-200);
      expect(H[1]![1]).toBe(0);
    }
  });

  it("leaves steps whose square is finite as before", () => {
    // values of the implementation before the fix
    expect(hessian((x) => q(x[0]!), [1e100], { d: 2e53 })).toEqual([[1.9999999999999997e-200]]);
    expect(hessian((x) => x[0]! ** 2 * x[1]! ** 2, [1, 2])).toEqual([[8.000000000002224, 7.999999999999699], [7.999999999999699, 2.000000000000556]]);
  });
});
