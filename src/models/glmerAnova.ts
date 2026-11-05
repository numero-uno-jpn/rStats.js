// ANOVA of generalized linear mixed models fitted by glmer (src/models/glmer.ts): lme4's table of the fixed-effects
// terms of one fit (sequential Wald sums of squares from R_X), and lme4's likelihood-ratio comparison of several fits
// of glmer, lmer and glm.
//
// Written for rStats.js (no ported code) from oracle/glmer-behaviour.md ("glmerAnova (stage 3)" and "rStats.js's
// choices", G15). The comparison is lmerAnova's (src/models/lmerAnova.ts, compareModels), with the prior weights,
// the family, the link and the offset of each fit.

import { potf2 } from "../linalg/chol.js";
import { checkOptions } from "../internal/checkOptions.js";
import { reported } from "../internal/warnings.js";
import type { GlmResult } from "./glm.js";
import { glmerInternals, isGlmerFit, type GlmerResult } from "./glmer.js";
import { checkLmerOptions, logicalOption, type LmerResult } from "./lmer.js";
import { comparedLmer, compareModels, type ComparedModel, type LmerCompareOptions, type LmerCompareTable } from "./lmerAnova.js";

/**
 * Options of {@link glmerAnova} for one fit: there is none (R's `anova()` of one fit has none); any key is a
 * RangeError. For several fits the options are {@link LmerCompareOptions}.
 *
 * @category Mixed models
 */
export interface GlmerAnovaOptions {}

/**
 * Result of {@link glmerAnova} for one fit: lme4's table of the fixed-effects terms (sequential Wald statistics), one
 * row per term, without the intercept.
 *
 * @category Mixed models
 */
export interface GlmerAnovaTable {
  /** The terms (R's row names), in the order of the columns of the fixed-effects matrix, without `(Intercept)`. */
  terms: string[];
  /** R's `npar`: the term's number of columns (aliased columns dropped). */
  npar: number[];
  /** R's `Sum Sq`: the squared length of the term's part of R_X β̂ (R_X the Cholesky factor of R_X'R_X). */
  sumSq: number[];
  /** R's `Mean Sq`: Sum Sq / npar. */
  meanSq: number[];
  /** R's `F value`: Mean Sq / sigma² (Mean Sq for binomial and poisson). */
  F: number[];
  /** R's messages (none). */
  messages: string[];
  /** R's warnings (none). */
  warnings: string[];
}

/** The table of the fixed-effects terms of one fit */
function anovaOfFit(fit: GlmerResult): GlmerAnovaTable {
  const { structure: s, rxtrx, beta } = glmerInternals(fit);
  const p = beta.length;
  // R_X, the upper triangular Cholesky factor of R_X'R_X (column-major), and c = R_X β̂
  const data = new Float64Array(p * p);
  for (let j = 0; j < p; j++) for (let i = 0; i < p; i++) data[i + j * p] = rxtrx[i]![j]!;
  const failed = p > 0 && (data.some((v) => !Number.isFinite(v)) || potf2({ nrow: p, ncol: p, data }) > 0);
  const c = Array.from({ length: p }, (_, i) => {
    if (failed) return NaN;
    let sum = 0;
    for (let j = i; j < p; j++) sum += data[i + j * p]! * beta[j]!;
    return sum;
  });
  // one row per term with columns, in the order of the columns; the intercept (term 0) left out
  const terms: string[] = [];
  const npar: number[] = [];
  const sumSq: number[] = [];
  s.xAssign.forEach((term, j) => {
    if (term === 0) return;
    const label = s.xTermLabels[term - 1]!;
    if (terms[terms.length - 1] !== label) {
      terms.push(label);
      npar.push(0);
      sumSq.push(0);
    }
    npar[npar.length - 1]!++;
    sumSq[sumSq.length - 1]! += c[j]! ** 2;
  });
  const meanSq = sumSq.map((v, k) => v / npar[k]!);
  // (σ is 1 for binomial and poisson, so that F = Mean Sq there, as R's)
  const sigma2 = fit.sigma * fit.sigma;
  return { terms, npar, sumSq, meanSq, F: meanSq.map((v) => v / sigma2), messages: [], warnings: [] };
}

/** Whether an object looks like a result of glm (src/models/glm.ts; glm keeps no record of its results) */
function isGlmFit(fit: unknown): fit is GlmResult {
  if (typeof fit !== "object" || fit === null) return false;
  const f = fit as Partial<GlmResult>;
  return (
    typeof f.aic === "number" &&
    typeof f.rank === "number" &&
    typeof f.family === "string" &&
    typeof f.link === "string" &&
    Array.isArray(f.y) &&
    Array.isArray(f.priorWeights) &&
    typeof f.model === "object" &&
    f.model !== null &&
    Array.isArray(f.model.x) &&
    Array.isArray(f.model.offset)
  );
}

/** The model of a glmer fit in a comparison */
function comparedGlmer(fit: GlmerResult): ComparedModel {
  const { structure: s, data, snapshot } = glmerInternals(fit);
  return {
    nObs: fit.nObs,
    df: fit.df,
    // (G12: for nAGQ > 1 the log-likelihood with the saturated model's constant, so comparisons across nAGQ and with
    // glm are commensurate)
    logLik: fit.logLik,
    reml: false,
    mixed: { data, snapshot, rows: fit.rows, response: fit.formula.slice(0, fit.formula.indexOf("~")).replace(/\s+/g, "") },
    response: () => s.y,
    weights: () => s.weights,
    family: fit.family,
    link: fit.link,
    offset: () => s.offset,
    x: () => s.x,
    randomTerms: fit.varCorr,
  };
}

