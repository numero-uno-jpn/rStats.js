// ANOVA tables of linear mixed models fitted by lmer (src/models/lmer.ts): lmerTest's Type I, II and III tables of one
// fit (each term's hypothesis tested jointly with Satterthwaite's denominator degrees of freedom), and lme4's
// likelihood-ratio comparison of several fits.
//
// Written for rStats.js (no ported code) from oracle/lmertest-behaviour.md (sections 2 and 3). The hypothesis
// matrices come from src/models/lmerHypotheses.ts, the F-tests from src/models/lmerTest.ts; the comparison refits REML
// fits by maximum likelihood with lmer's own minimiser (the exact ML optimum).

import { pgamma1 } from "../distributions/gamma.js";
import { Warnings } from "./glmFamily.js";
import { checkOptions, lmerInternals, lmerWithCriterion, logicalOption, type LmerResult } from "./lmer.js";
import { fixedEffectsDescription, lmerHypotheses, type HypothesisType, type LmerHypotheses } from "./lmerHypotheses.js";
import { fTestOf, lmerSatterthwaite, type LmerFRow, type LmerSatterthwaite } from "./lmerTest.js";

/**
 * Options of {@link lmerAnova} for one fit. R's `ddf` gives the Error `lmerAnova: argument 'ddf' is not supported`,
 * any other key the TypeError `unused argument (<key>)`.
 *
 * @category Mixed models
 */
export interface LmerAnovaOptions {
  /** The type of the sums of squares: `"III"` (default), `"II"` or `"I"` (also `3`, `2`, `1`). */
  type?: LmerAnovaType | 1 | 2 | 3;
}

/**
 * Result of {@link lmerAnova} for one fit: lmerTest's ANOVA table, one row per term of the fixed effects.
 *
 * @category Mixed models
 */
export interface LmerAnovaTable {
  /** The type of the sums of squares. */
  type: LmerAnovaType;
  /** The terms (R's row names), in the order of the formula's terms; terms without a test come last. */
  terms: string[];
  /** R's `Sum Sq`: F σ² NumDF. */
  sumSq: number[];
  /** R's `Mean Sq`: F σ². */
  meanSq: number[];
  /** R's `NumDF`. */
  numDF: number[];
  /** R's `DenDF`: Satterthwaite's denominator degrees of freedom. */
  denDF: number[];
  /** R's `F value`. */
  F: number[];
  /** R's `Pr(>F)`. */
  pValue: number[];
  /** R's messages (Type III: `Missing cells for: ...`). */
  messages: string[];
  /** R's warnings (about the eigenvalues of the Hessian of the deviance in the variance parameters). */
  warnings: string[];
}

/**
 * Options of {@link lmerAnova} for several fits. R's `modelNames` and `model.names` give the Error
 * `lmerAnova: argument '<key>' is not supported`, any other key the TypeError `unused argument (<key>)`.
 *
 * @category Mixed models
 */
export interface LmerCompareOptions {
  /**
   * Refit the REML fits by maximum likelihood before comparing them (default `true`). As in R's conditions, a number
   * is `false` for 0 and `true` otherwise; `null` and other values are TypeErrors.
   */
  refit?: boolean;
  /** The names of the models, in the order given (default `"MODEL1"`, `"MODEL2"`, ...). */
  names?: readonly string[];
}

/**
 * Result of {@link lmerAnova} for several fits: lme4's comparison table, one row per model, sorted by the number of
 * parameters.
 *
 * @category Mixed models
 */
export interface LmerCompareTable {
  /** The models' names (R's row names), in the order of the rows. */
  names: string[];
  /** The number of parameters of each model (fixed effects, θ and σ). */
  npar: number[];
  /** Akaike's information criterion, −2 logLik + 2 npar. */
  AIC: number[];
  /** Schwarz's criterion, −2 logLik + log(n) npar. */
  BIC: number[];
  /** The log-likelihood (of the ML refit, or the fit's own with `refit: false`). */
  logLik: number[];
  /** −2 logLik (R's `-2*log(L)`). */
  deviance: number[];
  /** The likelihood-ratio statistic against the row before (NaN in the first row). */
  Chisq: number[];
  /** The difference of npar from the row before (NaN in the first row). */
  Df: number[];
  /** R's `Pr(>Chisq)` (NaN in the first row and where Df is 0). */
  pValue: number[];
  /** R's messages (`refitting model(s) with ML (instead of REML)`). */
  messages: string[];
  /** R's warnings (duplicated names, a mix of REML and ML fits without refitting). */
  warnings: string[];
}

/**
 * The type of the sums of squares of an ANOVA table of {@link lmerAnova}.
 *
 * @category Mixed models
 */
export type LmerAnovaType = "I" | "II" | "III";

