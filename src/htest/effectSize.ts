// Effect sizes as the effectsize package computes them: the standardized differences Cohen's d and Hedges' g with
// their confidence intervals, and eta, omega and epsilon squared of the terms of an analysis-of-variance table, also
// of repeated-measures designs (aov with Error() strata, aovEz).
//
// Written for rStats.js from oracle/effectsize-behaviour.md and oracle/rm-tests-behaviour.md (no ported code;
// effectsize's source was not read). The confidence intervals invert the noncentral t and F distributions; unlike
// effectsize, which finds the noncentrality parameters with an optimiser (about 1e-9 accurate), the limits here are
// the exact roots (Brent's method run to the resolution of doubles).

import { pf, qf } from "../distributions/f.js";
import { pt } from "../distributions/t.js";
import { completePairs, dropNaN, mean, variance } from "../internal/summary.js";
import { anova, aovSummary, type AnovaTable, type AovStrataSummary } from "../models/anovaSequential.js";
import type { AovEzResult } from "../models/aovEz.js";
import type { AovStrataFit } from "../models/aovStrata.js";
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
  /**
   * Partial effect sizes (default `true`). A table with a single term always gives the non-partial one (not so for
   * models with error strata).
   */
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
  /** For aov with `Error()`: the error stratum of each row (`"id"`, `"id:W"`, `"Within"`). */
  groups?: string[];
  /** effectsize's warnings. */
  warnings: string[];
}

/**
 * A model of the ANOVA effect sizes: a table of `anova()` or `Anova()`, a fit from `lm()` or `aov()` (also with
 * `Error()`), the `aovSummary()` of an `aov()` fit with `Error()`, or a result of `aovEz()`.
 */
export type AnovaEffectSizeModel = AnovaTable | LmFormulaResult | AovStrataFit | AovStrataSummary | AovEzResult;

type Kind = "Eta2" | "Omega2" | "Epsilon2";

/** A term of an analysis-of-variance table */
interface Term {
  name: string;
  df: number;
  ss: number;
}

/** An error stratum: its terms and its residual */
interface Stratum {
  name: string;
  terms: Term[];
  sse: number;
  dfe: number;
}

type StrataModel = AovStrataFit | AovStrataSummary | AovEzResult;

const isFit = (m: object): m is LmFormulaResult => Array.isArray((m as Partial<LmFormulaResult>).effects);
const isStrataFit = (m: object): m is AovStrataFit => (m as Partial<AovStrataFit>).multistratum === true;
const isStrataSummary = (m: object): m is AovStrataSummary => Array.isArray((m as Partial<AovStrataSummary>).strata);
const isEz = (m: object): m is AovEzResult => {
  const e = m as Partial<AovEzResult>;
  return typeof e.univariate === "object" && typeof e.anova === "object";
};

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A name as a whole word */
const word = (name: string): RegExp => new RegExp(`\\b${escapeRegExp(name)}\\b`);

/** The strata of aov with Error() from its summary (intercept stratum left out), and the subject stratum */
function summaryStrata(s: AovStrataSummary): { strata: Stratum[]; subject: Stratum } {
  const strata = s.strata
    .filter((st) => st.stratum !== "Error: (Intercept)")
    .map((st): Stratum => {
      const name = st.stratum.replace(/^Error: /, "");
      const iDf = st.colNames.indexOf("Df");
      const iSS = st.colNames.indexOf("Sum Sq");
      const rows = st.rowNames.map((r, i) => ({ name: r, df: st.table[i]![iDf]!, ss: st.table[i]![iSS]! }));
      const res = rows.find((r) => r.name === "Residuals");
      if (res === undefined) throw new Error(`the error stratum '${name}' has no residual degrees of freedom`);
      return { name, terms: rows.filter((r) => r !== res), sse: res.ss, dfe: res.df };
    });
  if (strata.length === 0) throw new TypeError("the fit has no error strata");
  // the subject stratum is named by the first variable of the Error() term: the first variable of the first stratum
  // (the strata follow the terms of the error model)
  const first = strata[0]!.name.split(":")[0]!;
  const subject = strata.find((st) => st.name === first);
  if (subject === undefined) throw new Error(`there is no error stratum '${first}'`);
  return { strata, subject };
}

/**
 * The strata of aovEz from car's univariate tests: a row without a within-subject factor in its name belongs to the
 * subject stratum, any other to the stratum of the within-subject term made of the factors in its name; a stratum's
 * residual is the Error SS and den Df of its rows (for the subject stratum also those of the intercept row, which is
 * not a term). Returns the terms in the order of afex's table.
 */
