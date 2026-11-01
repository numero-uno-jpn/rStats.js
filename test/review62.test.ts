// External review of glm (MOD-009 to 013, review_fix_log_20261031_62.md).
import { describe, expect, it } from "vitest";
import { glm } from "../src/index.js";
import { makeFamily } from "../src/models/glmFamily.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);
const SEPARATED = "glm.fit: the linear predictor was still changing at convergence: the data may be separated (no finite maximum likelihood estimates)";

describe("review 62", () => {
  it("MOD-012: the logit link is exact beyond |eta| = 30", () => {
    // R clamped |eta| > 30 to the values at eps: 1 - 2.2e-16 at 30.0001 (1 - 9.4e-14 at 30)
    const logit = makeFamily({ family: "binomial" });
    for (const e of [30.0001, 33, 35]) {
      expect(Math.abs(1 - logit.linkinv(e) - Math.exp(-e))).toBeLessThanOrEqual(2 ** -53); // (to the spacing of doubles below 1)
      expect(rel(logit.linkinv(-e), Math.exp(-e) / (1 + Math.exp(-e)))).toBeLessThan(1e-15);
      expect(rel(logit.muEta(e), Math.exp(-e) / (1 + Math.exp(-e)) ** 2)).toBeLessThan(1e-15);
    }
    expect(logit.linkinv(-100)).toBe(Math.exp(-100) / (1 + Math.exp(-100)));
    expect(logit.linkinv(-800)).toBe(Number.MIN_VALUE);
    expect(logit.linkinv(800)).toBe(1 - 2 ** -53);
    // within 30 as before (R's formula)
    for (const e of [-30, -2.5, 0, 1.7, 30]) expect(logit.linkinv(e)).toBe(Math.exp(e) / (1 + Math.exp(e)));
    // the two-column response: the solution has eta = log(1e15) and log(1/2), coefficients 69.771 and -35.232 (R and
    // the clamped link stopped at deviance 2139 and 1.45); 1 - y = 1 / (1e15 + 1) is known to 10% only
    const f = glm([1, 2], [[1e15, 1], [1, 2]], { family: "binomial" });
    expect(rel(f.coefficients[0]!, 2 * Math.log(1e15) - Math.log(0.5))).toBeLessThan(1e-3);
    expect(rel(f.coefficients[1]!, Math.log(0.5) - Math.log(1e15))).toBeLessThan(1e-3);
    expect(f.deviance).toBeLessThan(0.1);
  });

  it("MOD-013: the log link is exact down to the least double", () => {
    // R's pmax(exp(eta), eps) made the means 2.2e-16
    for (const e of [-40, -100, -700]) {
      const fit = glm([[], []], [0, 0], { family: "poisson", intercept: false, offset: [e, e] });
      expect(fit.fittedValues[0]).toBe(Math.exp(e));
    }
    const log = makeFamily({ family: "poisson" });
    expect(log.linkinv(-800)).toBe(Number.MIN_VALUE);
    expect(log.linkinv(-30)).toBe(Math.exp(-30));
  });

  it("MOD-009: separated data are reported", () => {
    // R: converged, coefficients -165 and 47 where it stopped, only "fitted probabilities numerically 0 or 1"
    const f = glm([1, 2, 3, 4, 5, 6], [0, 0, 0, 1, 1, 1], { family: "binomial" });
    expect(f.converged).toBe(true);
    expect(f.warnings).toContain(SEPARATED);
    // the same in other units of x
    expect(glm([1e-6, 2e-6, 3e-6, 4e-6, 5e-6, 6e-6], [0, 0, 0, 1, 1, 1], { family: "binomial" }).warnings).toContain(SEPARATED);
    // overlapping data, and the weights of review 61, are not
    expect(glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" }).warnings).toEqual([]);
    expect(glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial", weights: Array<number>(6).fill(1000) }).warnings).not.toContain(SEPARATED);
    expect(glm([1, 2, 3, 4, 5, 6], [1, 1, 2, 3, 4, 7], { family: "poisson" }).warnings).toEqual([]);
  });
});
