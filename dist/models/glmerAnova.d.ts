import type { GlmResult } from "./glm.js";
import { type GlmerResult } from "./glmer.js";
import { type LmerResult } from "./lmer.js";
import { type LmerCompareOptions, type LmerCompareTable } from "./lmerAnova.js";
/**
 * Options of {@link glmerAnova} for one fit: there is none (R's `anova()` of one fit has none); any key is a
 * RangeError. For several fits the options are {@link LmerCompareOptions}.
 *
 * @category Mixed models
 */
export interface GlmerAnovaOptions {
}
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
export declare function glmerAnova(fit: GlmerResult, options?: GlmerAnovaOptions): GlmerAnovaTable;
export declare function glmerAnova(fits: readonly (GlmerResult | LmerResult | GlmResult)[], options?: LmerCompareOptions): LmerCompareTable;
