import { type GlmResult } from "./glm.js";
/**
 * Options for {@link glmConfint}.
 *
 * @category Generalized linear models
 */
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
 * columns, and for a limit that the profile does not reach), for a `glm` fit. Equivalent to R's `confint()`. With
 * the exact solutions of the profile equations, where R interpolates a spline through a grid of profile points (and
 * is up to about 5e-4 standard errors from them).
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * glmConfint(fit); // { lower: [-15.124, -0.065819], upper: [0.57792, 4.1592] }
 * ```
 *
 * @category Generalized linear models
 */
export declare function glmConfint(fit: GlmResult, options?: GlmConfintOptions): {
    /** Lower limits, one per coefficient (R's first column, `2.5 %` by default). */
    lower: number[];
    /** Upper limits, one per coefficient (R's second column, `97.5 %` by default). */
    upper: number[];
};
