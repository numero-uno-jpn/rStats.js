// Issue #162: the Poisson deviance contribution 2 (y log(y/mu) - (y - mu)) cancels near y = mu: -9.86e-32 at y = 1,
// mu = 1 + 2^-52 (R 0), 6.8e-11 relative off at y = 1000, mu = 1001 (R the same). Where abs(y - mu) < 0.1 mu it is
// now 2 bd0(y, mu) (review_fix_log_issue161.md). References: Rmpfr with 300 bits.
import { describe, expect, it } from "vitest";
import { makeFamily } from "../src/models/glmFamily.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #162", () => {
  it("poisson deviance near the mean", () => {
    for (const f of ["poisson", "quasipoisson", { family: "quasi", variance: "mu" }] as const) {
      const p = makeFamily(f);
      expect(rel(p.devContribution(1, 1 + 2 ** -52, 1), 4.9303806576313231e-32)).toBeLessThan(4e-16);
      expect(rel(p.devContribution(1000, 1001, 1), 0.00099933383293366638)).toBeLessThan(4e-16);
    }
  });

  it("keeps the bits beyond 10% of the mean", () => {
    // values of the implementation before the fix
    const p = makeFamily("poisson");
    expect(p.devContribution(1, 2, 1)).toBe(0.6137056388801094);
    expect(p.devContribution(2, 1.5, 1)).toBe(0.15072828980712338);
    expect(p.devContribution(0, 0.4, 1)).toBe(0.8);
  });
});
