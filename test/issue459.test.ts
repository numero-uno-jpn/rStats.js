// Issue #459: lmer checks the number of random effects per term, as lme4's check.nobs.vs.nRE
// (review_fix_log_issue459.md).
import { describe, expect, it } from "vitest";
import { lmer } from "../src/entries/mixed.js";

describe("issue #459", () => {
  it("fits two intercept terms whose levels add up to n (lme4 2.0.6 fits it, singular)", () => {
    const fit = lmer("y ~ 1 + (1 | g1) + (1 | g2)", {
      y: [1, 2, 3, 4, 5, 6],
      g1: ["a", "a", "b", "b", "c", "c"],
      g2: ["u", "v", "w", "u", "v", "w"],
    });
    expect(fit.fixef[0]).toBeCloseTo(3.5, 12); // lme4: 3.5
    expect(fit.sigma).toBeCloseTo(0.7071068, 6); // lme4: 0.7071068
  });
});
