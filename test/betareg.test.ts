import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { betareg, betaregSummary, betaregConfint, betaregPredict, betaregResiduals, type BetaregOptions } from "../src/models/betareg.js";
import type { DataFrame } from "../src/models/modelFrame.js";

// R fixture from oracle/betareg.R (npm run oracle -- betareg). R stops its optimiser short of the exact maximum (a
// Newton step from R's estimates is up to about 1e-7 relative), so estimates and what is built on them are compared at
// 1e-6 relative; the log-likelihood, flat at the maximum, at 1e-10
const fixture = JSON.parse(readFileSync(new URL("./fixtures/betareg.json", import.meta.url), "utf8")) as Record<string, any>;
const near = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const arr = (v: unknown): number[] => (Array.isArray(v) ? (v as number[]) : [v as number]);
const mat = (v: unknown, nrow: number): number[][] => {
  if (!Array.isArray(v)) return [[v as number]];
  return Array.isArray(v[0]) ? (v as number[][]) : nrow === 1 ? [v as number[]] : (v as number[]).map((x) => [x]);
};
const optionsOf = (c: Record<string, any>): BetaregOptions => {
  const o: BetaregOptions = {};
  if (c.link) o.link = c.link;
  if (c.link_phi) o.linkPhi = c.link_phi;
  if (c.type) o.type = c.type;
  if (c.weights) o.weights = c.weights;
  return o;
};
const TOL = 1e-6;

function compare(key: string, fit: ReturnType<typeof betareg>, c: Record<string, any>, bad: string[], newdata: DataFrame): void {
  const all = [...fit.coefficients.mean, ...fit.coefficients.precision];
  if (JSON.stringify(fit.names) !== JSON.stringify(arr(c.names))) bad.push(`${key} names ${fit.names} | ${c.names}`);
  all.forEach((v, j) => { if (!near(v, arr(c.coefficients)[j]!, TOL)) bad.push(`${key} coef[${j}] ${v} ${arr(c.coefficients)[j]}`); });
  const V = mat(c.vcov, all.length);
  fit.vcov.forEach((row, a) => row.forEach((v, b) => { if (!near(v, V[a]![b]!, 1e-5)) bad.push(`${key} vcov[${a},${b}] ${v} ${V[a]![b]}`); }));
  if (!near(fit.loglik, c.loglik, 1e-10)) bad.push(`${key} loglik ${fit.loglik} ${c.loglik}`);
  if (!near(fit.pseudoRSquared, c.pseudo_r_squared, TOL)) bad.push(`${key} pseudoR2 ${fit.pseudoRSquared} ${c.pseudo_r_squared}`);
  // R's bias is NA (null) for ML and BR
  if (c.bias !== undefined && c.bias !== null) arr(c.bias).forEach((v, j) => { if (v !== null && !near(fit.bias?.[j] ?? NaN, v, 1e-5)) bad.push(`${key} bias[${j}] ${fit.bias?.[j]} ${v}`); });
  if (fit.n !== c.n || fit.nobs !== c.nobs || fit.dfNull !== c.df_null || fit.dfResidual !== c.df_residual) bad.push(`${key} n/df`);
  if (fit.link !== c.link || fit.linkPhi !== c.link_phi || fit.type !== c.type) bad.push(`${key} link/type ${fit.link} ${fit.linkPhi} ${fit.type}`);
  arr(c.fitted).forEach((v, i) => { if (!near(fit.fitted[i]!, v, TOL)) bad.push(`${key} fitted[${i}]`); });
  const s = betaregSummary(fit);
  if (!near(s.aic, c.aic, 1e-10) || s.df !== c.logLik_df) bad.push(`${key} aic`);
  const tabs = [[s.mean, mat(c.mean_table, 1)], [s.precision, mat(c.precision_table, 1)]] as const;
  for (const [t, r] of tabs) t.estimate.forEach((v, j) => {
    const row = r[j]!;
    if (!near(v, row[0]!, TOL) || !near(t.se[j]!, row[1]!, 1e-5) || !near(t.z[j]!, row[2]!, 1e-5) || !near(t.p[j]!, row[3]!, 1e-4)) bad.push(`${key} table ${t.names[j]}`);
  });
  if (c.confint95 === undefined) return;
  for (const [lvl, k] of [[0.95, "confint95"], [0.9, "confint90"]] as const) {
    const ci = betaregConfint(fit, { level: lvl }), r = c[k] as number[][];
    ci.lower.forEach((v, j) => { if (!near(v, r[j]![0]!, 1e-5) || !near(ci.upper[j]!, r[j]![1]!, 1e-5)) bad.push(`${key} ${k}[${j}]`); });
  }
  for (const [type, r] of Object.entries(c.residuals as Record<string, number[]>)) {
    const mine = betaregResiduals(fit, { type: type as never });
    mine.forEach((v, i) => { if (!near(v, r[i]!, 1e-5)) bad.push(`${key} residuals ${type}[${i}] ${v} ${r[i]}`); });
  }
  const pr = c.predict as Record<string, any>;
  const check = (name: string, mine: number[] | number[][], r: unknown) => {
    const flat = (mine as unknown[]).flat() as number[], rr = Array.isArray(r) ? ((r as unknown[]).flat() as number[]) : [r as number];
    if (flat.length !== rr.length) { bad.push(`${key} predict ${name} length ${flat.length} ${rr.length}`); return; }
    flat.forEach((v, i) => { if (!near(v, rr[i]!, 1e-5)) bad.push(`${key} predict ${name}[${i}] ${v} ${rr[i]}`); });
  };
  check("response", betaregPredict(fit, { newdata }), pr.response);
  check("link", betaregPredict(fit, { newdata, type: "link" }), pr.link);
  check("precision", betaregPredict(fit, { newdata, type: "precision" }), pr.precision);
  check("variance", betaregPredict(fit, { newdata, type: "variance" }), pr.variance);
  check("quantile3", betaregPredict(fit, { newdata, type: "quantile", at: [0.25, 0.5, 0.75] }), pr.quantile3);
  check("quantile1", betaregPredict(fit, { newdata, type: "quantile", at: 0.5 }), pr.quantile1);
  check("density", betaregPredict(fit, { newdata, type: "density", at: 0.4 }), pr.density);
  check("parameters", betaregPredict(fit, { newdata, type: "parameters" }), pr.parameters);
  check("fitted link", betaregPredict(fit, { type: "link" }), pr.fitted_link);
  check("fitted precision", betaregPredict(fit, { type: "precision" }), pr.fitted_precision);
  // matrices: R's rows x at, column-major in the fixture's nested arrays (rows)
  const m3 = betaregPredict(fit, { newdata, type: "quantile", at: [0.25, 0.5, 0.75], elementwise: false }) as number[][];
  check("quantile3 matrix", m3, pr.quantile3_matrix);
  check("quantile2", betaregPredict(fit, { newdata, type: "quantile", at: [0.25, 0.75] }), pr.quantile2);
  check("probability", betaregPredict(fit, { newdata, type: "probability", at: [0.3, 0.6] }), pr.probability);
}

