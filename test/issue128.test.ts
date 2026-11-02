// Issue #128: solve factored the finite matrix itself, and the elimination could overflow although the condition check
// (on a copy divided by a power of 2) passed: solve(1e308 * [[1, 1], [1, -1]], [1, 0]) was [1e-308, 0] for
// [5e-309, 5e-309] (-1e308 - 1e308 overflowed in U). Where U, or the solution of a finite right-hand side, is not finite,
// the system is now solved from the LU of the scaled copy (review_fix_log_issue128.md). References: A = a H with
// H^-1 = H / 2, and the solution of the same system divided by 2^1000 (the same x, without overflow).
import { describe, expect, it } from "vitest";
import { solve } from "../src/index.js";

const a = 1e308;

describe("issue #128", () => {
  it("solves a well-conditioned matrix near the largest double", () => {
    expect(solve([[a, a], [a, -a]], [1, 0])).toEqual([5e-309, 5e-309]);
    expect(solve([[a, a], [a, -a]])).toEqual([
      [5e-309, 5e-309],
      [5e-309, -5e-309],
    ]);
    // a right-hand side near the largest double as well: S^-1 b overflows before the scaling back
    expect(solve([[a, a], [a, -a]], [1.7e308, 1.7e308])).toEqual([1.7, 0]);
    expect(solve([[a, a], [a, -a]], [[1, 1.7e308], [0, 1.7e308]])).toEqual([
      [5e-309, 1.7],
      [5e-309, 0],
    ]);
  });

  it("matches the system divided by 2^1000", () => {
    const A = [[a, a, a], [a, -a, 0.5 * a], [0, a, a]];
    const b = [1, 2, 3];
    const x = solve(A, b);
    expect(x).toEqual(solve(A.map((r) => r.map((v) => v / 2 ** 1000)), b.map((v) => v / 2 ** 1000)));
    expect(x).toEqual([-2e-308, -1.6666666666666667e-308, 4.666666666666667e-308]);
  });

  it("solves again where the substitution overflows for a matrix in range", () => {
    expect(solve([[1, 1], [1, -1]], [1.7e308, -1.7e308])).toEqual([0, 1.7e308]);
  });

  it("keeps the bits where the elimination and the substitution stay finite", () => {
    // values of the implementation before the fix
    expect(solve([[2, 1], [1, 3]], [3, 5])).toEqual([0.8, 1.4]);
    expect(solve([[a, a], [0, a]], [1, 1])).toEqual([0, 1e-308]);
    expect(solve([[3e300, 1e300], [2e300, 5e300]], [1, 2])).toEqual([2.3076923076923076e-301, 3.076923076923077e-301]);
    expect(solve([[a, 0.5 * a, 0], [a, -a, a], [0.3 * a, a, a]], [1, 2, 3])).toEqual([
      6.382978723404254e-309, 7.23404255319149e-309, 2.0851063829787234e-308,
    ]);
  });
});
