// Effect sizes as the effectsize package computes them: the standardized differences Cohen's d and Hedges' g with
// their confidence intervals, and eta, omega and epsilon squared of the terms of an analysis-of-variance table.
//
// Written for rStats.js from oracle/effectsize-behaviour.md (no ported code; effectsize's source was not read). The
// confidence intervals invert the noncentral t and F distributions; unlike effectsize, which finds the noncentrality
// parameters with an optimiser (about 1e-9 accurate), the limits here are the exact roots (Brent's method run to
// the resolution of doubles).

import { pf, qf } from "../distributions/f.js";
import { pt } from "../distributions/t.js";
import { completePairs, dropNaN, mean, variance } from "../internal/summary.js";
import { anova, type AnovaTable } from "../models/anovaSequential.js";
import type { LmFormulaResult } from "../models/lm.js";
import { uniroot } from "../numerics/integrate.js";
import { lgamma } from "../special/gamma.js";
import { matchChoice } from "./power.js";
import type { Alternative, Sample } from "./types.js";

/** Options for {@link cohensD} and {@link hedgesG}. */
export interface CohensDOptions {
  /** Two samples: standardize by the pooled standard deviation (default `true`) or by `sqrt((s1² + s2²)/2)`. */
  pooledSd?: boolean;
  /** The difference (or mean) under the null hypothesis. Default `0`. */
  mu?: number;
  /** Paired samples: the effect size of the differences `x - y`. Default `false`. */
  paired?: boolean;
  /** Confidence level of the interval, or `null` for no interval. Default `0.95`. */
  ci?: number | null;
  /** `"two.sided"` (default), `"less"` or `"greater"`: a one-sided interval is open on the other side. */
  alternative?: Alternative | (string & {});
  /** {@link cohensD} only: apply Hedges' small-sample correction (the result is Hedges' g). Default `false`. */
  adjust?: boolean;
}

/** Result of {@link cohensD} and {@link hedgesG}. */
export interface CohensDResult {
  /** `"Cohens_d"` or `"Hedges_g"`. */
  name: "Cohens_d" | "Hedges_g";
  value: number;
  /** Confidence level (absent without an interval). */
  ci?: number;
  ciLow?: number;
  ciHigh?: number;
  /** effectsize's warnings. */
  warnings: string[];
}

const NA_WARNING = "Missing values detected. NAs dropped.";
/** Brent's method run until the bracket is as narrow as doubles allow */
const EXACT = { tol: 0, maxiter: 5000 };

/** Hedges' correction J(df) = Γ(df/2) / (sqrt(df/2) Γ((df − 1)/2)) */
function hedgesJ(df: number): number {
  return Math.exp(lgamma(df / 2) - Math.log(Math.sqrt(df / 2)) - lgamma((df - 1) / 2));
}

/** The noncentrality parameter with pt(t, df, ncp) = p (pt decreases in ncp) */
function ncpOfT(t: number, df: number, p: number): number {
  return uniroot((ncp) => pt(t, df, { ncp }) - p, t - 1, t + 1, { ...EXACT, extendInt: "downX" }).root;
}

function standardizedDifference(x: Sample, y: Sample | undefined, options: CohensDOptions, adjust: boolean): CohensDResult {
  const pooled = options.pooledSd ?? true;
  const mu = options.mu ?? 0;
  const paired = options.paired ?? false;
  const ci = options.ci === undefined ? 0.95 : options.ci;
  const alt = matchChoice(options.alternative, ["two.sided", "less", "greater"] as const);
  const xs = Array.from(x);
  const ys = y === undefined ? undefined : Array.from(y);
  const warnings: string[] = [];
  if (xs.some(Number.isNaN) || (ys?.some(Number.isNaN) ?? false)) warnings.push(NA_WARNING);
  let d: number;
  let s: number;
  let se: number;
  let h: number;
  let df: number;
  if (ys === undefined || paired) {
    let v: number[];
    if (ys === undefined) v = dropNaN(xs);
    else {
      const [a, b] = completePairs(xs, ys);
      v = a.map((ai, i) => ai - b[i]!);
    }
    const n = v.length;
    d = mean(v);
    s = Math.sqrt(variance(v));
    se = s / Math.sqrt(n);
    h = 1 / n;
    df = n - 1;
  } else {
    const a = dropNaN(xs);
    const b = dropNaN(ys);
    const n1 = a.length;
    const n2 = b.length;
    d = mean(a) - mean(b);
    const s1 = Math.sqrt(variance(a));
    const s2 = Math.sqrt(variance(b));
    if (pooled) {
      s = Math.sqrt(((n1 - 1) * s1 ** 2 + (n2 - 1) * s2 ** 2) / (n1 + n2 - 2));
      se = s * Math.sqrt(1 / n1 + 1 / n2);
      h = 1 / n1 + 1 / n2;
      df = n1 + n2 - 2;
    } else {
      s = Math.sqrt((s1 ** 2 + s2 ** 2) / 2);
      h = (2 * (n2 * s1 ** 2 + n1 * s2 ** 2)) / (n1 * n2 * (s1 ** 2 + s2 ** 2));
      se = Math.sqrt(s1 ** 2 / n1 + s2 ** 2 / n2);
      df = se ** 4 / ((s1 ** 2 / n1) ** 2 / (n1 - 1) + (s2 ** 2 / n2) ** 2 / (n2 - 1));
    }
  }
  const j = adjust ? hedgesJ(df) : 1;
  const value = ((d - mu) / s) * j;
  const name = adjust ? "Hedges_g" : "Cohens_d";
  if (ci === null) return { name, value, warnings };
  const level = alt === "two.sided" ? ci : 2 * ci - 1;
  const t = (d - mu) / se;
  let ciLow = ncpOfT(t, df, (1 + level) / 2) * Math.sqrt(h) * j;
  let ciHigh = ncpOfT(t, df, (1 - level) / 2) * Math.sqrt(h) * j;
  if (alt === "less") ciLow = -Infinity;
  if (alt === "greater") ciHigh = Infinity;
  return { name, value, ci, ciLow, ciHigh, warnings };
}

