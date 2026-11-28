import type { LmResult } from "./lm.js";
/**
 * The leverages (the diagonal of the hat matrix) of a linear model, one per row of non-zero weight. Equivalent to R's
 * `hatvalues()`. For an `lm` fit.
 *
 * @example
 * ```ts
 * const fit = lm([1, 2, 3, 4, 10], [1.1, 1.9, 3.2, 3.9, 7]);
 * lmHatvalues(fit); // the last point has the largest leverage
 * ```
 *
 * @category Linear models and ANOVA
 */
export declare function lmHatvalues(fit: LmResult): number[];
/**
 * Options for {@link lmRstandard}.
 *
 * @category Linear models and ANOVA
 */
export interface LmRstandardOptions {
    /**
     * `"sd.1"` (default): the internally studentized residuals r / (s sqrt(1 - h)); `"predictive"`: the leave-one-out
     * prediction errors r / (1 - h) (r the residual times the square root of the weight) (as R's `type`).
     */
    type?: "sd.1" | "predictive";
}
/**
 * The standardized residuals of a linear model, one per row of non-zero weight. Equivalent to R's `rstandard()`. For
 * an `lm` fit; NaN for a row of leverage 1.
 *
 * @example
 * ```ts
 * lmRstandard(lm([1, 2, 3, 4, 10], [1.1, 1.9, 3.2, 3.9, 7]));
 * ```
 *
 * @throws RangeError for an unknown `type`.
 * @category Linear models and ANOVA
 */
export declare function lmRstandard(fit: LmResult, options?: LmRstandardOptions): number[];
/**
 * The externally studentized residuals of a linear model (each scaled by the residual standard error of the fit
 * without that row), one per row of non-zero weight. Equivalent to R's `rstudent()`. For an `lm` fit; NaN for a row of
 * leverage 1, and where the deleted fit has no residual degrees of freedom.
 *
 * @example
 * ```ts
 * lmRstudent(lm([1, 2, 3, 4, 10], [1.1, 1.9, 3.2, 3.9, 7]));
 * ```
 *
 * @category Linear models and ANOVA
 */
export declare function lmRstudent(fit: LmResult): number[];
/**
 * Cook's distances of a linear model, one per row of non-zero weight. Equivalent to R's `cooks.distance()`. For an
 * `lm` fit; NaN for a row of leverage 1.
 *
 * @example
 * ```ts
 * lmCooksDistance(lm([1, 2, 3, 4, 10], [1.1, 1.9, 3.2, 3.9, 7]));
 * ```
 *
 * @category Linear models and ANOVA
 */
export declare function lmCooksDistance(fit: LmResult): number[];
