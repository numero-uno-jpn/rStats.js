// Models on the shared moments at any scale of the response, and the fixes of the re-audit rstats_src2_reaudit_report.md
// (2026-10-31, F-01-F-07). New functions on fits of lm or glm belong in this table.
import { describe, expect, it } from "vitest";
import {
  Anova,
  anova,
  aovEz,
  cv,
  glm,
  glmAnova,
  glmConfint,
  glmCooksDistance,
  glmPredict,
  glmResiduals,
  glmRstandard,
  glmSummary,
  lm,
  meanAD,
  predict,
} from "../src/index.js";
import { expectScaleInvariant } from "./helpers/scaleInvariance.js";

const x = [1, 2, 3, 4, 5, 6, 7, 8];
const y = [1, 2, 2, 3, 5, 4, 6, 6.5];
const g = ["a", "b", "a", "b", "a", "b", "a", "b"];
const times = (v: readonly number[], c: number): number[] => v.map((t) => t * c);

describe("scale invariance of model functions", () => {
  it("Anova type II and III", () => {
    for (const type of [2, 3] as const) {
      expectScaleInvariant(`Anova ${type}`, (c) => Anova(lm("y ~ x + g", { y: times(y, c), x, g }, { contrasts: { g: "contr.sum" } }), { type }), {
        unitless: (r) => r.table.slice(0, -1).flatMap((row) => [row[2]!, row[3]!]),
        squared: (r) => r.table.map((row) => row[0]!),
      });
    }
  });
  it("predict", () => {
    for (const interval of ["confidence", "prediction"] as const) {
      expectScaleInvariant(`predict ${interval}`, (c) => predict(lm("y ~ x", { y: times(y, c), x }), [2, 4, 6], { interval }), {
        units: (r) => [...r.fit, ...r.seFit, ...r.lwr!, ...r.upr!],
      });
    }
  });
  it("glm (gaussian) and the functions on its fit", () => {
    const fit = (c: number) => glm(x, times(y, c), { family: "gaussian" });
    expectScaleInvariant("glm", fit, {
      units: (r) => [...r.coefficients, ...r.fittedValues, ...r.residuals],
      squared: (r) => [r.deviance, r.nullDeviance],
    });
    expectScaleInvariant("glm aic", (c) => fit(c).aic - 2 * x.length * Math.log(Math.abs(c)), { unitless: (r) => [r] });
    expectScaleInvariant("glmSummary", (c) => glmSummary(fit(c)), {
      unitless: (r) => [...r.statistic, ...r.pValue],
      units: (r) => [...r.estimate, ...r.stdError],
      squared: (r) => [r.dispersion],
    });
    for (const type of ["deviance", "pearson", "working", "response"] as const) {
      expectScaleInvariant(`glmResiduals ${type}`, (c) => glmResiduals(fit(c), type), { units: (r) => r });
    }
    expectScaleInvariant("glmRstandard", (c) => glmRstandard(fit(c)), { unitless: (r) => r });
    expectScaleInvariant("glmCooksDistance", (c) => glmCooksDistance(fit(c)), { unitless: (r) => r });
    expectScaleInvariant("glmPredict", (c) => glmPredict(fit(c), { newdata: [9, 10], type: "response" }), { units: (r) => [...r.fit, ...r.seFit] });
    expectScaleInvariant("glmAnova", (c) => glmAnova(fit(c)), {
      unitless: (r) => [r.table[1]![4]!, r.table[1]![5]!],
      squared: (r) => [r.table[1]![1]!, r.table[1]![3]!],
    });
    expectScaleInvariant("glmConfint", (c) => glmConfint(fit(c)), { units: (r) => [...r.lower, ...r.upper] });
  });
  it("cv and meanAD", () => {
    expectScaleInvariant("cv", (c) => cv(times(y, c)), { unitless: (r) => [r] });
    expectScaleInvariant("meanAD", (c) => meanAD(times(y, c)), { units: (r) => [r] });
    const m = [Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE];
    expect(cv(m)).toBeCloseTo(2 * Math.sqrt(3), 12);
    expect(meanAD(m) / Number.MAX_VALUE).toBeCloseTo(8 / 9, 12);
  });
});

describe("re-audit fixes", () => {
  it("F-01: ges counts two error strata whose sums of squares happen to be equal", () => {
    const u = [-3, -2, -1, 0, 1, 2, 3, 0];
    const d = { id: [] as string[], A: [] as string[], B: [] as string[], y: [] as number[] };
    u.forEach((us, s) => {
      for (const A of [-1, 1]) {
        for (const B of [-1, 1]) {
          d.id.push(`s${s}`);
          d.A.push(A < 0 ? "a" : "b");
          d.B.push(B < 0 ? "a" : "b");
          d.y.push(100 + A * (2 + us) + B * (3 + us));
        }
      }
    });
    const r = aovEz(d, { id: "id", dv: "y", within: ["A", "B"], es: ["ges"], correction: "none" });
    const row = r.anova.rowNames.indexOf("A");
    expect(r.anova.table[row]![4]).toBeCloseTo(128 / (128 + 112 + 112), 12);
  });
  it("F-04: a row of weight 0 with an infinite response does not make anova NaN", () => {
    const yy = [2, 4, 6.5, 8, 10, 12.5, 14, 16, Infinity].map((v) => (v === Infinity ? v : v * 1e-200));
    const t = anova(lm("y ~ x", { y: yy, x: [1, 2, 3, 4, 5, 6, 7, 8, 9], w: [1, 1, 1, 1, 1, 1, 1, 1, 0] }, { weights: "w" }));
    expect(Number.isFinite(t.table[0]![3])).toBe(true);
  });
  it("F-05: GG epsilon of a singular error SSP matrix", () => {
    const d = { id: ["s1", "s1", "s1", "s2", "s2", "s2"], w: ["a", "b", "c", "a", "b", "c"], y: [1, 2, 3, 2, 5, 7] };
    const r = aovEz(d, { id: "id", dv: "y", within: "w" });
    const [gg, pgg, hf] = r.corrections!.table[0]!;
    expect(gg).toBeCloseTo(0.5, 12);
    expect(pgg).toBeCloseTo(0.26119, 4);
    expect(hf).toBeNaN();
    expect(r.sphericity!.table[0]).toEqual([NaN, NaN]);
    expect(r.warnings.some((w) => w.includes("no Mauchly test"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("Huynh-Feldt epsilon of w is undefined"))).toBe(true);
  });
});
