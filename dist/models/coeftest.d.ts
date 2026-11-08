import { type RobustFit, type VcovResult } from "./sandwich.js";
/**
 * The covariance matrix given to {@link coeftest} and {@link coefci}: a matrix (array of rows), the result of
 * {@link vcovHC} or {@link vcovCL}, or a function of the fit returning either (to pass options, close over them:
 * `(f) => vcovCL(f, { cluster })`).
 *
 * A result (with `names`) is matched to the coefficients by name: the coefficients whose names it has are kept, in the
 * fit's order. A matrix is matched by position: it must be p × p (p the number of coefficients) or k × k (k the number
 * of coefficients that are not aliased, which it then stands for).
 *
 * @category Linear models and ANOVA
 */
export type VcovArgument = readonly (readonly number[])[] | VcovResult | ((fit: RobustFit) => readonly (readonly number[])[] | VcovResult);
/**
 * Options for {@link coeftest}.
 *
 * @category Linear models and ANOVA
 */
export interface CoeftestOptions {
    /** The covariance of the coefficients. Default: the fit's own (R's `vcov(fit)`), with NaN for aliased coefficients. */
    vcov?: VcovArgument;
    /**
     * Degrees of freedom of the t tests. Default: the residual degrees of freedom for an lm fit and `Infinity` (z tests)
     * for a glm fit, of every family (lmtest's default; `glmSummary` uses t tests for the families with an estimated
     * dispersion). A value that is not positive and finite gives z tests.
     */
    df?: number;
}
/**
 * Result of {@link coeftest}: R's coefficient table with its attributes.
 *
 * @category Linear models and ANOVA
 */
export interface CoeftestResult {
    /** The coefficients kept (R's `Estimate`). */
    estimate: number[];
    /** Their standard errors (R's `Std. Error`). */
    stdError: number[];
    /** The t or z statistics. */
    statistic: number[];
    /** Two-sided p-values. */
    pValue: number[];
    /** The names of the coefficients kept (the table's row names). */
    names: string[];
    /** `"t value"` or `"z value"`. */
    statisticName: "t value" | "z value";
    /** The degrees of freedom: as given (or the default), also where z tests are used. */
    df: number;
    /** `"t test of coefficients"` or `"z test of coefficients"`. */
    method: string;
    /** The number of observations of the fit (rows of non-zero weight). */
    nobs: number;
    /** Warnings, including those of a covariance function called. */
    warnings: string[];
}
/**
 * Options for {@link coefci}.
 *
 * @category Linear models and ANOVA
 */
export interface CoefciOptions {
    /**
     * The coefficients: 0-based indices into the coefficients kept, in the order given, or names (the coefficients kept
     * whose names are among them, in their order; unknown names give no row). Default: all.
     */
    parm?: number | string | readonly number[] | readonly string[];
    /** Confidence level, in [0, 1]. Default `0.95`. */
    level?: number;
    /** See {@link CoeftestOptions}. */
    vcov?: VcovArgument;
    /** See {@link CoeftestOptions}. */
    df?: number;
}
/**
 * Result of {@link coefci}.
 *
 * @category Linear models and ANOVA
 */
export interface CoefciResult {
    /** Lower limits. */
    lower: number[];
    /** Upper limits. */
    upper: number[];
    /** The names of the coefficients (the row names). */
    names: string[];
    /** R's column names, such as `["2.5 %", "97.5 %"]`. */
    colNames: [string, string];
    /** Warnings, including those of a covariance function called. */
    warnings: string[];
}
/**
 * Tests of the coefficients of an `lm` or `glm` fit with a given covariance matrix. Equivalent to R's
 * `lmtest::coeftest()`.
 *
 * Each coefficient's estimate divided by its standard error (the square root of the covariance's diagonal), with a t
 * test on `df` degrees of freedom or a z test. The default `df` is the residual degrees of freedom of an lm and
 * `Infinity` (z tests) for a glm of every family, as lmtest (unlike `glmSummary`, which uses t tests where the
 * dispersion is estimated). A covariance whose diagonal has a negative, NaN or infinite variance is an error (R gives
 * NaN); only the diagonal is used (the matrix is not checked for symmetry, as R's). For a result of {@link vcovHC} or
 * {@link vcovCL} (or the fit's own covariance) the standard errors come from the covariance in units of powers of 2,
 * so they are right where the matrix holds Infinity or 0 (a response around 1e±300). That record belongs to the matrix
 * object returned: a copy of it (`vcov.map((r) => r.slice())`, `structuredClone`, JSON) loses it and gives the values
 * the copy holds (se 0, z Infinity and p 0 where it holds 0); pass the result or its original matrix instead.
 *
 * @param fit The result of {@link lm} or {@link glm}.
 *
 * @example
 * ```ts
 * const fit = lm([1, 2, 3, 4, 5, 6], [1.1, 2.3, 2.8, 4.5, 4.9, 6.4]);
 * const t = coeftest(fit, { vcov: (f) => vcovHC(f, { type: "HC1" }) });
 * t.stdError; // [0.17608, 0.049777]
 * t.pValue; // [0.72421, 0.0000324]
 * ```
 *
 * @category Linear models and ANOVA
 */
export declare function coeftest(fit: RobustFit, options?: CoeftestOptions): CoeftestResult;
/**
 * Confidence intervals of the coefficients of an `lm` or `glm` fit with a given covariance matrix. Equivalent to R's
 * `lmtest::coefci()`.
 *
 * The limits estimate ± q se with the t quantile on `df` degrees of freedom, or the normal quantile (by default for a
 * glm of every family, as lmtest). `parm` takes 0-based indices (R: 1-based) or names. The standard errors as in
 * {@link coeftest}: from the covariance in units of powers of 2 for a result of {@link vcovHC} or {@link vcovCL} or
 * its original matrix, not for a copy of the matrix (which gives intervals of width 0 where it holds 0).
 *
 * @param fit The result of {@link lm} or {@link glm}.
 *
 * @example
 * ```ts
 * const fit = lm([1, 2, 3, 4, 5, 6], [1.1, 2.3, 2.8, 4.5, 4.9, 6.4]);
 * const ci = coefci(fit, { vcov: (f) => vcovHC(f) });
 * ci.colNames; // ["2.5 %", "97.5 %"]
 * ci.lower; // [-0.51418, 0.84206]
 * ```
 *
 * @category Linear models and ANOVA
 */
export declare function coefci(fit: RobustFit, options?: CoefciOptions): CoefciResult;
