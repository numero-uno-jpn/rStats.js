// External review of glmAnova and glmConfint (MOD-038 to 041, review_fix_log_20261031_66.md).
import { describe, expect, it } from "vitest";
import { glm, glmAnova, glmConfint, lm, qnorm } from "../src/index.js";

const x = [1, 2, 3, 4, 5, 6];
const y = [0, 0, 1, 0, 1, 1];

/** Rao's signed root at a value b of a coefficient (0: intercept, 1: slope), from a restricted fit and lm */
function raoZ(j: 0 | 1, b: number, estimate: number): number {
  const offset = x.map((v) => (j === 0 ? b : b * v));
  const r = glm(j === 0 ? x.map((v) => [v]) : x.map(() => []), y, { family: "binomial", intercept: j === 1, offset, epsilon: 1e-15, maxit: 200 });
  const w = r.weights;
  const res = r.residuals;
  const total = res.reduce((s, v, i) => s + w[i]! * v * v, 0);
  const e = lm(x, res, { weights: w }).residuals;
  const rss = e.reduce((s, v, i) => s + w[i]! * v * v, 0);
  return Math.sign(b - estimate) * Math.sqrt(total - rss);
}

describe("review 66", () => {
  it("profiles whose restricted fits cycle in the last bits: Rao intervals", () => {
    // the restricted fits went round 2 to 5 iterates to maxit, unconverged: the intercept's upper limit was NaN (R:
    // 0.6603 by its spline, the root is 0.6709)
    const fit = glm(x, y, { family: "binomial" });
    const ci = glmConfint(fit, { test: "Rao" });
    const z = qnorm(0.975) as number;
    expect(Math.abs(raoZ(0, ci.lower[0]!, fit.coefficients[0]!) + z)).toBeLessThan(1e-6);
    expect(Math.abs(raoZ(0, ci.upper[0]!, fit.coefficients[0]!) - z)).toBeLessThan(1e-6);
    expect(Math.abs(raoZ(1, ci.lower[1]!, fit.coefficients[1]!) + z)).toBeLessThan(1e-6);
    expect(Math.abs(raoZ(1, ci.upper[1]!, fit.coefficients[1]!) - z)).toBeLessThan(1e-6);
    // R's spline values to its accuracy
    [-10.189856, 0.6602619].forEach((v, k) => expect(Math.abs([ci.lower[0]!, ci.upper[0]!][k]! - v)).toBeLessThan(2e-2));
    // a level whose slope limit was NaN for the same reason
    expect(Number.isFinite(glmConfint(fit, { test: "Rao", level: 0.9 }).lower[1])).toBe(true);
  });

  it("MOD-039: the profile's score statistic is R's (intercept = FALSE), also without an intercept", () => {
    const ci = glmConfint(glm(x, y, { family: "binomial", intercept: false }), { test: "Rao" });
    expect(Math.abs(ci.lower[0]! - -0.2224296)).toBeLessThan(5e-3);
    expect(Math.abs(ci.upper[0]! - 0.5620477)).toBeLessThan(5e-3);
  });

  it("MOD-040: glmAnova warns about a model that has not converged", () => {
    const empty = x.map(() => []);
    const a = glmAnova([glm(empty, y, { family: "binomial" }), glm(x, y, { family: "binomial", maxit: 1 })], { test: "LRT" });
    expect(a.warnings).toContain("model 2 has not converged: its deviance is not that of the maximum likelihood fit");
    expect(glmAnova([glm(empty, y, { family: "binomial" }), glm(x, y, { family: "binomial" })], { test: "LRT" }).warnings).toEqual([]);
  });
});
