import { Warnings } from "./glmFamily.js";
import { type LmerResult } from "./lmer.js";
import type { MixedModelStructure } from "./mixedStructure.js";
/**
 * The Satterthwaite quantities of a fit (internal): the variance parameters varpar = (θ, σ), the Hessian H of the
 * deviance in them with its eigenvalues, their asymptotic covariance A = 2 H⁺ (lmerTest's `vcov_varpar`), the fixed
 * effects β̂ with their covariance V = C(varpar) and its Jacobians J_k = ∂C/∂varpar_k, and the warnings of the Hessian.
 */
export interface LmerSatterthwaite {
    varpar: number[];
    hessian: number[][];
    hessianEigenvalues: number[];
    vcovVarpar: number[][];
    beta: number[];
    sigma: number;
    vcov: number[][];
    jacobian: number[][][];
    warnings: string[];
}
/** The warnings about the Hessian's eigenvalues (negative, or close to 0; internal) */
export declare function hessianWarnings(values: readonly number[]): string[];
/**
 * The Satterthwaite quantities of a fit by {@link lmer} (see {@link LmerSatterthwaite}), computed once per fit.
 * Internal: the summary, the contrasts and the ANOVA tables use it.
 */
export declare function lmerSatterthwaite(fit: LmerResult): LmerSatterthwaite;
/**
 * The Satterthwaite quantities at any θ (σ from the penalised residual sum of squares there), `beta0` added to the
 * fixed effects (those of a fit's structure, whose response is y − X β₀). Internal: the test evaluates them at lme4's
 * optimum too, to compare with lmerTest's numerical derivatives at the same point.
 */
export declare function satterthwaiteAt(structure: MixedModelStructure, theta: readonly number[], reml: boolean, beta0?: readonly number[]): LmerSatterthwaite;
/** The one-dimensional test of a contrast l (internal) */
export interface TRow {
    estimate: number;
    stdError: number;
    df: number;
    tValue: number;
    pValue: number;
}
/** l'β̂ − rhs over its standard error, with Satterthwaite's degrees of freedom 2 var² / (g'Ag), g_k = l'J_k l */
export declare function tTestOf(s: LmerSatterthwaite, l: readonly number[], rhs: number, beta?: readonly number[]): TRow;
/** One row of an F table (internal): lmerTest's `Sum Sq`, `Mean Sq`, `NumDF`, `DenDF`, `F value`, `Pr(>F)` */
export interface LmerFRow {
    sumSq: number;
    meanSq: number;
    numDF: number;
    denDF: number;
    F: number;
    pValue: number;
}
/**
 * The joint F-test of the rows of L (r × p) with Satterthwaite's denominator degrees of freedom (internal; the ANOVA
 * tables use it): undefined when the rows have rank 0 (no test). `rhs` has one value per row (default 0); a non-zero
 * right-hand side with a rank-deficient L adds the warning to `warnings`.
 */
export declare function lmerFTest(fit: LmerResult, L: readonly (readonly number[])[], rhs: readonly number[] | undefined, warnings: Warnings): LmerFRow | undefined;
/** {@link lmerFTest} with the Satterthwaite quantities given (internal) */
export declare function fTestOf(s: LmerSatterthwaite, L: readonly (readonly number[])[], rhs: readonly number[] | undefined, warnings: Warnings): LmerFRow | undefined;
/**
 * Options of {@link lmerSummary}. Any other key is the TypeError `unused argument (<key>)` (R's lmerTest ignores
 * unknown arguments with a warning).
 *
 * @category Mixed models
 */
export interface LmerSummaryOptions {
    /**
     * The denominator degrees of freedom: `"Satterthwaite"` (default; with df and p-values) or `"lme4"` (lme4's table:
     * estimates, standard errors and t values only).
     */
    ddf?: "Satterthwaite" | "lme4";
}
/**
 * Result of {@link lmerSummary}: the coefficient table of lmerTest's `summary()`.
 *
 * @category Mixed models
 */
