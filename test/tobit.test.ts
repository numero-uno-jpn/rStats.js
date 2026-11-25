import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { tobit, tobitSummary } from "../src/models/tobit.js";
import { survreg } from "../src/models/survreg.js";

// R fixture from oracle/tobit.R (npm run oracle -- tobit): AER's tobit on survival's survreg
const fixture = JSON.parse(readFileSync(new URL("./fixtures/tobit.json", import.meta.url), "utf8")) as Record<string, any>;
const near = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const arr = (v: unknown): number[] => (Array.isArray(v) ? (v as number[]) : [v as number]);
// jsonlite writes -Inf and Inf as null: a missing left limit is -Inf, a missing right limit Inf
const lim = (v: unknown, missing: number) => (v === null || v === undefined ? missing : (v as number));

describe("tobit against AER::tobit", () => {
  it("gives R's coefficients, scale, variance, log-likelihoods, iterations, Wald test, AIC and counts", () => {
    const bad: string[] = [];
    for (const c of fixture.fits as Record<string, any>[]) {
      const key = `${c.formula} ${c.dist} [${c.left}, ${c.right}]${c.weights ? " w" : ""}${c.tdf ? ` df ${c.tdf}` : ""}`;
      const opts: Record<string, unknown> = { left: lim(c.left, -Infinity), right: lim(c.right, Infinity), dist: c.dist };
      if (c.tdf) opts.df = c.tdf;
      if (c.weights) opts.weights = c.weights;
      if (c.error) { expect(() => tobit(c.formula, fixture.data.d, opts)).toThrow(); continue; }
      const fit = tobit(c.formula, fixture.data.d, opts), s = tobitSummary(fit);
      if (JSON.stringify(fit.coefNames) !== JSON.stringify(arr(c.names))) bad.push(`${key} names ${fit.coefNames}`);
      fit.coefficients.forEach((v, j) => { if (!near(v, arr(c.coefficients)[j]!, 1e-9)) bad.push(`${key} coef[${j}] ${v} ${arr(c.coefficients)[j]}`); });
      if (!near(fit.scale[0]!, c.scale, 1e-9)) bad.push(`${key} scale`);
      fit.loglik.forEach((v, j) => { if (!near(v, c.loglik[j], 1e-11)) bad.push(`${key} loglik[${j}] ${v} ${c.loglik[j]}`); });
      arr(c.icoef).forEach((v, j) => { if (!near(fit.icoef[j]!, v, 1e-9)) bad.push(`${key} icoef[${j}]`); });
      const V = c.var as number[][] | number;
      fit.var.forEach((row, a) => row.forEach((v, b) => { const r = Array.isArray(V) ? V[a]![b]! : V; if (!near(v, r, 1e-8)) bad.push(`${key} var[${a},${b}] ${v} ${r}`); }));
      if (fit.iter !== c.iter) bad.push(`${key} iter ${fit.iter} ${c.iter}`);
      if (fit.df !== c.df || fit.idf !== c.idf || fit.dfResidual !== c.df_residual) bad.push(`${key} df`);
      const table = c.table as number[][];
      s.estimate.forEach((v, j) => { if (!near(v, table[j]![0]!, 1e-9) || !near(s.se[j]!, table[j]![1]!, 1e-8) || !near(s.p[j]!, table[j]![3]!, 1e-7)) bad.push(`${key} table[${j}]`); });
      if (JSON.stringify(s.names) !== JSON.stringify(arr(c.table_rows))) bad.push(`${key} table rows ${s.names}`);
      if (c.wald === null || c.wald === undefined) { if (s.wald !== null) bad.push(`${key} wald should be null`); }
      else if (s.wald === null || !near(s.wald.statistic, c.wald, 1e-8)) bad.push(`${key} wald ${s.wald?.statistic} ${c.wald}`);
      const aic = -2 * fit.loglik[1] + 2 * fit.df;
      if (!near(aic, c.aic, 1e-11) || fit.df !== c.logLik_df) bad.push(`${key} aic`);
      const counts = [fit.counts.total, fit.counts.left, fit.counts.uncensored, fit.counts.right];
      if (JSON.stringify(counts) !== JSON.stringify(c.counts)) bad.push(`${key} counts ${counts} ${c.counts}`);
      fit.linearPredictors.forEach((v, i) => { if (!near(v, c.linear_predictors[i], 1e-9)) bad.push(`${key} lp[${i}]`); });
    }
    expect(bad).toEqual([]);
  });

  it("tests the Wald statistic on p - 1 degrees of freedom, as R (one too few without an intercept)", () => {
    const c = (fixture.fits as Record<string, any>[]).find((f) => f.formula === "ys ~ 0 + x1 + x2")!;
    const s = tobitSummary(tobit(c.formula, fixture.data.d));
    expect(s.wald!.df).toBe(1);
  });

  it("gives R's errors", () => {
    for (const e of fixture.errors as Record<string, any>[]) {
      const data = e.data === "d0" ? fixture.data.d0 : fixture.data.d;
      const opts: Record<string, unknown> = {};
      if (e.left !== undefined) opts.left = e.left;
      if (e.right !== undefined) opts.right = e.right;
      if (e.dist !== undefined) opts.dist = e.dist;
      expect(() => tobit(e.formula, data, opts)).toThrow(e.error);
    }
  });
});

describe("the t distribution's degrees of freedom as df or parms (R's name)", () => {
  it("gives R's tobit fit with parms as with df, in tobit and in survreg", () => {
    const c = (fixture.fits as Record<string, any>[]).find((f) => f.tdf === 3)!;
    const a = tobit(c.formula, fixture.data.d, { dist: "t", df: 3 }), b = tobit(c.formula, fixture.data.d, { dist: "t", parms: 3 });
    expect(b.coefficients).toEqual(a.coefficients);
    expect(b.loglik).toEqual(a.loglik);
    arr(c.coefficients).forEach((v, j) => expect(Math.abs(b.coefficients[j]! - v)).toBeLessThan(1e-9 * Math.max(1, Math.abs(v))));
    const x = [[0], [1], [0], [1], [0], [1], [1], [0]], t = [1.2, 2.5, 0.7, 3.1, 1.9, 2.2, 4.0, 0.4];
    expect(survreg(t, undefined, x, { dist: "t", parms: 5 }).coefficients).toEqual(survreg(t, undefined, x, { dist: "t", df: 5 }).coefficients);
  });
  it("refuses both names, and either with a distribution other than t", () => {
    expect(() => tobit("ys ~ x1", fixture.data.d, { dist: "t", df: 3, parms: 3 })).toThrow(/not both/);
    expect(() => survreg([1, 2, 3], undefined, [], { dist: "t", df: 3, parms: 5 })).toThrow(/not both/);
    expect(() => tobit("ys ~ x1", fixture.data.d, { parms: 3 })).toThrow("Extreme value distribution has no optional parameters");
    expect(() => tobit("ys ~ x1", fixture.data.d, { dist: "t", parms: 2 })).toThrow("Degrees of freedom must be >=3");
  });
});
