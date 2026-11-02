// Issue #166: inverse.gaussian on the log link with y = 1e-200: V = mu^3 underflowed to 0 and the fit stopped with
// "0s in V(mu)" (R reported convergence at the clamped mean 2.2e-16, deviance 2e200). V = mu^p underflowing for a
// positive mean is no longer an error, and the working weight is sqrt(w) mu^(-1/2) there
// (review_fix_log_issue168.md).
import { describe, expect, it } from "vitest";
import { glm } from "../src/index.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #166", () => {
  it("fits a response of 1e-200", () => {
    const fit = glm([[0], [1]], [1e-200, 1e-200], { family: "inverse.gaussian", link: "log" });
    expect(fit.converged).toBe(true);
    // exp of eta = -460.5 is good to an ulp of eta (5.7e-14) relative
    for (const m of fit.fittedValues) expect(rel(m, 1e-200)).toBeLessThan(1e-13);
    // W = 1/mu
    for (let i = 0; i < 2; i++) expect(rel(fit.weights[i]! * fit.fittedValues[i]!, 1)).toBeLessThan(1e-15);
  });
});
