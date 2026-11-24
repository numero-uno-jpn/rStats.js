import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { multinom, multinomSummary, multinomConfint, multinomPredict, multinomAnova, multinomVcov } from "../src/entries/regression.js";
import { setSeed, runif } from "../src/entries/distributions.js";

// R converged tightly (reltol 1e-16): within about 5e-8 of the maximum that rStats.js finds exactly
const fixture = JSON.parse(readFileSync(new URL("./fixtures/multinomreg.json", import.meta.url), "utf8")) as Record<string, any>;
const cases: Record<string, { set: string; formula: string; weights?: string }> = {
  sim: { set: "sim", formula: "y ~ x1 + x2 + f" },
  sim_x1: { set: "sim", formula: "y ~ x1" },
  sim_w: { set: "sim", formula: "y ~ x1 + x2 + f", weights: "w" },
  five: { set: "five", formula: "y ~ z1 + z2" },
  survey: { set: "survey", formula: "y ~ sex + age + exer" },
  housing: { set: "housing", formula: "y ~ infl + type + cont", weights: "freq" },
};
const levelsOf = (set: string) => fixture.levels[set] as Record<string, string[]> | undefined;
const fitCase = (k: string) => {
  const c = cases[k]!;
  return multinom(c.formula, fixture.data[c.set], { ...(c.weights ? { weights: c.weights } : {}), ...(levelsOf(c.set) ? { levels: levelsOf(c.set)! } : {}) });
};
/** R's (K - 1) x p coefficient matrix, column-major, as rows */
const rows = (m: { dim: number[] | null; values: number[] }, K1: number, p: number): number[][] =>
  Array.from({ length: K1 }, (_, k) => Array.from({ length: p }, (_, j) => m.values[k + K1 * j]!));
const near = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

