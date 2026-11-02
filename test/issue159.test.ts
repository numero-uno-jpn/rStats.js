// Issue #159: a Gamma fit on the inverse link with y = 1e308 failed ("the matrix contains NaN or infinite values"; R:
// "NA/NaN/Inf in 'x'"): muEta = -1/eta^2 overflowed for eta = 1e-308 (from 1e160 on). The working weight and residual
// are now formed from muEta = -mu^2 there (review_fix_log_issue168.md). The working weight itself, W = mu^2 = 1e616,
// is beyond the doubles, so it and the quantities made from it (the dispersion, the standard errors) stay
// non-finite: recorded, not changed.
import { describe, expect, it } from "vitest";
import { glm } from "../src/index.js";

const rel = (x: number, y: number): number => Math.abs(x / y - 1);

describe("issue #159", () => {
  it("fits a Gamma response of 1e308 on the inverse link", () => {
    const fit = glm([[], []], [1e308, 1e308], { family: "Gamma" });
    expect(fit.converged).toBe(true);
    // 1/1e308 is subnormal (2^-1074 = 4.9e-324 apart)
    expect(Math.abs(fit.coefficients[0]! - 1e-308)).toBeLessThanOrEqual(2 * 2 ** -1074);
    for (const m of fit.fittedValues) expect(rel(m, 1e308)).toBeLessThan(1e-15);
    expect(fit.nullDeviance).toBe(0);
    // W = mu^2 overflows
    expect(fit.weights).toEqual([Infinity, Infinity]);
  });

  it("fits where muEta overflows on the way", () => {
    for (const s of [1e160, 1e200]) {
      const fit = glm([[0], [1], [2]], [s, 2 * s, 3 * s], { family: "Gamma" });
      const ref = glm([[0], [1], [2]], [1, 2, 3], { family: "Gamma" });
      expect(fit.converged).toBe(true);
      // the fit of y/s, scaled: coefficients on the inverse link are divided by s
      for (let j = 0; j < 2; j++) expect(rel(fit.coefficients[j]! * s, ref.coefficients[j]!)).toBeLessThan(1e-12);
      expect(rel(fit.deviance, ref.deviance)).toBeLessThan(1e-12);
    }
  });
});
