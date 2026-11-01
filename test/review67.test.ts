// External review of glm diagnostics and intervals (MOD-041 to 044, review_fix_log_20261031_67.md).
import { describe, expect, it } from "vitest";
import { glm, glmConfint, glmRstandard } from "../src/index.js";

describe("review 67", () => {
  it("MOD-043: glmRstandard keeps small residuals of a model without columns, as R", () => {
    // they were set to 0 (R's lm.influence does that only with rank > 0): R gives 1.414e-15 and 1.414
    const r = glmRstandard(glm([[], []], [1e-15, 1], { family: "gaussian", intercept: false }));
    expect(Math.abs(r[0]! / (Math.SQRT2 * 1e-15) - 1)).toBeLessThan(1e-12);
    expect(r[1]).toBeCloseTo(Math.SQRT2, 14);
  });

  it("MOD-042: Poisson profile intervals (restricted fits that cycled, fixed in review 66)", () => {
    const fit = glm([1, 2, 3, 4, 5, 6], [1, 2, 3, 5, 7, 9], { family: "poisson" });
    const lrt = glmConfint(fit);
    const rao = glmConfint(fit, { test: "Rao" });
    // R (spline interpolation)
    [-1.4421449, 0.1541859].forEach((v, k) => expect(Math.abs(lrt.lower[k]! - v)).toBeLessThan(1e-3));
    [1.0006906, 0.6638795].forEach((v, k) => expect(Math.abs(lrt.upper[k]! - v)).toBeLessThan(1e-3));
    [-1.29715, 0.1473418].forEach((v, k) => expect(Math.abs(rao.lower[k]! - v)).toBeLessThan(1e-3));
    [1.0956621, 0.6446838].forEach((v, k) => expect(Math.abs(rao.upper[k]! - v)).toBeLessThan(1e-3));
  });
});