const TYPES: Record<string, LmerAnovaType> = { I: "I", II: "II", III: "III", 1: "I", 2: "II", 3: "III" };

/** The hypotheses of a fit's ANOVA table of the given type (internal; the test uses them at other points too) */
export function anovaHypotheses(fit: LmerResult, type: HypothesisType): { hypotheses: LmerHypotheses; termLabels: string[] } {
  const { structure, data, options } = lmerInternals(fit);
  const descOptions: Parameters<typeof fixedEffectsDescription>[2] = {};
  if (options.contrasts !== undefined) descOptions.contrasts = options.contrasts;
  if (options.levels !== undefined) descOptions.levels = options.levels;
  const desc = fixedEffectsDescription(fit.formula, data, descOptions);
  if (desc.colNames.length !== structure.xColNames.length || desc.colNames.some((c, j) => c !== structure.xColNames[j])) {
    throw new Error("lmerAnova: the columns of the hypotheses differ from the fit's fixed effects");
  }
  // an intercept-only model (or one without fixed effects) has an empty table
  if (desc.terms.length === 0) return { hypotheses: { hypotheses: [], messages: [] }, termLabels: [] };
  return { hypotheses: lmerHypotheses(desc, type), termLabels: desc.terms.map((t) => t.label) };
}

/** The rows of an ANOVA table from the hypotheses and given Satterthwaite quantities (internal) */
export function anovaRowsOf(
  s: LmerSatterthwaite,
  { hypotheses }: LmerHypotheses,
  termLabels: readonly string[],
  warnings: Warnings,
): { terms: string[]; rows: LmerFRow[] } {
  const terms: string[] = [];
  const rows: LmerFRow[] = [];
  for (const h of hypotheses) {
    const row = h.values.length === 0 ? undefined : fTestOf(s, h.values, undefined, warnings);
    if (row === undefined) continue;
    terms.push(h.term);
    rows.push(row);
  }
  for (const label of termLabels) {
    if (terms.includes(label)) continue;
    terms.push(label);
    rows.push({ sumSq: NaN, meanSq: NaN, numDF: NaN, denDF: NaN, F: NaN, pValue: NaN });
  }
  return { terms, rows };
}

function anovaOfFit(fit: LmerResult, options: LmerAnovaOptions): LmerAnovaTable {
  const type = TYPES[String(options.type ?? "III")];
  if (type === undefined) throw new RangeError(`type must be "I", "II" or "III", not ${JSON.stringify(options.type)}`);
  const { hypotheses, termLabels } = anovaHypotheses(fit, type);
  const s = lmerSatterthwaite(fit);
  const warnings = new Warnings();
  s.warnings.forEach((w) => warnings.add(w));
  const { terms, rows } = anovaRowsOf(s, hypotheses, termLabels, warnings);
  const column = (k: keyof LmerFRow): number[] => rows.map((r) => r[k]);
  return {
    type,
    terms,
    sumSq: column("sumSq"),
    meanSq: column("meanSq"),
    numDF: column("numDF"),
    denDF: column("denDF"),
    F: column("F"),
    pValue: column("pValue"),
    messages: [...hypotheses.messages],
    warnings: warnings.list,
  };
}

function compareFits(fits: readonly LmerResult[], options: LmerCompareOptions): LmerCompareTable {
  if (fits.length < 2) throw new TypeError("lmerAnova needs one fit, or an array of at least two fits to compare");
  const internals = fits.map(lmerInternals);
  if (fits.some((f) => f.nObs !== fits[0]!.nObs)) throw new Error("models were not all fitted to the same size of dataset");
  if (internals.some((i) => i.data !== internals[0]!.data)) throw new Error("all models must be fit to the same data object");
  const warnings = new Warnings();
  const messages: string[] = [];
  let names = fits.map((_, i) => `MODEL${i + 1}`);
  if (options.names !== undefined) {
    if (options.names.length !== fits.length || options.names.some((n) => typeof n !== "string")) {
      throw new TypeError(`names must be ${fits.length} strings, one per fit`);
    }
    if (new Set(options.names).size === options.names.length) names = [...options.names];
    else warnings.add("failed to find model names, assigning generic names");
  }
  const refit = logicalOption(options.refit, true);
  let logLik: number[];
  if (refit) {
    if (fits.some((f) => f.REML)) messages.push("refitting model(s) with ML (instead of REML)");
    logLik = fits.map((f, i) => {
      if (!f.REML) return f.logLik;
      const { data, options: o, criterion } = internals[i]!;
      return lmerWithCriterion(f.formula, data, { ...o, REML: false }, criterion).logLik;
    });
  } else {
    if (fits.some((f) => f.REML) && fits.some((f) => !f.REML)) warnings.add("some models fit with REML = TRUE, some not");
    logLik = fits.map((f) => f.logLik);
  }
  // sorted by the number of parameters (stable)
  const order = fits.map((_, i) => i).sort((a, b) => fits[a]!.df - fits[b]!.df || a - b);
  const n = fits[0]!.nObs;
  const npar = order.map((i) => fits[i]!.df);
  const ll = order.map((i) => logLik[i]!);
  const Chisq = ll.map((v, k) => (k === 0 ? NaN : 2 * Math.max(0, v - ll[k - 1]!)));
  const Df = npar.map((v, k) => (k === 0 ? NaN : v - npar[k - 1]!));
  const pValue = Chisq.map((x, k) => (k === 0 || Df[k] === 0 ? NaN : pgamma1(x, Df[k]! / 2, 2, false, false)));
  return {
    names: order.map((i) => names[i]!),
    npar,
    AIC: ll.map((v, k) => -2 * v + 2 * npar[k]!),
    BIC: ll.map((v, k) => -2 * v + Math.log(n) * npar[k]!),
    logLik: ll,
    deviance: ll.map((v) => -2 * v),
    Chisq,
    Df,
    pValue,
    messages,
    warnings: warnings.list,
  };
}