describe("multinom against nnet::multinom (converged tightly)", () => {
  it("gives R's coefficients, standard errors, Hessian, deviance, AIC, fitted values, confint and pseudo R²", () => {
    const bad: string[] = [];
    for (const k of Object.keys(cases)) {
      const r = fixture[`fit_${k}`].value, fit = fitCase(k);
      const K1 = fit.levels.length - 1, p = fit.columnNames.length;
      if (JSON.stringify(fit.levels) !== JSON.stringify(r.lev)) bad.push(`${k}.levels ${fit.levels}`);
      if (JSON.stringify(fit.columnNames) !== JSON.stringify(K1 > 1 ? r.coef.dimnames[1] : r.coef.dimnames?.[1] ?? fit.columnNames)) bad.push(`${k}.columns`);
      const rc = rows(r.coef, K1, p), rse = rows(r.se, K1, p);
      fit.coefficients.forEach((row, a) => row.forEach((v, j) => { if (!near(v, rc[a]![j]!, 1e-6)) bad.push(`${k}.coef[${a},${j}] ${v} ${rc[a]![j]}`); }));
      fit.se.forEach((row, a) => row.forEach((v, j) => { if (!near(v, rse[a]![j]!, 1e-6)) bad.push(`${k}.se[${a},${j}] ${v} ${rse[a]![j]}`); }));
      const P = K1 * p;
      fit.hessian.forEach((row, a) => row.forEach((v, b) => { if (!near(v, r.hessian.values[a + P * b], 1e-6)) bad.push(`${k}.hessian[${a},${b}]`); }));
      if (JSON.stringify(fit.parameterNames) !== JSON.stringify(r.hessian.dimnames[0])) bad.push(`${k}.parameterNames`);
      for (const [name, a, b] of [["deviance", fit.deviance, r.deviance], ["aic", fit.aic, r.AIC], ["logLik", fit.logLik, r.logLik]] as const) {
        if (!near(a, b, 1e-12)) bad.push(`${k}.${name} ${a} ${b}`);
      }
      if (fit.edf !== r.edf) bad.push(`${k}.edf`);
      const n = fit.n, K = K1 + 1;
      fit.fittedValues.forEach((row, i) => row.forEach((v, c) => { if (Math.abs(v - r.fitted.values[i + n * c]) > 1e-7) bad.push(`${k}.fitted[${i},${c}]`); }));
      for (const [lvl, key] of [[0.95, "confint"], [0.9, "confint90"]] as const) {
        const ci = multinomConfint(fit, { level: lvl }), arr = r[key].values; // [p, 2, K-1]
        ci.lower.forEach((row, a) => row.forEach((v, j) => { if (!near(v, arr[j + p * (0 + 2 * a)], 1e-6)) bad.push(`${k}.${key}.lower[${a},${j}]`); }));
        ci.upper.forEach((row, a) => row.forEach((v, j) => { if (!near(v, arr[j + p * (1 + 2 * a)], 1e-6)) bad.push(`${k}.${key}.upper[${a},${j}]`); }));
      }
      const s = multinomSummary(fit);
      const rw = rows(r.wald, K1, p);
      s.zValue.forEach((row, a) => row.forEach((v, j) => { if (!near(v, rw[a]![j]!, 1e-6)) bad.push(`${k}.z[${a},${j}]`); }));
      if (!near(s.nullLogLik, r.null.logLik, 1e-12)) bad.push(`${k}.nullLogLik ${s.nullLogLik} ${r.null.logLik}`);
      for (const [name, a, b] of [["mcFadden", s.mcFadden, r.r2.mcfadden], ["coxSnell", s.coxSnell, r.r2.coxSnell], ["nagelkerke", s.nagelkerke, r.r2.nagelkerke]] as const) {
        if (!near(a, b, 1e-10)) bad.push(`${k}.${name} ${a} ${b}`);
      }
      setSeed(123);
      const cls = multinomPredict(fit) as string[];
      if (JSON.stringify(cls) !== JSON.stringify(r.class123)) bad.push(`${k}.class`);
      if (runif(1)[0] !== r.nextUniform) bad.push(`${k}: the random numbers after predict differ`);
      if (multinomVcov(fit).vcov.length !== P) bad.push(`${k}.vcov`);
      void K;
    }
    expect(bad.slice(0, 30)).toEqual([]);
  });
  it("gives R's fit with decay and for a two-level response", () => {
    const sim = fixture.data.sim;
    for (const dec of [0.01, 0.5]) {
      const r = fixture[`decay_${dec}`].value, fit = multinom("y ~ x1 + x2 + f", sim, { decay: dec });
      rows(r.coef, 2, 5).forEach((row, a) => row.forEach((v, j) => expect(near(fit.coefficients[a]![j]!, v, 1e-6)).toBe(true)));
      rows(r.se, 2, 5).forEach((row, a) => row.forEach((v, j) => expect(near(fit.se[a]![j]!, v, 1e-6)).toBe(true)));
      expect(near(fit.deviance, r.deviance, 1e-12)).toBe(true);
      expect(near(fit.aic, r.AIC, 1e-12)).toBe(true);
    }
    const sim2 = { ...sim, y: sim.y.map((v: string) => (v === "A" ? "A" : "notA")) };
    const r = fixture.twoLevel.value, fit = multinom("y ~ x1 + x2 + f", sim2);
    fit.coefficients[0]!.forEach((v, j) => expect(near(v, r.coef.values[j], 1e-6)).toBe(true));
    expect(near(fit.deviance, r.deviance, 1e-12)).toBe(true);
  });
  it("predicts for new data, and tests nested models as R", () => {
    const sim = fixture.data.sim, fit = multinom("y ~ x1 + x2 + f", sim);
    const r = fixture.predict_new.value;
    const probs = multinomPredict(fit, { newdata: r.newdata, type: "probs" }) as number[][];
    probs.forEach((row, i) => row.forEach((v, c) => expect(Math.abs(v - r.probs.values[i + 4 * c])).toBeLessThan(1e-7)));
    expect(multinomPredict(fit, { newdata: r.newdata })).toEqual(r.class);
    const a = multinomAnova(fit, multinom("y ~ 1", sim), multinom("y ~ x1", sim));
    const ra = fixture.anova.value.rows;
    expect(a.model).toEqual(ra.Model);
    expect(a.residDf).toEqual(ra["Resid. df"]);
    a.residDev.forEach((v, i) => expect(near(v, ra["Resid. Dev"][i], 1e-12)).toBe(true));
    expect(a.test).toEqual(ra.Test);
    a.lrStat.slice(1).forEach((v, i) => expect(near(v, ra["LR stat."][i + 1], 1e-9)).toBe(true));
    a.pValue.slice(1).forEach((v, i) => expect(near(v, ra["Pr(Chi)"][i + 1], 1e-8)).toBe(true));
    const h = fixture.data.housing, lv = fixture.levels.housing;
    const ah = multinomAnova(multinom("y ~ infl", h, { weights: "freq", levels: lv }), multinom("y ~ infl + type + cont", h, { weights: "freq", levels: lv }));
    const rh = fixture.anova_housing.value.rows;
    expect(ah.residDf).toEqual(rh["Resid. df"]);
    expect(near(ah.lrStat[1]!, rh["LR stat."][1], 1e-9)).toBe(true);
  });
  it("handles R's inputs: one level, an unused level, missing values, a numeric response", () => {
    const sim = fixture.data.sim;
    expect(() => multinom("y ~ x1", { y: new Array(10).fill("A"), x1: Array.from({ length: 10 }, (_, i) => i + 1) })).toThrow(fixture.err_one_level.error);
    const u = multinom("y ~ x1", sim, { levels: { y: ["A", "B", "C", "D"] } });
    expect(u.levels).toEqual(fixture.warn_unused.value.lev);
    expect(u.warnings).toEqual([].concat(fixture.warn_unused.warnings));
    expect(near(u.deviance, fixture.warn_unused.value.deviance, 1e-12)).toBe(true);
    const x1 = sim.x1.slice(); x1[2] = NaN; x1[6] = NaN;
    const m = multinom("y ~ x1 + x2", { ...sim, x1 });
    expect(m.n).toBe(fixture.missing.value.n);
    expect(near(m.deviance, fixture.missing.value.deviance, 1e-12)).toBe(true);
    const yn = sim.y.map((v: string) => ({ A: 1, B: 2, C: 3 })[v as "A"]);
    expect(multinom("y ~ x1", { ...sim, y: yn }).levels).toEqual(fixture.numeric_response.value.lev);
  });
});