/** The model of a glm fit in a comparison: R's logLik.glm (df the rank, plus 1 for a family with a dispersion) */
function comparedGlm(fit: GlmResult): ComparedModel {
  const dispersion = fit.family === "gaussian" || fit.family === "Gamma" || fit.family === "inverse.gaussian";
  const df = fit.rank + (dispersion ? 1 : 0);
  return {
    nObs: fit.y.length,
    df,
    logLik: df - fit.aic / 2,
    reml: false,
    response: () => fit.y,
    weights: () => fit.priorWeights,
    family: fit.family,
    link: fit.link,
    offset: () => fit.model.offset,
    x: () => fit.model.x,
    randomTerms: [],
  };
}

/**
 * The ANOVA table of the fixed-effects terms of a generalized linear mixed model fitted by {@link glmer}, or, given an
 * array of fits, the likelihood-ratio comparison of the models. Equivalent to `lme4::anova()` in R.
 *
 * For one fit: for each term of the fixed effects (in the order of the columns, the intercept left out), the
 * sequential Wald sum of squares, the squared length of the term's part of R_X β̂ (R_X the Cholesky factor of
 * R_X'R_X at the conditional mode), its number of columns (`npar`), the mean square and F = mean square / σ² (σ = 1
 * for binomial and poisson). As in lme4, there are no p-values (the statistics need not be F distributed).
 *
 * For several fits: fits of {@link glmer}, {@link lmer} and {@link glm} together (at least one of glmer or lmer). The
 * glmer and lmer fits must be fitted to the same data object with the same rows and the same response (the left-hand
 * side of the formula); a glm fit must have the same number of observations and the same response values; all must
 * have the same prior weights. lmer's REML fits are refitted by maximum likelihood (unless `refit: false`); the models
 * are sorted by their number of parameters, and each is compared with the one before by the likelihood-ratio test
 * where that one is nested in it: the same family, link and offset (an lmer fit is gaussian with the identity link),
 * its fixed-effects columns in the column space of the larger fit's and its random-effects terms within the larger
 * fit's. Unlike R's, the log-likelihood of a glmer fit with `nAGQ > 1` includes the saturated model's constant (see
 * {@link glmer}), so that it can be compared with the Laplace fit and with glm.
 *
 * @param fit A result of {@link glmer} (the object it returned, not a copy), or an array of at least two fits of
 *   glmer, lmer and glm.
 * @param options For one fit none; for several `refit` and `names` (see {@link LmerCompareOptions}).
 *
 * @example
 * ```ts
 * // R: anova(lme4::glmer(y ~ x + f + (1 | g), data, family = binomial))
 * const data = {
 *   y: [0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1],
 *   x: [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6],
 *   f: ["u", "v", "u", "v", "u", "v", "v", "u", "v", "u", "v", "u", "u", "v", "u", "v", "u", "v", "v", "u", "v", "u", "v", "u"],
 *   g: ["a", "a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "b", "c", "c", "c", "c", "c", "c", "d", "d", "d", "d", "d", "d"],
 * };
 * const fit = glmer("y ~ x + f + (1 | g)", data, { family: "binomial" });
 * const t = glmerAnova(fit);
 * t.terms; // ["x", "f"]
 * t.npar;  // [1, 1]
 * t.F;     // [3.6704, 0.83614]
 * // R: anova(lme4::glmer(y ~ x + (1 | g), data, family = binomial), fit)
 * const c = glmerAnova([glmer("y ~ x + (1 | g)", data, { family: "binomial" }), fit]);
 * c.npar;  // [3, 4]
 * c.Chisq; // [NaN, 0.8673]
 * ```
 *
 * @category Mixed models
 */
export function glmerAnova(fit: GlmerResult, options?: GlmerAnovaOptions): GlmerAnovaTable;
export function glmerAnova(fits: readonly (GlmerResult | LmerResult | GlmResult)[], options?: LmerCompareOptions): LmerCompareTable;
export function glmerAnova(
  fit: GlmerResult | readonly (GlmerResult | LmerResult | GlmResult)[],
  options?: GlmerAnovaOptions | LmerCompareOptions,
): GlmerAnovaTable | LmerCompareTable {
  if (Array.isArray(fit)) {
    checkLmerOptions("glmerAnova", options, ["modelNames", "model.names"]);
    checkOptions(options, ["refit", "names"], "glmerAnova");
    const checked = (options ?? {}) as LmerCompareOptions;
    // (the logical value is checked with the options, before the fits)
    const refit = logicalOption(checked.refit, true);
    const fits = fit as readonly unknown[];
    if (fits.length < 2) throw new TypeError("glmerAnova needs one fit, or an array of at least two fits to compare");
    const models = fits.map((f) => {
      if (isGlmerFit(f)) return comparedGlmer(f);
      if (isGlmFit(f)) return comparedGlm(f);
      try {
        return comparedLmer(f as LmerResult);
      } catch (e) {
        if (e instanceof TypeError) throw new TypeError("each fit must be a result returned by glmer, lmer or glm (not a copy of one)");
        throw e;
      }
    });
    // (glm fits alone are glmAnova's)
    if (fits.every(isGlmFit)) throw new TypeError("glmerAnova needs at least one fit of glmer or lmer (glmAnova compares glm fits)");
    return reported("glmerAnova", compareModels("glmerAnova", models, { ...checked, refit }), ...fits);
  }
  checkLmerOptions("glmerAnova", options, []);
  checkOptions(options, [], "glmerAnova");
  return reported("glmerAnova", anovaOfFit(fit as GlmerResult), fit);
}
