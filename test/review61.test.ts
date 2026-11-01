// External review of lm and glm (MOD-005 to 008, review_fix_log_20261031_61.md).
import { describe, expect, it } from "vitest";
import { glm, lm } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("review 61", () => {
  it("MOD-006: lm's standard errors do not depend on a common factor of the weights", () => {
    // (R'R)^-1 overflowed below 1e-308: standard errors Infinity, t 0 and p 1 (R too; NaN at 5e-324)
    const x = [1, 2, 3, 4];
    const y = [2, 4, 5, 8];
    const a = lm(x, y).coefTable;
    for (const c of [5e-324, 1e-320, 1e-309, 1e-300, 1e200, 1e300]) {
      const b = lm(x, y, { weights: [c, c, c, c] }).coefTable;
      for (let k = 0; k < 2; k++) expect(rel(b.stdError[k]!, a.stdError[k]!)).toBeLessThan(1e-14);
      expect(rel(b.tValue[1]!, a.tValue[1]!)).toBeLessThan(1e-14);
      expect(rel(b.pValue[1]!, a.pValue[1]!)).toBeLessThan(1e-13);
    }
    // a factor of 4 (exact in the square roots) leaves the values bit for bit
    expect(lm(x, y, { weights: [1, 2, 3, 4] }).coefTable).toEqual(lm(x, y, { weights: [4, 8, 12, 16] }).coefTable);
  });

  it("MOD-007: glm halves a step that increases the deviance", () => {
    // weights 1000: R's glm.fit went from deviance 7564 to 89255 and stopped at 144175 with coefficients of 1e15,
    // "converged" (the maximum is 4956)
    const x = [1, 2, 3, 4, 5, 6];
    const y = [0, 0, 1, 0, 1, 1];
    const one = glm(x, y, { family: "binomial" });
    expect(one.coefficients[0]).toBeCloseTo(-4.2490965504771205, 12);
    for (const w of [10, 100, 1000, 1e4, 1e6]) {
      const f = glm(x, y, { family: "binomial", weights: Array<number>(6).fill(w) });
      expect(f.converged).toBe(true);
      f.coefficients.forEach((b, k) => expect(rel(b, one.coefficients[k]!)).toBeLessThan(1e-8));
      expect(rel(f.deviance, w * one.deviance)).toBeLessThan(1e-12);
    }
    const counts = [1, 1, 2, 3, 4, 7];
    const p1 = glm(x, counts, { family: "poisson" });
    for (const w of [1000, 1e6]) {
      const f = glm(x, counts, { family: "poisson", weights: Array<number>(6).fill(w) });
      f.coefficients.forEach((b, k) => expect(rel(b, p1.coefficients[k]!)).toBeLessThan(1e-8));
    }
  });
});