export interface LmerSummary {
    /** The method of the degrees of freedom. */
    ddf: "Satterthwaite" | "lme4";
    /** The names of the fixed effects (R's row names). */
    names: string[];
    /** Estimates (R's `Estimate`). */
    estimate: number[];
    /** Standard errors (R's `Std. Error`). */
    stdError: number[];
    /** Satterthwaite's degrees of freedom (R's `df`; not with `ddf: "lme4"`). */
    df?: number[];
    /** t statistics (R's `t value`). */
    tValue: number[];
    /** Two-sided p-values (R's `Pr(>|t|)`; not with `ddf: "lme4"`). */
    pValue?: number[];
    /** R's messages (none so far). */
    messages: string[];
    /** R's warnings: those about the eigenvalues of the Hessian of the deviance in the variance parameters. */
    warnings: string[];
}
/**
 * The coefficient table of a linear mixed model fitted by {@link lmer}, with Satterthwaite's degrees of freedom and
 * the p-values of the t-tests: the `summary()` of a fit by lmerTest. Equivalent to `lmerTest::summary()` in R.
 *
 * The degrees of freedom of each coefficient are Satterthwaite's: 2 var² / (g'Ag), with var its variance, g its
 * derivative in the variance parameters (θ, σ) and A their asymptotic covariance (twice the inverse Hessian of the
 * deviance). The derivatives are computed analytically at the exact optimum (lmerTest differentiates numerically at
 * lme4's optimum, so its degrees of freedom typically differ in the 5th to 8th significant digit). With
 * `ddf: "lme4"` the table is lme4's (as `coefTable` of the fit), without degrees of freedom and p-values.
 *
 * @param fit A result of {@link lmer} (the object it returned, not a copy).
 * @param options `ddf`: `"Satterthwaite"` (default) or `"lme4"`.
 *
 * @example
 * ```ts
 * // R: summary(lmerTest::lmer(y ~ x + (1 | g), data))
 * const fit = lmer("y ~ x + (1 | g)", {
 *   y: [3.1, 4.0, 5.2, 6.8, 7.1, 8.3, 2.2, 3.5, 3.9, 5.9, 6.1, 7.4],
 *   x: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3],
 *   g: ["a", "a", "a", "b", "b", "b", "c", "c", "c", "d", "d", "d"],
 * });
 * const s = lmerSummary(fit);
 * s.names;  // ["(Intercept)", "x"]
 * s.df;     // [3.2717, 7]
 * s.pValue; // [0.032598, 7.9895e-5]
 * ```
 *
 * @category Mixed models
 */
export declare function lmerSummary(fit: LmerResult, options?: LmerSummaryOptions): LmerSummary;
/**
 * Options of {@link lmerContest}. R's `collect`, `checkEstimability`, `check_estimability` and `ddf` give the Error
 * `lmerContest: argument '<key>' is not supported`, any other key the TypeError `unused argument (<key>)`.
 *
 * @category Mixed models
 */
export interface LmerContestOptions {
    /** The right-hand side of the hypothesis L β = rhs: one value, or one per row of L (default 0). */
    rhs?: number | readonly number[];
    /**
     * Test the rows jointly with one F-test (default `true`), or each row with its own t-test (`false`). As in R's
     * conditions, a number is `false` for 0 and `true` otherwise; `null` and other values are TypeErrors.
     */
    joint?: boolean;
    /** With `joint: false`, whether to add the confidence intervals (default `true`; a logical value as `joint`). */
    confint?: boolean;
    /** The confidence level of the intervals (default 0.95). */
    level?: number;
}
/**
 * Result of {@link lmerContest} with `joint: true` (the default): one row of an F table, or none when the rows of L
 * have rank 0.
 *
 * @category Mixed models
 */
