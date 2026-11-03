// Issue #371: beyond 10% of the mean the poisson deviance 2 w (y log(y/mu) - (y - mu)) formed y/mu and y log(y/mu)
// before the weight, so y = 1e308, mu = 1e-308, w = 1e-320 gave Infinity although the contribution is 2.8e-9 (R
// Infinity too). Where the unweighted deviance or the product leaves the doubles (or the deviance is below the normal
// range), it is now formed with y and mu in units of a power of 2 and the weight's exponent taken out
// (review_fix_log_issue371.md). References: Rmpfr with 600 bits on the doubles given.
import { describe, expect, it } from "vitest";
import { glm } from "../src/index.js";
import { makeFamily } from "../src/models/glmFamily.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #371", () => {
  it("poisson deviance with y/mu or y log(y/mu) out of range", () => {
    for (const f of ["poisson", "quasipoisson", { family: "quasi", variance: "mu" }] as const) {
      const p = makeFamily(f);
      // before: Infinity
      expect(rel(p.devContribution(1e308, 1e-308, 1e-320), 2.8347532754269681e-9)).toBeLessThan(4e-16);
      expect(rel(p.devContribution(1e308, 1e-10, 1e-10), 1.4624441191442131e301)).toBeLessThan(4e-16);
      // subnormal y and mu with a large weight (before: Infinity)
      expect(rel(p.devContribution(3e-320, 1e-320, 1e308), 2.5916448793784545e-12)).toBeLessThan(1e-15);
      // before: -Infinity
      expect(rel(p.devContribution(1e-308, 1e308, 1e-300), 200000000.00000001)).toBeLessThan(4e-16);
      // the contribution itself overflows
      expect(p.devContribution(5, 2, 1e308)).toBe(Infinity);
    }
  });

  it("glm with a fixed mean", () => {
    const fit = glm([[]], [1e308], { intercept: false, family: "poisson", weights: [1e-320], offset: [Math.log(1e-308)] });
    // the fitted mean is exp(log(1e-308)) = 9.999999999999866e-309, not 1e-308; before: Infinity
    expect(rel(fit.deviance, 2.8347532754269681e-9)).toBeLessThan(1e-13);
    expect(fit.nullDeviance).toBe(fit.deviance);
  });

  it("keeps the bits in range", () => {
    // values of the implementation before the fix
    const p = makeFamily("poisson");
    expect(p.devContribution(5, 2, 1)).toBe(3.162907318741551);
    expect(p.devContribution(1e300, 1e-5, 1e-10)).toBe(1.4025769067263684e293);
    expect(p.devContribution(2, 5, 3)).toBe(7.0045112175101405);
    expect(p.devContribution(1e-300, 2e-300, 1)).toBe(6.137056388801094e-301);
  });
});
