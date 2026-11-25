import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { btm, btAbilities, countsToBinomial, qvcalc, worstErrors, type BtmOptions } from "../src/models/bradleyterry.js";

// R fixture from oracle/bradleyterry.R (npm run oracle -- bradleyterry): BradleyTerry2 1.1.4, qvcalc 1.0.4
const fx = JSON.parse(readFileSync(new URL("./fixtures/bradleyterry.json", import.meta.url), "utf8")) as Record<string, any>;
const near = (a: number, b: number, tol: number): boolean => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const arr = (v: unknown): any[] => (v === null || v === undefined ? [] : Array.isArray(v) ? v : [v]);
const D = fx.data;

function compare(bad: string[], key: string, ours: readonly number[], theirs: unknown, tol: number): void {
  const t = arr(theirs);
  if (ours.length !== t.length) { bad.push(`${key} length ${ours.length} ${t.length}`); return; }
  ours.forEach((v, i) => { if (!near(v, t[i], tol)) bad.push(`${key}[${i}] ${v} ${t[i]}`); });
}

const agg = D.agg, cov3 = D.cov3;
const base: BtmOptions = { outcome: ["win1", "win2"], player1: "player1", player2: "player2" };
const glmCases: [string, () => ReturnType<typeof btm>][] = [
  ["basic", () => btm(agg, { ...base, levels: D.levels })],
  ["refcat", () => btm(agg, { ...base, levels: D.levels, refcat: "C" })],
  ["probit", () => btm(agg, { ...base, levels: D.levels, link: "probit" })],
  ["cauchit", () => btm(agg, { ...base, levels: D.levels, link: "cauchit" })],
  ["home", () => btm(agg, { ...base, levels: D.levels, formula: "~ .. + home", contestCovariates: { home: ["home1", "home2"] } })],
  ["single", () => btm(D.single, { outcome: "result", player1: "player1", player2: "player2", levels: D.levels })],
  ["noRandom", () => btm(cov3, { ...base, levels: D.levels3, formula: "~ x[..]", predictors: D.preds })],
];

describe("btm without random effects against BTm", () => {
  it("gives R's coefficients, standard errors, deviances, AIC and abilities", () => {
    const bad: string[] = [];
    for (const [key, f] of glmCases) {
      const r = fx.fits[key], fit = f();
      expect(fit.coefNames, key).toEqual(arr(r.names));
      compare(bad, `${key} coef`, fit.coefficients, r.coefficients, 1e-9);
      compare(bad, `${key} se`, fit.stdError, r.se, 1e-8);
      compare(bad, `${key} deviance`, [fit.deviance, fit.nullDeviance, fit.aic], [r.deviance, r.null_deviance, r.aic], 1e-10);
      if (fit.dfResidual !== r.df_residual || fit.dfNull !== r.df_null) bad.push(`${key} df`);
      compare(bad, `${key} fitted`, fit.fittedValues, r.fitted, 1e-9);
      const a = btAbilities(fit);
      expect(a.levels, key).toEqual(r.abilities.rows);
      compare(bad, `${key} ability`, a.ability, r.abilities.ability, 1e-9);
      compare(bad, `${key} ability se`, a.se, r.abilities.se, 1e-8);
      compare(bad, `${key} ability vcov`, a.vcov.flat(), (r.abilities.vcov as number[][]).flat(), 1e-8);
      if (r.warnings) expect(fit.warnings, key).toEqual(arr(r.warnings));
    }
    expect(bad).toEqual([]);
  });
});

