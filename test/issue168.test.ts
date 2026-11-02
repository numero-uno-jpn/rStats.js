// Issue #168 (with #159, #165, #166, #167): the working weight sqrt(w muEta^2 / V(mu)) was formed from muEta^2 and V
// separately, which overflowed or underflowed although the weight is in range (review_fix_log_issue168.md). Where a
// part is out of range the weight is now sqrt(w) |c| mu^((2a - p)/2) from muEta = c mu^a and V = mu^p (likewise the
// working and Pearson residuals), and the weighted mean of the null model divides the response by a power of 2 where
// the weighted sum overflows. #168: a Poisson fit of y = 1e308 failed in the least squares step (and the null deviance
// was NaN), as R ("NA/NaN/Inf in 'x'").
import { describe, expect, it } from "vitest";
import { glm, glmResiduals } from "../src/index.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #168", () => {
  it("fits a Poisson response of 1e308", () => {
    const fit = glm([[], []], [1e308, 1e308], { family: "poisson" });
    expect(fit.converged).toBe(true);
    // log(1e308) = 709.1962086421661 (Rmpfr)
    expect(Math.abs(fit.coefficients[0]! - 709.1962086421661)).toBeLessThan(1e-12);
    expect(fit.nullDeviance).toBe(0);
    // W = mu
    for (let i = 0; i < 2; i++) expect(rel(fit.weights[i]!, fit.fittedValues[i]!)).toBeLessThan(1e-12);
  });

  it("takes the null model's mean where the weighted sum of the response overflows", () => {
    const fit = glm([[], []], [1.5e308, 1e308], { family: "poisson" });
    expect(fit.converged).toBe(true);
    // the null deviance at the mean 1.25e308 (the sum 2.5e308 overflows): 2 sum (y log(y/m) - (y - m))
    const m = 1.25e308;
    const ref = 2 * (1.5e308 * Math.log(1.5e308 / m) - (1.5e308 - m)) + 2 * (1e308 * Math.log(1e308 / m) - (1e308 - m));
    expect(rel(fit.nullDeviance, ref)).toBeLessThan(1e-12);
    expect(rel(fit.deviance, ref)).toBeLessThan(1e-12);
  });

  it("keeps the bits in range", () => {
    // values of the implementation before the fix
    const fit = glm([1, 2, 3, 4, 5], [2, 3, 6, 7, 8], { family: "poisson" });
    expect(fit.weights).toEqual(BEFORE.weights);
    expect(fit.residuals).toEqual(BEFORE.residuals);
    expect(glmResiduals(fit, "pearson")).toEqual(BEFORE.pearson);
    expect(fit.nullDeviance).toBe(BEFORE.nullDeviance);
  });
});

const BEFORE = {
  weights: [2.472521579007315, 3.409153418525925, 4.700596803572979, 6.4812601831554915, 8.936468137370756],
  residuals: [-0.19110917029244257, -0.12001612533494307, 0.276433673091978, 0.08003687917601214, -0.10479175133511183],
  pearson: [-0.30050490755403864, -0.22159648743899094, 0.5993319680124941, 0.2037604417599471, -0.31326368652630804],
  nullDeviance: 5.648934308093011,
};