function ezStrata(m: AovEzResult): { strata: Stratum[]; subject: Stratum; order: Term[] } {
  const u = m.univariate;
  const iSS = u.colNames.indexOf("Sum Sq");
  const strata: Stratum[] = [];
  const stratumOf = (name: string, sse: number, dfe: number): Stratum => {
    let st = strata.find((s) => s.name === name);
    if (st === undefined) strata.push((st = { name, terms: [], sse, dfe }));
    return st;
  };
  const terms = new Map<string, Term>();
  if (u.colNames.includes("Error SS")) {
    const iDf = u.colNames.indexOf("num Df");
    const iE = u.colNames.indexOf("Error SS");
    const iDen = u.colNames.indexOf("den Df");
    u.rowNames.forEach((name, i) => {
      const row = u.table[i]!;
      const ws = m.within.filter((w) => word(w).test(name));
      const st = stratumOf(ws.length === 0 ? "Subject" : `Subject:${ws.join(":")}`, row[iE]!, row[iDen]!);
      if (name === "(Intercept)") return;
      const t = { name, df: row[iDf]!, ss: row[iSS]! };
      st.terms.push(t);
      terms.set(name, t);
    });
  } else {
    // between-subjects factors only: car's Anova table, every term in the subject stratum
    const iDf = u.colNames.indexOf("Df");
    const r = u.rowNames.indexOf("Residuals");
    const st = stratumOf("Subject", u.table[r]![iSS]!, u.table[r]![iDf]!);
    u.rowNames.forEach((name, i) => {
      if (name === "(Intercept)" || name === "Residuals") return;
      const t = { name, df: u.table[i]![iDf]!, ss: u.table[i]![iSS]! };
      st.terms.push(t);
      terms.set(name, t);
    });
  }
  const subject = strata.find((s) => s.name === "Subject");
  if (subject === undefined) throw new Error("the result has no subject stratum");
  const order = m.anova.rowNames.map((name) => {
    const t = terms.get(name);
    if (t === undefined) throw new Error(`there is no univariate test of '${name}'`);
    return t;
  });
  return { strata, subject, order };
}

/** The observed factors of a generalized eta squared: the test of a term, and the sum of SS over those terms */
function observedTerms(gen: boolean | readonly string[], terms: readonly Term[]): { isObserved: (name: string) => boolean; ssObserved: number } {
  const observed: readonly string[] = Array.isArray(gen) ? gen : [];
  const missing = observed.filter((o) => !terms.some((t) => word(o).test(t.name)));
  if (missing.length > 0) throw new Error(`Observed variable not in data: ${missing.join(", ")}`);
  const isObserved = (name: string): boolean => observed.some((o) => word(o).test(name));
  return { isObserved, ssObserved: terms.reduce((a, t) => (isObserved(t.name) ? a + t.ss : a), 0) };
}

/** The noncentrality limits of an F value: ncp ≥ 0 with pf(F, df1, df2, ncp) = p (pf decreases in ncp), 0 if none */
function ncpOfF(f: number, df1: number, df2: number, p: number): number {
  const g = (ncp: number): number => (pf(f, df1, df2, { ncp }) as number) - p;
  if (!(g(0) > 0)) return 0;
  if (f === Infinity) return Infinity;
  return uniroot(g, 0, Math.max(10, f * df1 * 4), { ...EXACT, extendInt: "downX" }).root;
}

/** The effect size with its interval (on the eta-squared scale of the F value it implies) on df and dfe */
function withInterval(es: number, df: number, dfe: number, ci: number, alt: Alternative): number[] {
  const level = alt === "two.sided" ? ci : 2 * ci - 1;
  const e = Math.max(0, es);
  const f = e / df / ((1 - e) / dfe);
  let lo = ncpOfF(f, df, dfe, (1 + level) / 2);
  let hi = ncpOfF(f, df, dfe, (1 - level) / 2);
  if (f <= (qf((1 - level) / 2, df, dfe) as number)) hi = 0;
  if (f <= (qf((1 + level) / 2, df, dfe) as number)) lo = 0;
  let ciLow = lo === Infinity ? 1 : lo / (lo + dfe);
  let ciHigh = hi === Infinity ? 1 : hi / (hi + dfe);
  if (alt === "less") ciLow = 0;
  if (alt === "greater") ciHigh = 1;
  return [es, ci, ciLow, ciHigh];
}

const NEEDS = "needs a table of anova() or Anova(), a fit from lm() or aov() with a formula, its aovSummary(), or a result of aovEz()";

