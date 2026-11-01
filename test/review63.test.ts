// External review of glm links, glmPredict and glmSummary (MOD-014 to 022, review_fix_log_20261031_63.md).
import { describe, expect, it } from "vitest";
import { dnorm, glm, glmPredict, glmSummary, pnorm } from "../src/index.js";
import { makeFamily } from "../src/models/glmFamily.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);
const fitted = (family: Parameters<typeof glm>[2] extends infer O ? (O extends { family?: infer F } ? F : never) : never, off: number) =>
  glm([[], []], [0, 0], { family, intercept: false, offset: [off, off] }).fittedValues[0]!;

describe("review 63", () => {
  it("MOD-014, 016, 017, 019: probit, cloglog, cauchit and power links are exact", () => {
    // R clamps to eps: Phi(-10) = 7.6e-24, e^-40, a mean of 1e-16 and a cauchit derivative of 3.2e-19 were 2.2e-16
    expect(rel(fitted({ family: "quasibinomial", link: "probit" }, -10), pnorm(-10) as number)).toBeLessThan(1e-15);
    expect(rel(fitted({ family: "quasibinomial", link: "cloglog" }, -40), -Math.expm1(-Math.exp(-40)))).toBeLessThan(1e-15);
    expect(rel(fitted({ family: "quasi", variance: "constant", link: { power: 0.5 } }, 1e-8), 1e-16)).toBeLessThan(1e-15);
    const cauchit = makeFamily({ family: "binomial", link: "cauchit" });
    expect(rel(cauchit.muEta(-1e9), 1 / (Math.PI * (1 + 1e18)))).toBeLessThan(1e-15);
    const probit = makeFamily({ family: "binomial", link: "probit" });
    expect(probit.muEta(-10)).toBe(dnorm(-10));
    // never 0 or 1, and within R's range as R
    for (const link of ["probit", "cauchit", "cloglog"] as const) {
      const f = makeFamily({ family: "binomial", link });
      expect(f.linkinv(-1e20)).toBeGreaterThan(0);
      expect(f.linkinv(1e20)).toBeLessThan(1);
    }
    expect(probit.linkinv(1.5)).toBe(pnorm(1.5));
  });

  it("MOD-018: the cloglog link of a small mean is finite", () => {
    // log(-log(1 - 1e-20)) was -Infinity: coefficients 0, not converged (R: an error)
    const f = glm([1, 2], [1e-20, 2e-20], { family: { family: "quasi", link: "cloglog", variance: "constant" } });
    expect(f.converged).toBe(true);
    expect(rel(f.coefficients[1]!, Math.log(2))).toBeLessThan(1e-12);
  });

  it("MOD-020: glmPredict's standard errors where the squares overflow", () => {
    // Infinity for newdata 1e155 (R too)
    const g = glm([1, 2, 3, 4, 5, 6], [2, 4, 5, 8, 9, 11], { family: "gaussian" });
    const a = glmPredict(g, { newdata: [1e155] }).seFit[0]!;
    const b = glmPredict(g, { newdata: [1e150] }).seFit[0]!;
    expect(rel(a, b * 1e5)).toBeLessThan(1e-12);
    const h = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
    expect(Number.isFinite(glmPredict(h, { newdata: [1e155] }).seFit[0])).toBe(true);
    // the ordinary range as before
    expect(glmPredict(h, { newdata: [7] }).seFit[0]).toBeCloseTo(3.3878, 4);
  });

  it("MOD-022: a given dispersion gives z values, named so", () => {
    const g = glm([1, 2, 3, 4, 5, 6], [2, 4, 5, 8, 9, 11], { family: "gaussian" });
    expect(glmSummary(g, { dispersion: 1 }).statisticName).toBe("z value");
    expect(glmSummary(g).statisticName).toBe("t value");
  });
});
