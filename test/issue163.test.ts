// Issue #163: the Gamma deviance contribution -2 (log(y/mu) - (y - mu)/mu) cancels near y = mu: 1.97e-31 at y = 1,
// mu = 1 + 2^-52, four times the true value (R twice), and 6.8e-11 relative off at y = 1000, mu = 1001 (R the same).
// Where abs(y - mu) < 0.1 mu it is now -2 log1pmx((y - mu)/mu), also for quasi with variance "mu^2"
// (review_fix_log_issue161.md). References: Rmpfr with 300 bits.
import { describe, expect, it } from "vitest";
import { makeFamily } from "../src/models/glmFamily.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #163", () => {
  it("Gamma deviance near the mean", () => {
    for (const f of ["Gamma", { family: "quasi", variance: "mu^2" }] as const) {
      const g = makeFamily(f);
      expect(rel(g.devContribution(1, 1 + 2 ** -52, 1), 4.9303806576313223e-32)).toBeLessThan(4e-16);
      expect(rel(g.devContribution(1000, 1001, 1), 9.9866816506833162e-7)).toBeLessThan(4e-16);
    }
  });

  it("keeps the bits beyond 10% of the mean", () => {
    // values of the implementation before the fix
    const g = makeFamily("Gamma");
    expect(g.devContribution(1, 2, 1)).toBe(0.3862943611198906);
    expect(g.devContribution(2, 1.5, 1)).toBe(0.09130252176310494);
    expect(makeFamily({ family: "quasi", variance: "mu^2" }).devContribution(1, 0.9, 1)).toBe(0.011501190906569453);
  });
});
