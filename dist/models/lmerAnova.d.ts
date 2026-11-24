import { Warnings } from "../internal/warnings.js";
import { type LmerResult } from "./lmer.js";
import { type HypothesisType, type LmerHypotheses } from "./lmerHypotheses.js";
import { type LmerFRow, type LmerSatterthwaite } from "./lmerTest.js";
import type { DataFrame } from "./modelFrame.js";
/**
 * Options of {@link lmerAnova} for one fit. R's `ddf` gives the Error `lmerAnova: argument 'ddf' is not supported`,
 * any other key a RangeError.
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
 * `lmerAnova: argument '<key>' is not supported`, any other key a RangeError.
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
/** The hypotheses of a fit's ANOVA table of the given type (internal; the test uses them at other points too) */
export declare function anovaHypotheses(fit: LmerResult, type: HypothesisType): {
    hypotheses: LmerHypotheses;
    termLabels: string[];
};
/** The rows of an ANOVA table from the hypotheses and given Satterthwaite quantities (internal) */
export declare function anovaRowsOf(s: LmerSatterthwaite, { hypotheses }: LmerHypotheses, termLabels: readonly string[], warnings: Warnings): {
    terms: string[];
    rows: LmerFRow[];
};
/**
 * A fit in a likelihood-ratio comparison (internal): of lmer, glmer (src/models/glmerAnova.ts) or glm, with what the
 * checks and the test of nesting need
 */
export interface ComparedModel {
    /** The number of observations (R's nobs: rows used, rows of prior weight 0 included) */
    nObs: number;
    /** The number of parameters (the fit's df) */
    df: number;
    /** The fit's log-likelihood */
    logLik: number;
    /** Whether it is an lmer fit by REML */
    reml: boolean;
    /** The log-likelihood of the maximum-likelihood refit (lmer REML fits) */
    refitLogLik?: () => number;
    /** For lmer and glmer fits: the data object, its snapshot, the rows used and the formula's left-hand side */
    mixed?: {
        data: DataFrame;
        snapshot: DataFrame;
        rows: readonly number[];
        response: string;
    };
    /** The response as the family reads it, one per row used (compared by value where a fit has no formula) */
    response: () => readonly number[];
    /** The prior weights, one per row used (all 1 for lmer) */
    weights: () => readonly number[];
    /** The family and link (lmer: gaussian, identity) */
    family: string;
    link: string;
    /** The offset, one per row used (all 0 without) */
    offset: () => readonly number[];
    /** The fixed-effects model matrix (array of rows) */
    x: () => readonly (readonly number[])[];
    /** The random-effects terms (grouping factor and columns; none for glm) */
    randomTerms: readonly {
        group: string;
        columns: readonly string[];
    }[];
}
/** The model of an lmer fit in a comparison (internal) */
export declare function comparedLmer(fit: LmerResult): ComparedModel;
/**
 * lme4's likelihood-ratio comparison of fits (internal; lmerAnova's and glmerAnova's): the checks that the fits are of
 * the same observations, the names, the ML refits of REML fits, the rows sorted by the number of parameters and the
 * test where the fit of the row before is nested in the row's. `fn` names the function in its error for fewer than
 * two fits.
 */
export declare function compareModels(fn: string, models: readonly ComparedModel[], options: LmerCompareOptions): LmerCompareTable;
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
export declare function lmerAnova(fit: LmerResult, options?: LmerAnovaOptions): LmerAnovaTable;
export declare function lmerAnova(fits: readonly LmerResult[], options?: LmerCompareOptions): LmerCompareTable;
