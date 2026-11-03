// Issue #176: the Pearson dispersion of a glm where the weighted sum of squared residuals overflows
// (review_fix_log_issue176.md).
import { describe, expect, it } from "vitest";
import { glm, glmSummary } from "../src/index.js";
import { glmDispersion } from "../src/models/glm.js";

const y = Array<number>(99).fill(1e-6).concat([5000]);
const X = Array.from({ length: 100 }, () => [] as number[]);
const start = [Math.log(50.00000099)];
const gammaFit = (weights?: number[]) =>
  glm(X, y, { family: "Gamma", link: "log", start, ...(weights === undefined ? {} : { weights }) });

describe("issue #176", () => {
  it("gives the finite dispersion where the sum overflows", () => {
    // R 4.5.2: summary(glm(...))$dispersion is Inf; sum(r^2) / 99 * 2e304 in R is 2e306 (was Infinity here)
    const fit = gammaFit(Array<number>(100).fill(2e304));
    const d = glmDispersion(fit);
    expect(Math.abs(d / 1.99999992e306 - 1)).toBeLessThan(1e-13);
    expect(glmSummary(fit).dispersion).toBe(d);
    expect(Number.isFinite(glmSummary(fit).stdError[0]!)).toBe(true);
  });

  it("is the dispersion of the unit weights times the power of 2 of the weights", () => {
    // weights 2^1012 (the sum overflows) give the same coefficients as weights 1 (sqrt(2^1012) = 2^506 is exact)
    const a = gammaFit(Array<number>(100).fill(2 ** 1012));
    const b = gammaFit();
    expect(a.coefficients[0]).toBe(b.coefficients[0]);
    expect(glmDispersion(a)).toBe(glmDispersion(b) * 2 ** 1012);
  });

  it("keeps the dispersion where the sum is finite", () => {
    // values before the fix
    expect(glmDispersion(gammaFit())).toBe(99.99999599999872);
    expect(glmDispersion(gammaFit(Array<number>(100).fill(2e300)))).toBe(1.9999999200000117e302);
  });
});
