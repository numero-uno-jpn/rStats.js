// Issue #167: a Poisson fit with the mean 1e-320 (offset log(1e-320)) had the working weight 0: muEta^2 = 1e-640
// underflowed (R clamps the mean to 2.2e-16). The weight W = mu is now sqrt(w) mu^(1/2) squared there
// (review_fix_log_issue168.md).
import { describe, expect, it } from "vitest";
import { glm } from "../src/index.js";

describe("issue #167", () => {
  it("has the working weight mu", () => {
    const fit = glm([[]], [0], { family: "poisson", intercept: false, offset: [Math.log(1e-320)] });
    const mu = fit.fittedValues[0]!;
    expect(mu).toBeGreaterThan(0);
    // subnormal: to a few units of 2^-1074
    expect(Math.abs(fit.weights[0]! - mu)).toBeLessThanOrEqual(4 * 2 ** -1074);
    expect(fit.weights[0]!).toBeGreaterThan(0);
    for (const s of [1e-170, 1e-200, 1e-300]) {
      const f = glm([[]], [0], { family: "poisson", intercept: false, offset: [Math.log(s)] });
      expect(Math.abs(f.weights[0]! / f.fittedValues[0]! - 1)).toBeLessThan(1e-12);
    }
  });
});