describe("betareg against betareg::betareg", () => {
  it("gives R's fits (ML, BC, BR), summaries, intervals, residuals and predictions", () => {
    const bad: string[] = [];
    for (const c of fixture.fits as Record<string, any>[]) {
      const key = `${c.formula} ${c.link ?? ""} ${c.link_phi ?? ""} ${c.type ?? ""} ${c.weights ?? ""}`;
      if (c.error) { expect(() => betareg(c.formula, fixture.data.d, optionsOf(c)), key).toThrow(c.error); continue; }
      compare(key, betareg(c.formula, fixture.data.d, optionsOf(c)), c, bad, fixture.data.newdata);
    }
    expect(bad).toEqual([]);
  });

  it("drops rows with missing values and keeps rows with a zero weight out of the fit", () => {
    const bad: string[] = [];
    for (const m of fixture.missing as Record<string, any>[]) {
      const fit = betareg(m.formula, fixture.data.d2, m.weights ? { weights: m.weights } : {});
      compare(`missing ${m.formula}`, fit, { ...m.fit, link: "logit", link_phi: "identity", type: "ML" }, bad, fixture.data.newdata);
    }
    expect(bad).toEqual([]);
  });

  it("gives R's errors", () => {
    for (const e of fixture.errors as Record<string, any>[]) {
      expect(() => betareg(e.formula, fixture.data.d3, optionsOf(e))).toThrow(e.error);
    }
    expect(() => betareg("y ~ x", { y: [0, 0.2, 0.5, 0.7], x: [1, 2, 3, 4] })).toThrow(/strictly between 0 and 1/);
  });
});