/**
 * The ANOVA table of a linear mixed model fitted by {@link lmer}, with Satterthwaite's denominator degrees of freedom
 * (lmerTest's `anova()`), or, given an array of fits, the likelihood-ratio comparison of the models (lme4's
 * `anova()` of several fits). Equivalent to `lmerTest::anova()` in R.
 *
 * For one fit: each term of the fixed effects is tested jointly (an F-test of its hypothesis matrix, of Type III by
 * default, II or I as in lmerTest; see {@link lmerContest} for the test). Type III with an empty cell of an
 * interaction gives the message `Missing cells for: ...`. A term without a test is listed last, with NaN.
 *
 * For several fits (fitted to the same data object, with the same rows): REML fits are first refitted by maximum
 * likelihood (unless `refit: false`), the models are sorted by their number of parameters, and each is compared with
 * the one before by the likelihood-ratio test.
 *
 * @param fit A result of {@link lmer} (the object it returned, not a copy), or an array of at least two.
 * @param options For one fit `type`; for several `refit` and `names`.
 *
 * @example
 * ```ts
 * // R: anova(lmerTest::lmer(y ~ x * f + (1 | g), data))
 * const data = {
 *   y: [3.1, 4.0, 5.2, 6.8, 7.1, 8.3, 2.2, 3.5, 3.9, 5.9, 6.1, 7.4, 4.4, 5.0, 6.9, 3.0, 4.1, 4.9],
 *   x: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3],
 *   f: ["u", "u", "v", "v", "u", "v", "u", "v", "v", "u", "v", "u", "v", "u", "u", "v", "u", "v"],
 *   g: ["a", "a", "a", "b", "b", "b", "c", "c", "c", "d", "d", "d", "e", "e", "e", "f", "f", "f"],
 * };
 * const fit = lmer("y ~ x * f + (1 | g)", data);
 * const t = lmerAnova(fit);
 * t.terms; // ["x", "f", "x:f"]
 * t.numDF; // [1, 1, 1]
 * t.F;     // [82.027, 0.44207, 0.53285]
 * // R: anova(lme4::lmer(y ~ x + (1 | g), data), fit)
 * const c = lmerAnova([lmer("y ~ x + (1 | g)", data), fit], { names: ["small", "full"] });
 * c.npar;     // [4, 6]
 * c.Chisq;    // [NaN, 0.6817]
 * c.messages; // ["refitting model(s) with ML (instead of REML)"]
 * ```
 *
 * @category Mixed models
 */
export function lmerAnova(fit: LmerResult, options?: LmerAnovaOptions): LmerAnovaTable;
export function lmerAnova(fits: readonly LmerResult[], options?: LmerCompareOptions): LmerCompareTable;
export function lmerAnova(
  fit: LmerResult | readonly LmerResult[],
  options?: LmerAnovaOptions | LmerCompareOptions,
): LmerAnovaTable | LmerCompareTable {
  if (Array.isArray(fit)) {
    const checked = checkOptions<LmerCompareOptions>("lmerAnova", options as LmerCompareOptions | undefined, ["refit", "names"], ["modelNames", "model.names"]);
    // (the logical value is checked with the options, before the fits)
    return compareFits(fit, { ...checked, refit: logicalOption(checked.refit, true) });
  }
  return anovaOfFit(fit as LmerResult, checkOptions<LmerAnovaOptions>("lmerAnova", options as LmerAnovaOptions | undefined, ["type"], ["ddf"]));
}
