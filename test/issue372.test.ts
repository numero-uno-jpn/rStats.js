// Issue #372: beyond 10% of the mean the Gamma deviance -2 w (log(y/mu) - (y - mu)/mu) formed y/mu and (y - mu)/mu
// before the weight, so y = 1e308, mu = 1e-308, w = 1e-320 gave Inf - Inf = NaN although the contribution is 2e296 (R
// NaN too). Where the deviance or its weighted product leaves the doubles, it is now 2 w (r - 1 - log r) with r = y/mu
// held as a mantissa and a power of 2 (review_fix_log_issue372.md). References: Rmpfr with 600 bits on the doubles given.
import { describe, expect, it } from "vitest";
import { glm } from "../src/index.js";
import { makeFamily } from "../src/models/glmFamily.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #372", () => {
  it("Gamma deviance with y/mu out of range", () => {
    for (const f of ["Gamma", { family: "quasi", variance: "mu^2" }] as const) {
      const g = makeFamily(f);
      // before: NaN
      expect(rel(g.devContribution(1e308, 1e-308, 1e-320), 1.9999777343653662e296)).toBeLessThan(4e-16);
      expect(rel(g.devContribution(1e300, 1e-10, 1e-300), 20000000000.000001)).toBeLessThan(4e-16);
      // y/mu underflows (before: Infinity)
      expect(rel(g.devContribution(1e-308, 1e300, 1e-300), 2.7979434730807596e-297)).toBeLessThan(4e-16);
      // 2 w overflows (before: Infinity)
      expect(rel(g.devContribution(5, 2, 1e308), 1.1674185362516899e308)).toBeLessThan(4e-16);
    }
  });

  it("glm with a fixed mean", () => {
    const fit = glm([[]], [1e308], {
      intercept: false,
      family: { family: "Gamma", link: "log" },
      weights: [1e-320],
      offset: [Math.log(1e-308)],
    });
    // the fitted mean is exp(log(1e-308)) = 9.999999999999866e-309, not 1e-308; before: NaN
    expect(rel(fit.deviance, 1.9999777343653662e296)).toBeLessThan(1e-13);
    expect(fit.nullDeviance).toBe(fit.deviance);
  });

  it("keeps the bits in range", () => {
    // values of the implementation before the fix
    const g = makeFamily("Gamma");
    expect(g.devContribution(5, 2, 1)).toBe(1.1674185362516898);
    expect(g.devContribution(1e300, 1e-5, 1e-10)).toBe(2e295);
    expect(g.devContribution(2, 5, 3)).toBe(1.89774439124493);
  });
});
