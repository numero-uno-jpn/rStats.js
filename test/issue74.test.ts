// Issue #74: optimize with tol = 0 or a tol whose third underflows (review_fix_log_issue74.md).
// (Before the fix these calls did not return; not run on the old code.)
import { describe, expect, it } from "vitest";
import { optimize } from "../src/index.js";

const CASES: [string, (x: number) => number, number, number, number][] = [
  ["x²", (x) => x * x, -1, 1, 0],
  ["(x - 1)²", (x) => (x - 1) * (x - 1), 0, 3, 1],
  ["|x|", (x) => Math.abs(x), -1, 2, 0],
  ["x² on [0, 1]", (x) => x * x, 0, 1, 0],
];

describe("issue #74", () => {
  it("rejects tol = 0, as R", () => {
    expect(() => optimize((x) => x * x, -1, 1, { tol: 0 })).toThrow(RangeError);
  });

  it("returns for a tol whose third underflows (R does not return for tol = 5e-324)", () => {
    for (const tol of [5e-324, 1e-323]) {
      for (const [name, f, lo, hi, at] of CASES) {
        const r = optimize(f, lo, hi, { tol });
        expect(Math.abs(r.optimum - at), `${name} ${tol}`).toBeLessThanOrEqual(at === 0 ? 1.5e-323 : 1e-15);
      }
      const m = optimize((x) => -x * x, -1, 1, { tol, maximum: true });
      expect(Math.abs(m.optimum)).toBeLessThanOrEqual(1.5e-323);
    }
  });

  it("keeps the ordinary results", () => {
    expect(optimize((x) => (x - 1 / 3) ** 2, 0, 1).optimum).toBeCloseTo(1 / 3, 4);
  });
});
