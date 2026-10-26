import { type GlmResult } from "./glm.js";
/** Options for {@link glmConfint}. */
export interface GlmConfintOptions {
    /** Indices of the coefficients (0-based, intercept first). Default: all. */
    parm?: readonly number[];
    /** Confidence level. Default `0.95`. */
    level?: number;
    /** `"LRT"` (default; the likelihood ratio) or `"Rao"` (the score statistic). */
    test?: "LRT" | "Rao";
}
/**
 * Score statistic of residuals r with weights v regressed on the columns of x (rows of weight 0 left out): the
 * weighted sum of squares of r about its weighted mean (about 0 without intercept) minus the residual sum of squares.
 */
export declare function scoreStatistic(x: number[][], r: number[], v: number[], intercept: boolean, tol?: number): number;
/**
 * Profile likelihood confidence intervals for the coefficients of a generalized linear model (NaN for aliased
 * columns, and for a limit that the profile does not reach). Equivalent to R's `confint()` for a `glm` fit, but with
 * the exact solutions of the profile equations, where R interpolates a spline through a grid of profile points (and
 * is up to about 5e-4 standard errors from them).
 */
export declare function glmConfint(fit: GlmResult, options?: GlmConfintOptions): {
    lower: number[];
    upper: number[];
};
