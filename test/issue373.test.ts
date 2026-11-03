// Issue #373: near the mean the binomial deviance 2 w (bd0(y, mu) + bd0(1 - y, 1 - mu)) formed 2 w first and the
// unweighted terms apart: for mu = 1e-300, y one ulp above and w = 1e308, 2 w overflowed and the underflowed terms gave
// Inf times 0 = NaN (R Inf, from its direct form). Where the deviance or its weighted product leaves the doubles, bd0 is
// now formed with y and mu in units of a power of 2 and the weight's exponent taken out (review_fix_log_issue373.md).
// References: Rmpfr with 4000 bits on the doubles given (1 - y needs more than 1000 bits at y = 1e-300).
import { describe, expect, it } from "vitest";
import { glm } from "../src/index.js";
import { makeFamily } from "../src/models/glmFamily.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #373", () => {
  it("binomial deviance near the mean with a large weight", () => {
    const mu = 1e-300;
    for (const f of ["binomial", "quasibinomial", { family: "quasi", variance: "mu(1-mu)" }] as const) {
      const b = makeFamily(f);
      // before: NaN
      expect(rel(b.devContribution(mu * (1 + 2 ** -52), mu, 1e308), 2.748331382369587e-24)).toBeLessThan(4e-16);
      // subnormal y and mu (before: Infinity)
      expect(rel(b.devContribution(3e-320, 2.9e-320, 1e308), 3.3956566332925499e-15)).toBeLessThan(4e-16);
      // 2 w overflows (before: Infinity)
      expect(rel(b.devContribution(0.3, 0.3003, 1e308), 4.2840832495710015e301)).toBeLessThan(4e-16);
      // the true contribution 4.9e-332 is below the doubles
      expect(b.devContribution(0.5 + 2 ** -53, 0.5, 1e-300)).toBe(0);
    }
  });

  it("glm with a fixed mean", () => {
    const mu = 1e-300;
    const fit = glm([[]], [mu * (1 + 2 ** -52)], { intercept: false, family: "binomial", weights: [1e308], offset: [Math.log(mu)] });
    // the fitted mean is exp(log(1e-300)) = 1.0000000000000237e-300 (exact deviance from it); before: NaN
    expect(Number.isFinite(fit.deviance) && fit.deviance > 0).toBe(true);
    expect(rel(fit.deviance, 5.5417353994099477e-20)).toBeLessThan(4e-16);
  });

  it("keeps the bits in range", () => {
    // values of the implementation before the fix
    const b = makeFamily("binomial");
    expect(b.devContribution(0.31, 0.3, 1)).toBe(0.00047323246635688304);
    expect(b.devContribution(0.3, 0.6, 1)).toBe(0.36757379477362434);
  });
});