/**
 * Cohen's d: the standardized difference of means of two samples (pooled or averaged standard deviation), of paired
 * samples, or of one sample against `mu`, with a confidence interval from the noncentral t distribution. Equivalent
 * to effectsize's `cohens_d()`.
 *
 * @example
 * ```ts
 * cohensD([5.1, 4.9, 6.2, 5.8], [4.1, 4.5, 3.9, 5.0]).value; // 2.049693834034246
 * ```
 */
export function cohensD(x: Sample, y?: Sample, options: CohensDOptions = {}): CohensDResult {
  return standardizedDifference(x, y, options, options.adjust ?? false);
}

/**
 * Hedges' g: Cohen's d and its interval multiplied by the small-sample correction J(df). Equivalent to effectsize's
 * `hedges_g()`.
 */
export function hedgesG(x: Sample, y?: Sample, options: Omit<CohensDOptions, "adjust"> = {}): CohensDResult {
  return standardizedDifference(x, y, options, true);
}

/** Options for {@link etaSquared}, {@link omegaSquared} and {@link epsilonSquared}. */
export interface AnovaEffectSizeOptions {
  /** Partial effect sizes (default `true`). A table with a single term always gives the non-partial one. */
  partial?: boolean;
  /** Confidence level of the interval, or `null` for no interval. Default `0.95`. */
  ci?: number | null;
  /** `"greater"` (default: the interval is [lower, 1]), `"two.sided"` or `"less"` ([0, upper]). */
  alternative?: Alternative | (string & {});
}

/** Options for {@link etaSquared}. */
export interface EtaSquaredOptions extends AnovaEffectSizeOptions {
  /**
   * Generalized eta squared: `true` (all factors manipulated) or the names of the observed factors. Default
   * `false`.
   */
  generalized?: boolean | readonly string[];
}

/** Result of the ANOVA effect sizes: one row per term. */
export interface AnovaEffectSizeTable {
  /** effectsize's columns: the effect size (`"Eta2_partial"`, `"Omega2"`, ...), then `"CI"`, `"CI_low"`, `"CI_high"`. */
  colNames: string[];
  /** The terms. */
  rowNames: string[];
  /** One array per term. */
  table: number[][];
  /** effectsize's warnings. */
  warnings: string[];
}

type Kind = "Eta2" | "Omega2" | "Epsilon2";

const isFit = (m: AnovaTable | LmFormulaResult): m is LmFormulaResult => Array.isArray((m as Partial<LmFormulaResult>).effects);

/** The noncentrality limits of an F value: ncp ≥ 0 with pf(F, df1, df2, ncp) = p (pf decreases in ncp), 0 if none */
function ncpOfF(f: number, df1: number, df2: number, p: number): number {
  const g = (ncp: number): number => (pf(f, df1, df2, { ncp }) as number) - p;
  if (!(g(0) > 0)) return 0;
  if (f === Infinity) return Infinity;
  return uniroot(g, 0, Math.max(10, f * df1 * 4), { ...EXACT, extendInt: "downX" }).root;
}