export interface LmerContestF {
    /** Whether the rows were tested jointly: always `true` here. */
    joint: true;
    /** R's `Sum Sq`: F σ² NumDF. */
    sumSq: number[];
    /** R's `Mean Sq`: F σ². */
    meanSq: number[];
    /** R's `NumDF`: the rank of the hypothesis. */
    numDF: number[];
    /** R's `DenDF`: Satterthwaite's denominator degrees of freedom. */
    denDF: number[];
    /** R's `F value`. */
    F: number[];
    /** R's `Pr(>F)`. */
    pValue: number[];
    /** R's messages (none so far). */
    messages: string[];
    /** R's warnings (about the Hessian's eigenvalues; `Contrast is rank deficient and test may be affected`). */
    warnings: string[];
}
/**
 * Result of {@link lmerContest} with `joint: false`: one t-test per row of L.
 *
 * @category Mixed models
 */
export interface LmerContestT {
    /** Whether the rows were tested jointly: always `false` here. */
    joint: false;
    /** R's `Estimate`: l'β̂. */
    estimate: number[];
    /** R's `Std. Error`. */
    stdError: number[];
    /** R's `df`: Satterthwaite's degrees of freedom. */
    df: number[];
    /** R's `t value`: (estimate − rhs) / stdError. */
    tValue: number[];
    /** R's `Pr(>|t|)`. */
    pValue: number[];
    /** R's `lower`: the lower limit of the confidence interval of the estimate (unless `confint: false`). */
    lower?: number[];
    /** R's `upper`: the upper limit of the confidence interval (unless `confint: false`). */
    upper?: number[];
    /** R's messages (none so far). */
    messages: string[];
    /** R's warnings (about the Hessian's eigenvalues). */
    warnings: string[];
}
/**
 * Tests of contrasts L β = rhs of the fixed effects of a linear mixed model fitted by {@link lmer}, with Satterthwaite's
 * degrees of freedom. Equivalent to `lmerTest::contest()` in R.
 *
 * `L` is one contrast (a vector, one value per fixed effect) or several (an array of rows). By default the rows are
 * tested jointly: an F-test of the hypothesis, rotated to its eigenvectors (rows that are linearly dependent count
 * once; a row set of rank 0 gives an empty table). With `joint: false` each row has its own t-test, with a confidence
 * interval at `level` unless `confint` is false. The degrees of freedom come from the analytic derivatives at the exact
 * optimum (see {@link lmerSummary}).
 *
 * @param fit A result of {@link lmer} (the object it returned, not a copy).
 * @param L A contrast, or an array of contrasts (rows).
 * @param options `rhs`, `joint`, `confint`, `level`.
 *
 * @example
 * ```ts
 * // R: contest(lmerTest::lmer(y ~ x + (1 | g), data), c(0, 1), joint = FALSE)
 * const fit = lmer("y ~ x + (1 | g)", {
 *   y: [3.1, 4.0, 5.2, 6.8, 7.1, 8.3, 2.2, 3.5, 3.9, 5.9, 6.1, 7.4],
 *   x: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3],
 *   g: ["a", "a", "a", "b", "b", "b", "c", "c", "c", "d", "d", "d"],
 * });
 * const t = lmerContest(fit, [0, 1], { joint: false });
 * t.estimate; // [0.85]
 * t.lower;    // [0.60388]
 * // R: contest(fit, diag(2))
 * const f = lmerContest(fit, [[1, 0], [0, 1]]);
 * f.numDF; // [2]
 * f.F;     // [47.804]
 * ```
 *
 * @category Mixed models
 */
export declare function lmerContest(fit: LmerResult, L: readonly number[] | readonly (readonly number[])[], options?: LmerContestOptions & {
    joint?: true;
}): LmerContestF;
export declare function lmerContest(fit: LmerResult, L: readonly number[] | readonly (readonly number[])[], options: LmerContestOptions & {
    joint: false;
}): LmerContestT;
export declare function lmerContest(fit: LmerResult, L: readonly number[] | readonly (readonly number[])[], options?: LmerContestOptions): LmerContestF | LmerContestT;