describe("btm with random effects (PQL) against BTm at tol 1e-10", () => {
  const pqlCases: [string, () => ReturnType<typeof btm>][] = [
    ["pql", () => btm(cov3, { ...base, levels: D.levels3, formula: "~ x[..] + (1 | ..)", predictors: D.preds })],
    ["pql2", () => btm(cov3, { ...base, levels: D.levels3, formula: "~ x[..] + z[..] + (1 | ..)", predictors: D.preds })],
    ["pql_probit", () => btm(cov3, { ...base, levels: D.levels3, formula: "~ x[..] + (1 | ..)", predictors: D.preds, link: "probit" })],
    ["pql_home", () => btm(cov3, { ...base, levels: D.levels3, formula: "~ x[..] + home + (1 | ..)", predictors: D.preds,
      contestCovariates: { home: ["home1", "home2"] } })],
    ["pql_na", () => btm(cov3, { ...base, levels: D.levels3, formula: "~ x[..] + (1 | ..)",
      predictors: { ...D.preds, x: D.preds.x.map((v: number, i: number) => (i === 2 ? null : v)) } })],
  ];
  it("gives R's coefficients, sigma, random effects, varFix, varSigma and abilities", () => {
    const bad: string[] = [];
    // R stops at its tolerance (1e-10 here); rStats.js solves to the fixed point: about 1e-12 apart
    const tol = 1e-9;
    for (const [key, f] of pqlCases) {
      const r = fx.fits[key], fit = f();
      expect(fit.coefNames, key).toEqual(arr(r.names));
      compare(bad, `${key} coef`, fit.coefficients, r.coefficients, tol);
      compare(bad, `${key} sigma`, [fit.sigma!], [r.sigma], tol);
      compare(bad, `${key} random`, fit.random!.filter((_, j) => !fit.separate.includes(fit.levels[j]!)), r.random, tol);
      compare(bad, `${key} varFix`, fit.vcov.flat(), arr(r.var_fix).flat(), tol);
      compare(bad, `${key} varSigma`, [fit.varSigma!], [r.var_sigma], tol);
      compare(bad, `${key} fitted`, fit.fittedValues, r.fitted, tol);
      const a = btAbilities(fit);
      compare(bad, `${key} ability`, a.ability, r.abilities.ability, tol);
      compare(bad, `${key} ability se`, a.se, r.abilities.se, tol);
      if (r.abilities.separate) expect(a.separate).toEqual(arr(r.abilities.separate));
      if (fit.dfResidual !== r.df_residual) bad.push(`${key} df ${fit.dfResidual}`);
    }
    const s = fx.fits.pql, fit = pqlCases[0]![1]();
    compare(bad, "summary fixed", [fit.coefficients[0]!, fit.stdError[0]!, fit.statistic[0]!, fit.pValue[0]!], s.summary_fixed[0], tol);
    compare(bad, "summary sd", [fit.sigma!, Math.sqrt(fit.varSigma!)], s.summary_ran[0].slice(0, 2), tol);
    expect(bad).toEqual([]);
  });
  it("is closer to the tight fit than R's default", () => {
    const fit = pqlCases[0]![1]();
    expect(Math.abs(fit.sigma! - fx.fits.pql.sigma)).toBeLessThan(Math.abs(fx.fits.pql_default.sigma - fx.fits.pql.sigma));
  });
  it("gives sigma 0 and the glm when the REML likelihood is largest at 0", () => {
    const z = fx.fits.pql_zero;
    const fit = btm(D.zero, { ...base, levels: D.levels3, formula: "~ x[..] + (1 | ..)", predictors: D.preds });
    expect(fit.sigma).toBe(0);
    expect(near(fit.coefficients[0]!, z.coefficients, 1e-9)).toBe(true);
    expect(near(fit.vcov[0]![0]!, z.var_fix, 1e-8)).toBe(true);
    expect(fit.random!.every((v) => v === 0)).toBe(true);
  });
  it("gives R's error for random effects without player covariates", () => {
    expect(() => btm(cov3, { ...base, levels: D.levels3, formula: "~ (1 | ..)", predictors: D.preds })).toThrow(fx.errors.random_only);
  });
});

describe("countsToBinomial, qvcalc and worstErrors", () => {
  it("countsToBinomial", () => {
    for (const c of fx.counts as Record<string, any>[]) {
      const r = countsToBinomial(c.table, c.levels);
      expect(r).toEqual({ player1: arr(c.result.player1), player2: arr(c.result.player2), win1: arr(c.result.win1), win2: arr(c.result.win2) });
    }
  });
  it("qvcalc and worstErrors", () => {
    const bad: string[] = [];
    const fits: Record<string, ReturnType<typeof btm>> = {
      basic: glmCases[0]![1](), refcat: glmCases[1]![1](),
      twelve: btm(cov3, { ...base, levels: D.levels3 }),
    };
    for (const [key, fit] of Object.entries(fits)) {
      const r = fx.qvcalc[key], q = qvcalc(btAbilities(fit));
      // R's optimizer stops short of the least squares solution (about 1e-8 relative)
      compare(bad, `${key} quasiVar`, q.quasiVar, r.quasi_var, 1e-6);
      compare(bad, `${key} relerrs`, q.relerrs, r.relerrs, 1e-6);
      compare(bad, `${key} worst`, worstErrors(q), r.worst, 1e-6);
      expect(q.relerrsNames).toEqual(r.relerrs_names);
    }
    expect(bad).toEqual([]);
  });
});