function anovaEffectSize(model: AnovaTable | LmFormulaResult, kind: Kind, options: EtaSquaredOptions): AnovaEffectSizeTable {
  const tab = isFit(model) ? anova(model) : model;
  if (typeof tab !== "object" || tab === null || !Array.isArray(tab.colNames) || !Array.isArray(tab.table)) {
    throw new TypeError("needs a table of anova() or Anova(), or a fit from lm() with a formula");
  }
  const ci = options.ci === undefined ? 0.95 : options.ci;
  const alt = matchChoice(options.alternative ?? "greater", ["two.sided", "less", "greater"] as const);
  const iDf = tab.colNames.indexOf("Df");
  const iSS = tab.colNames.indexOf("Sum Sq");
  if (iDf < 0 || iSS < 0) throw new TypeError("the table needs the columns 'Df' and 'Sum Sq'");
  const rows = tab.rowNames.map((name, i) => ({ name, df: tab.table[i]![iDf]!, ss: tab.table[i]![iSS]! })).filter((r) => r.name !== "(Intercept)");
  const res = rows.find((r) => r.name === "Residuals");
  if (res === undefined) throw new TypeError("the table has no row 'Residuals'");
  const terms = rows.filter((r) => r !== res);
  const dfe = res.df;
  const sse = res.ss;
  const mse = sse / dfe;
  const ssTot = rows.reduce((a, r) => a + r.ss, 0);
  const nObs = rows.reduce((a, r) => a + r.df, 0) + 1;

  const gen = kind === "Eta2" ? (options.generalized ?? false) : false;
  const single = terms.length === 1;
  const mode: "partial" | "plain" | "generalized" = single ? "plain" : gen !== false ? "generalized" : (options.partial ?? true) ? "partial" : "plain";
  // the terms that contain an observed factor as a whole word
  const observed = Array.isArray(gen) ? gen : [];
  const word = (name: string): RegExp => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  const missing = observed.filter((o) => !terms.some((t) => word(o).test(t.name)));
  if (missing.length > 0) throw new Error(`Observed variable not in data: ${missing.join(", ")}`);
  const isObserved = (name: string): boolean => observed.some((o) => word(o).test(name));
  const ssObserved = terms.reduce((a, t) => (isObserved(t.name) ? a + t.ss : a), 0);

  const value = (t: { name: string; df: number; ss: number }): number => {
    const { ss, df } = t;
    if (kind === "Eta2") {
      if (mode === "partial") return ss / (ss + sse);
      if (mode === "plain") return ss / ssTot;
      return ss / (ss + sse + ssObserved - (isObserved(t.name) ? ss : 0));
    }
    if (kind === "Omega2") {
      const v = mode === "partial" ? (ss - df * mse) / (ss + (nObs - df) * mse) : (ss - df * mse) / (ssTot + mse);
      return Math.max(0, v);
    }
    const v = mode === "partial" ? (ss - df * mse) / (ss + sse) : (ss - df * mse) / ssTot;
    return Math.max(0, v);
  };
  const column = `${kind}${mode === "plain" ? "" : `_${mode}`}`;
  const table = terms.map((t) => {
    const es = value(t);
    if (ci === null) return [es];
    const level = alt === "two.sided" ? ci : 2 * ci - 1;
    const e = Math.max(0, es);
    const f = e / t.df / ((1 - e) / dfe);
    let lo = ncpOfF(f, t.df, dfe, (1 + level) / 2);
    let hi = ncpOfF(f, t.df, dfe, (1 - level) / 2);
    if (f <= (qf((1 - level) / 2, t.df, dfe) as number)) hi = 0;
    if (f <= (qf((1 + level) / 2, t.df, dfe) as number)) lo = 0;
    let ciLow = lo === Infinity ? 1 : lo / (lo + dfe);
    let ciHigh = hi === Infinity ? 1 : hi / (hi + dfe);
    if (alt === "less") ciLow = 0;
    if (alt === "greater") ciHigh = 1;
    return [es, ci, ciLow, ciHigh];
  });
  return {
    colNames: ci === null ? [column] : [column, "CI", "CI_low", "CI_high"],
    rowNames: terms.map((t) => t.name),
    table,
    warnings: [],
  };
}

/**
 * Eta squared of the terms of an analysis-of-variance table (partial by default, or generalized), with confidence
 * intervals from the noncentral F distribution. Equivalent to effectsize's `eta_squared()` for a table of
 * `anova()` or `Anova()`; a fit from `lm()` with a formula is replaced by its `anova()` table.
 *
 * @example
 * ```ts
 * etaSquared(anova(lm("y ~ g", data))).colNames; // ["Eta2", "CI", "CI_low", "CI_high"]
 * ```
 */
export function etaSquared(model: AnovaTable | LmFormulaResult, options: EtaSquaredOptions = {}): AnovaEffectSizeTable {
  return anovaEffectSize(model, "Eta2", options);
}

/** Omega squared of the terms of an analysis-of-variance table. Equivalent to effectsize's `omega_squared()`. */
export function omegaSquared(model: AnovaTable | LmFormulaResult, options: AnovaEffectSizeOptions = {}): AnovaEffectSizeTable {
  return anovaEffectSize(model, "Omega2", options);
}

/** Epsilon squared of the terms of an analysis-of-variance table. Equivalent to effectsize's `epsilon_squared()`. */
export function epsilonSquared(model: AnovaTable | LmFormulaResult, options: AnovaEffectSizeOptions = {}): AnovaEffectSizeTable {
  return anovaEffectSize(model, "Epsilon2", options);
}
