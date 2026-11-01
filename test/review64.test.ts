// External review of glm diagnostics, glmAnova and covariances (MOD-023 to 028, review_fix_log_20261031_64.md).
import { describe, expect, it } from "vitest";
import { glm, glmAnova, glmConfint, glmCooksDistance, glmHatvalues, glmResiduals, glmRstandard, glmSummary, lm } from "../src/index.js";

const rel = (a: number, b: number): number => Math.abs(a / b - 1);

describe("review 64", () => {
  it("MOD-023: hat values follow the rows of the QR when a working weight underflows", () => {
    // the first working weight squared underflowed to 0 while its row was in the QR: [0, 0, 0.027]
    const fit = glm([1, 2, 3], [2e-150, 2, 4], { family: "gaussian", link: "inverse", intercept: false, offset: [1e150, 1, 1], start: [-0.25] });
    const h = glmHatvalues(fit);
    const w = fit.weights;
    const sxx = w.reduce((s, v, i) => s + v * (i + 1) ** 2, 0);
    h.forEach((v, i) => expect(Math.abs(v - (w[i]! * (i + 1) ** 2) / sxx)).toBeLessThan(1e-15));
    expect(h[2]).toBeCloseTo(0.972973, 6);
    // rstandard and Cook's distance from those hat values
    const s = glmSummary(fit).dispersion;
    const d = glmResiduals(fit, "deviance");
    const r = glmRstandard(fit);
    for (const i of [1, 2]) expect(rel(r[i]!, d[i]! / Math.sqrt(s * (1 - h[i]!)))).toBeLessThan(1e-12);
    expect(glmCooksDistance(fit)[2]).toBeGreaterThan(1);
  });

  it("MOD-025: Rao's score statistic uses the smaller model's intercept, as R", () => {
    // 1.4953 with the larger model's intercept (R: 1.8513)
    const x = [1, 2, 3, 4, 5, 6];
    const y = [3, 4, 5, 7, 8, 10];
    const t = glmAnova([glm(x, y, { family: "gaussian", intercept: false }), glm(x, y, { family: "gaussian" })], { test: "Rao" }).table;
    expect(t[1]![4]).toBeCloseTo(1.8512820512820514, 12);
    expect(t[1]![5]).toBeCloseTo(0.0001943831, 9);
  });

  it("MOD-026: standard errors scale with the columns of x", () => {
    // a column of 1e-200 made the standard error Infinity, of 1e200 0 (R too)
    const x = [1, 2, 3, 4, 5, 6];
    const yg = [2, 4, 5, 8, 9, 11];
    const yb = [0, 0, 1, 0, 1, 1];
    const g1 = glmSummary(glm(x, yg, { family: "gaussian" }));
    const b1 = glmSummary(glm(x, yb, { family: "binomial" }));
    const l1 = lm(x, yg).coefTable;
    const ci1 = glmConfint(glm(x, yg, { family: "gaussian" }), { parm: [1] });
    for (const c of [1e-200, 1e200]) {
      const xs = x.map((v) => v * c);
      const g = glmSummary(glm(xs, yg, { family: "gaussian" }));
      const b = glmSummary(glm(xs, yb, { family: "binomial" }));
      const l = lm(xs, yg).coefTable;
      expect(rel(g.statistic[1]!, g1.statistic[1]!)).toBeLessThan(1e-13);
      expect(rel(g.pValue[1]!, g1.pValue[1]!)).toBeLessThan(1e-12);
      expect(rel(b.statistic[1]!, b1.statistic[1]!)).toBeLessThan(1e-10);
      expect(rel(l.tValue[1]!, l1.tValue[1]!)).toBeLessThan(1e-13);
      expect(rel(l.stdError[1]!, l1.stdError[1]! / c)).toBeLessThan(1e-13);
      const ci = glmConfint(glm(xs, yg, { family: "gaussian" }), { parm: [1] });
      expect(rel(ci.lower[0]!, ci1.lower[0]! / c)).toBeLessThan(1e-10);
      expect(rel(ci.upper[0]!, ci1.upper[0]! / c)).toBeLessThan(1e-10);
    }
  });

  it("MOD-027: the null deviance with huge weights and with an infinite response of weight 0", () => {
    // the sum of the weights overflowed, and 0 * Infinity: NaN (R too)
    const f = glm([1, 2, 3, 4], [1, 1.1, 0.9, 1.2], { family: "gaussian", weights: [1e308, 1e308, 1e308, 1e308] });
    expect(rel(f.nullDeviance, 5e306)).toBeLessThan(1e-14);
    const g = glm([1, 2, 3, 4], [1, 2, Infinity, 4], { family: "gaussian", weights: [1, 1, 0, 1] });
    expect(g.nullDeviance).toBeCloseTo(14 / 3, 12);
  });

  it("MOD-028: nesting is judged on the rows of positive weight", () => {
    // x1 + x2 = z on the rows of weight 1; a row of weight 0 made the comparison untested
    const x1 = [1, 2, 3, 4, 10];
    const x2 = [2, 1, 4, 3, 20];
    const z = x1.map((v, i) => v + x2[i]!);
    z[4] = 999;
    const y = [2, 3, 5, 6, 100];
    const weights = [1, 1, 1, 1, 0];
    const t = glmAnova(
      [glm(z, y, { family: "gaussian", weights }), glm(x1.map((v, i) => [v, x2[i]!]), y, { family: "gaussian", weights })],
      { test: "LRT", dispersion: 1 },
    ).table;
    expect(t[1]![4]).toBeCloseTo(0.31731050786291404, 12);
  });
});
