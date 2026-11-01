// Issue #15: optim CG tries the minimum of the parabola, not the midpoint (review_fix_log_issue15.md).
import { describe, expect, it } from "vitest";
import { optim } from "../src/index.js";

describe("issue #15", () => {
  it("the trial point after an accepted step is the minimum of the parabola", () => {
    // f = (x - 3)^2 from 0: the step 1 (x = 6) is rejected, 0.2 (x = 1.2) accepted; the parabola through f(0) = 9
    // with slope -36 and f(1.2) = 3.24 has its minimum at x = 3. R's cgmin tried the midpoint x = 0.6
    const xs: number[] = [];
    const r = optim([0], (x) => (xs.push(x[0]!), (x[0]! - 3) ** 2), { method: "CG", gr: (x) => [2 * (x[0]! - 3)] });
    expect(xs.slice(0, 2)).toEqual([0, 6]);
    expect(xs[2]).toBeCloseTo(1.2, 14);
    expect(xs[3]).toBeCloseTo(3, 14);
    expect(r.par[0]).toBeCloseTo(3, 14);
  });

  it("reaches the minimum of a quadratic in fewer evaluations than R, with every update formula", () => {
    // R: 46 function and 19 gradient evaluations, value 5.6e-14 (the quadratic of the optim fixture)
    const f = (x: number[]) => (x[0]! - 1) ** 2 + 2 * (x[1]! - 2) ** 2 + 3 * (x[2]! - 3) ** 2;
    const gr = (x: number[]) => [2 * (x[0]! - 1), 4 * (x[1]! - 2), 6 * (x[2]! - 3)];
    for (const type of [1, 2, 3]) {
      const r = optim([0, 0, 0], f, { method: "CG", gr, control: { type } });
      expect(r.convergence).toBe(0);
      expect(r.value).toBeLessThan(1e-20);
      expect(r.counts[0]).toBeLessThan(46);
    }
  });
});
