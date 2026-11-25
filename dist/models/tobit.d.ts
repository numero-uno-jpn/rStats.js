import { type DesignContrast } from "./modelMatrix.js";
import type { DataFrame } from "./modelFrame.js";
import { type SurvregDistribution, type SurvregResult, type SurvregControl } from "./survreg.js";
import type { Sample } from "../htest/types.js";
/**
 * Options for {@link tobit}.
 * @category Regression
 */
export interface TobitOptions {
    /** Left limit: responses at or below it are left censored at it (default 0; `-Infinity` for none). */
    left?: number;
    /** Right limit: responses at or above it are right censored at it (default `Infinity`, none). */
    right?: number;
    /**
     * The error distribution (survreg's): `"gaussian"` (default, the classical tobit model), `"logistic"`, `"t"`,
     * `"extreme"`, or one for positive responses (`"weibull"`, `"exponential"`, `"rayleigh"`, `"lognormal"` /
     * `"loggaussian"`, `"loglogistic"`), where the limits are on the scale of the response.
     */
    dist?: SurvregDistribution;
    /** Degrees of freedom of the t distribution (default 4, at least 3); `parms` is the same (give one). */
    df?: number;
    /** R's name for `df` (tobit and survreg take the degrees of freedom of the t distribution as `parms`). */
    parms?: number;
    /** Case weights, one per row of `data` (positive), or the name of a column of `data`. */
    weights?: Sample | string;
    /** A contrast per factor of the formula (default treatment contrasts). */
    contrasts?: Record<string, DesignContrast>;
    /** Iteration control, as {@link survreg}'s. */
    control?: SurvregControl;
}
/**
 * Result of {@link tobit}: {@link survreg}'s result with the coefficients named after the formula's terms, and the
 * censoring.
 * @category Regression
 */
export interface TobitResult extends SurvregResult {
    /** The formula. */
    formula: string;
    /** The left limit used. */
    left: number;
    /** The right limit used. */
    right: number;
    /** Observations: total, left censored, uncensored, right censored. */
    counts: TobitCounts;
}
/**
 * The censoring counts of a {@link tobit} fit.
 * @category Regression
 */
export interface TobitCounts {
    /** Observations used. */
    total: number;
    /** Left censored (at or below the left limit). */
    left: number;
    /** Uncensored. */
    uncensored: number;
    /** Right censored (at or above the right limit). */
    right: number;
}
/**
 * Tobit regression: a linear model for a response censored at a left and/or right limit, fitted by maximum likelihood
 * with {@link survreg} on the response clipped to [left, right]. Equivalent to R's `AER::tobit()`.
 *
 * A response at or below `left` is left censored at `left`, at or above `right` right censored at `right`. The
 * classical tobit model is the default (left censoring at 0, gaussian errors). `loglik` holds the log-likelihoods of
 * the intercept-only model and of the model (McFadden's R² is `1 - loglik[1] / loglik[0]`), and `chi`, `chiDf`, `chiP`
 * their likelihood-ratio test.
 * @example
 * ```ts
 * const fit = tobit("y ~ x", { y: [0, 0, 1.2, 0.4, 2.5, 0, 3.1, 1.8], x: [1, 2, 3, 2, 5, 1, 6, 4] });
 * fit.counts; // { total: 8, left: 3, uncensored: 5, right: 0 }
 * ```
 * @category Regression
 */
export declare function tobit(formula: string, data: DataFrame, options?: TobitOptions): TobitResult;
/**
 * Result of {@link tobitSummary}.
 * @category Regression
 */
export interface TobitSummaryResult {
    /** Row names of the table: the coefficients, then `Log(scale)` (when the scale is estimated). */
    names: string[];
    /** Estimates. */
    estimate: number[];
    /** Standard errors. */
    se: number[];
    /** Wald z statistics. */
    z: number[];
    /** Two-sided p-values. */
    p: number[];
    /** The scale. */
    scale: number;
    /** Log-likelihood of the model. */
    loglik: number;
    /** Its degrees of freedom (coefficients and scale). */
    df: number;
    /** Observations: total, left censored, uncensored, right censored. */
    counts: TobitCounts;
    /**
     * Wald test of the coefficients other than the intercept: `b' V⁻¹ b`, on the number of coefficients minus 1 degrees
     * of freedom (as R; without an intercept R tests all coefficients on one degree of freedom too few). `null` for the
     * intercept-only model.
     */
    wald: TobitWald | null;
    /** Iterations. */
    iter: number;
    /** The distribution. */
    dist: SurvregDistribution;
}
/**
 * The Wald test of {@link tobitSummary}.
 * @category Regression
 */
export interface TobitWald {
    /** `b' V⁻¹ b` over the coefficients other than the intercept. */
    statistic: number;
    /** Degrees of freedom: the number of coefficients minus 1. */
    df: number;
    /** Upper chi-squared tail probability. */
    p: number;
}
/**
 * Summary of a {@link tobit} fit: the Wald table with the scale and the Wald test of the regression. Equivalent to
 * `AER::summary.tobit()` in R.
 * @example
 * ```ts
 * const fit = tobit("y ~ x", { y: [0, 0, 1.2, 0.4, 2.5, 0, 3.1, 1.8], x: [1, 2, 3, 2, 5, 1, 6, 4] });
 * tobitSummary(fit).wald; // { statistic: 215.5, df: 1, p: 8.598e-49 }
 * ```
 * @category Regression
 */
export declare function tobitSummary(fit: TobitResult): TobitSummaryResult;
