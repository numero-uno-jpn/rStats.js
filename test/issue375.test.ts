// Issue #375: near the mean the poisson deviance 2 w bd0(y, mu) formed 2 w first: for mu = 1e-300, y one ulp above and
// w = 1e308, 2 w overflowed and the underflowed bd0 gave Inf times 0 = NaN (R 1.1e-8, from its cancelling direct form).
// Where the deviance or its weighted product leaves the doubles, bd0 is now formed with y and mu in units of a power of
// 2 and the weight's exponent taken out (review_fix_log_issue375.md). References: Rmpfr with 4000 bits on the doubles.
import { describe, expect, it } from "vitest";
import { glm } from "../src/index.js";
import { makeFamily } from "../src/models/glmFamily.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #375", () => {
  it("poisson deviance near the mean with a large weight", () => {
    const mu = 1e-300;
    for (const f of ["poisson", "quasipoisson", { family: "quasi", variance: "mu" }] as const) {
      const p = makeFamily(f);
      // before: NaN
      expect(rel(p.devContribution(mu * (1 + 2 ** -52), mu, 1e308), 2.748331382369587e-24)).toBeLessThan(4e-16);
      // subnormal y and mu (before: Infinity)
      expect(rel(p.devContribution(3e-320, 2.9e-320, 1e308), 3.3956566332925499e-15)).toBeLessThan(4e-16);
      // 2 w overflows (before: Infinity)
      expect(rel(p.devContribution(5.1, 5, 1e308), 1.9867984210330588e305)).toBeLessThan(4e-16);
    }
  });

  it("glm with a fixed mean", () => {
    const mu = 1e-300;
    const fit = glm([[]], [mu * (1 + 2 ** -52)], { intercept: false, family: "poisson", weights: [1e308], offset: [Math.log(mu)] });
    // the fitted mean is exp(log(1e-300)) = 1.0000000000000237e-300 (exact deviance from it); before: NaN
    expect(rel(fit.deviance, 5.5417353994099477e-20)).toBeLessThan(4e-16);
  });

  it("keeps the bits in range", () => {
    // values of the implementation before the fix
    const p = makeFamily("poisson");
    expect(p.devContribution(5.1, 5, 1)).toBe(0.001986798421033059);
    expect(p.devContribution(1e-300 * 1.01, 1e-300, 1)).toBe(9.9668323399526e-305);
  });
});
