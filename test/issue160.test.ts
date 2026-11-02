// Issue #160: a two-column binomial response whose finite counts have a total beyond the doubles (1e308 + 1e308) gave
// the proportion 0, the prior weight Infinity and the starting mean NaN, and the fit stopped with "cannot find valid
// starting values: please specify some" (R 4.5.2 too). The size itself, which the deviance, the AIC and the
// covariance are proportional to, is not a double, so this is now an error that names the cause
// (review_fix_log_issue160.md).
import { describe, expect, it } from "vitest";
import { glm } from "../src/index.js";

describe("issue #160", () => {
  it("names the overflowing total", () => {
    expect(() => glm([0, 1], [[1e308, 1e308], [1e308, 1e308]], { family: "binomial" })).toThrow(
      /total of successes and failures overflows in row 1/,
    );
    expect(() => glm([0, 1], [[1, 2], [1.5e308, 5e307]], { family: "quasibinomial" })).toThrow(/overflows in row 2/);
  });

  it("fits totals in range", () => {
    // the proportions 1/2 and 1/3: logits 0 and -log 2 (the last bits depend on the deviance's rounding, #161)
    const fit = glm([0, 1], [[1e300, 1e300], [1e300, 2e300]], { family: "binomial" });
    expect(Math.abs(fit.coefficients[0]!)).toBeLessThan(1e-15);
    expect(Math.abs(fit.coefficients[1]! + Math.LN2)).toBeLessThan(1e-15);
  });
});
