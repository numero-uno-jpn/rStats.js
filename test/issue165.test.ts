// Issue #165: inverse.gaussian on the log link with mu = 1e200: muEta^2 = 1e400 and V = mu^3 = 1e600 overflowed and
// the working weight 1/mu = 1e-200 was Inf/Inf = NaN (R too); with a predictor the fit failed. The weight is now
// sqrt(w) mu^(-1/2) there (review_fix_log_issue168.md); the deviance's ratio form is #164.
import { describe, expect, it } from "vitest";
import { glm, glmResiduals } from "../src/index.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #165", () => {
  it("has the working weight 1/mu", () => {
    const fit = glm([[]], [1e200], { family: "inverse.gaussian", link: "log", intercept: false, offset: [Math.log(1e200)] });
    const mu = fit.fittedValues[0]!;
    expect(rel(fit.weights[0]! * mu, 1)).toBeLessThan(1e-15);
    // (y - mu)^2/(y mu^2) and (y - mu)/mu^1.5
    const t = (1e200 - mu) / mu;
    expect(rel(fit.deviance, (t * t) / 1e200)).toBeLessThan(1e-15);
    expect(rel(fit.nullDeviance, fit.deviance)).toBeLessThan(1e-15);
    expect(rel(glmResiduals(fit, "pearson")[0]!, t / Math.sqrt(mu))).toBeLessThan(1e-15);
  });

  it("fits with a predictor", () => {
    const fit = glm([[0], [1]], [1e200, 2e200], { family: "inverse.gaussian", link: "log" });
    expect(fit.converged).toBe(true);
    // log(1e200) = 460.51701859880916, log 2
    expect(Math.abs(fit.coefficients[0]! - 460.51701859880916)).toBeLessThan(1e-12);
    expect(Math.abs(fit.coefficients[1]! - Math.LN2)).toBeLessThan(1e-12);
  });
});