function anovaEffectSize(model: AnovaEffectSizeModel, kind: Kind, options: EtaSquaredOptions): AnovaEffectSizeTable {
  if (typeof model !== "object" || model === null) throw new TypeError(NEEDS);
  if (isStrataFit(model) || isStrataSummary(model) || isEz(model)) return strataEffectSize(model, kind, options);
  const tab = isFit(model) ? anova(model) : model;
  if (!Array.isArray(tab.colNames) || !Array.isArray(tab.table)) throw new TypeError(NEEDS);
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
  const { isObserved, ssObserved } = observedTerms(gen, terms);

  const value = (t: Term): number => {
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
  return {
    colNames: ci === null ? [column] : [column, "CI", "CI_low", "CI_high"],
    rowNames: terms.map((t) => t.name),
    table: terms.map((t) => (ci === null ? [value(t)] : withInterval(value(t), t.df, dfe, ci, alt))),
    warnings: [],
  };
}

/**
 * The effect sizes of a model with error strata: each term measured against the residual of its own stratum, the
 * totals over all strata, and the subject stratum's residual in every partial omega squared
 */
function strataEffectSize(model: StrataModel, kind: Kind, options: EtaSquaredOptions): AnovaEffectSizeTable {
  const ci = options.ci === undefined ? 0.95 : options.ci;
  const alt = matchChoice(options.alternative ?? "greater", ["two.sided", "less", "greater"] as const);
  const ez = isEz(model);
  let strata: Stratum[];
  let subject: Stratum;
  let rows: { term: Term; stratum: Stratum }[];
  if (ez) {
    const s = ezStrata(model);
    ({ strata, subject } = s);
    rows = s.order.map((term) => ({ term, stratum: s.strata.find((st) => st.terms.includes(term))! }));
  } else {
    ({ strata, subject } = summaryStrata(isStrataFit(model) ? aovSummary(model) : model));
    rows = strata.flatMap((stratum) => stratum.terms.map((term) => ({ term, stratum })));
  }
  const allTerms = strata.flatMap((st) => st.terms);
  const sseAll = strata.reduce((a, st) => a + st.sse, 0);
  const ssTot = allTerms.reduce((a, t) => a + t.ss, 0) + sseAll;
  const mseSubject = subject.sse / subject.dfe;

  const gen = kind === "Eta2" ? (options.generalized ?? false) : false;
  const mode: "partial" | "plain" | "generalized" = gen !== false ? "generalized" : (options.partial ?? true) ? "partial" : "plain";
  const { isObserved, ssObserved } = observedTerms(gen, allTerms);

  const value = (t: Term, st: Stratum): number => {
    const { ss, df } = t;
    const mse = st.sse / st.dfe;
    if (kind === "Eta2") {
      if (mode === "partial") return ss / (ss + st.sse);
      if (mode === "plain") return ss / ssTot;
      return ss / (ss + sseAll + ssObserved - (isObserved(t.name) ? ss : 0));
    }
    if (kind === "Omega2") {
      const w = st === subject ? 0 : 1;
      const v =
        mode === "partial" ? (ss - df * mse) / (ss + w * st.sse + subject.sse + mseSubject) : (ss - df * mse) / (ssTot + mseSubject);
      return Math.max(0, v);
    }
    const v = mode === "partial" ? (ss - df * mse) / (ss + st.sse) : (ss - df * mse) / ssTot;
    return Math.max(0, v);
  };
  const column = `${kind}${mode === "plain" ? "" : `_${mode}`}`;
  const out: AnovaEffectSizeTable = {
    colNames: ci === null ? [column] : [column, "CI", "CI_low", "CI_high"],
    rowNames: rows.map((r) => r.term.name),
    table: rows.map(({ term, stratum }) => {
      const es = value(term, stratum);
      return ci === null ? [es] : withInterval(es, term.df, stratum.dfe, ci, alt);
    }),
    warnings: [],
  };
  if (!ez) out.groups = rows.map((r) => r.stratum.name);
  return out;
}

/**
 * Eta squared of the terms of an analysis-of-variance table (partial by default, or generalized), with confidence
 * intervals from the noncentral F distribution. Equivalent to effectsize's `eta_squared()` for a table of
 * `anova()` or `Anova()`; a fit from `lm()` with a formula is replaced by its `anova()` table.
 *
 * Repeated measures: for a fit of `aov()` with an `Error()` term (or its {@link aovSummary}) each term is measured
 * against the residual of its error stratum, the totals add up all strata, and the result has the stratum of each
 * row in `groups`; for a result of {@link aovEz}, the same from car's univariate tests (rows as afex's table).
 *
 * @example
 * ```ts
 * etaSquared(anova(lm("y ~ g", data))).colNames; // ["Eta2", "CI", "CI_low", "CI_high"]
 * etaSquared(aov("y ~ W + Error(id/W)", long)).groups; // ["id:W"]
 * ```
 */
export function etaSquared(model: AnovaEffectSizeModel, options: EtaSquaredOptions = {}): AnovaEffectSizeTable {
  return anovaEffectSize(model, "Eta2", options);
}

/**
 * Omega squared of the terms of an analysis-of-variance table, also of repeated-measures designs (see
 * {@link etaSquared}). Equivalent to effectsize's `omega_squared()`.
 */
export function omegaSquared(model: AnovaEffectSizeModel, options: AnovaEffectSizeOptions = {}): AnovaEffectSizeTable {
  return anovaEffectSize(model, "Omega2", options);
}

/**
 * Epsilon squared of the terms of an analysis-of-variance table, also of repeated-measures designs (see
 * {@link etaSquared}). Equivalent to effectsize's `epsilon_squared()`.
 */
export function epsilonSquared(model: AnovaEffectSizeModel, options: AnovaEffectSizeOptions = {}): AnovaEffectSizeTable {
  return anovaEffectSize(model, "Epsilon2", options);
}
