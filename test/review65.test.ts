// External review of glm (MOD-029 to 038, review_fix_log_20261031_65.md).
import { describe, expect, it } from "vitest";
import { glm, glmResiduals, type GlmOptions } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("review 65", () => {
  it("MOD-031: the AIC leaves out the rows of weight 0", () => {
    // R's gaussian AIC took log(0) of such a row and counted it: Inf
    const x = [1, 2, 3, 4, 5];
    const cases: [NonNullable<GlmOptions["family"]>, number[], NonNullable<GlmOptions["link"]>?][] = [
      ["gaussian", [2, 4, 5, 8, 7]],
      ["poisson", [1, 3, 2, 6, 4]],
      ["Gamma", [1.2, 2.5, 2.1, 4.8, 3.3], "log"],
      ["inverse.gaussian", [1.2, 2.5, 2.1, 4.8, 3.3], "log"],
    ];
    for (const [family, y, link] of cases) {
      const a = glm(x, y, { family, ...(link === undefined ? {} : { link }), weights: [1, 2, 1, 1, 0] }).aic;
      const b = glm(x.slice(0, 4), y.slice(0, 4), { family, ...(link === undefined ? {} : { link }), weights: [1, 2, 1, 1] }).aic;
      expect(rel(a, b)).toBeLessThan(1e-12);
    }
    expect(glm([1, 2, 3, 4], [2, 4, 5, 8], { family: "gaussian", weights: [1, 1, 1, 0] }).aic).toBeCloseTo(5.8425159255395425, 12);
    // an infinite response of weight 0 is not in it either
    expect(Number.isFinite(glm([1, 2, 3, 4], [1, 2, Infinity, 4], { family: "gaussian", weights: [1, 1, 0, 1] }).aic)).toBe(true);
  });

  it("MOD-037: deviance residuals without residual degrees of freedom", () => {
    // R gives 0, also for this fit that has not converged (deviance 0.337)
    const f = glm([1, 2], [0, 1], { family: "binomial", maxit: 1 });
    expect(f.converged).toBe(false);
    const r = glmResiduals(f, "deviance");
    expect(rel(r[0]! ** 2 + r[1]! ** 2, f.deviance)).toBeLessThan(1e-14);
    expect(r[0]).toBeLessThan(0);
    expect(r[1]).toBeGreaterThan(0);
    expect(rel(r[0]!, -Math.sqrt(-2 * Math.log1p(-f.fittedValues[0]!)))).toBeLessThan(1e-14);
  });

  it("MOD-033: infinite weights are rejected as such", () => {
    expect(() => glm([1, 2, 3], [1, 2, 3], { weights: [1, Infinity, 1] })).toThrow("non-finite weights not allowed");
  });
});
