import { type CorMethod } from "../htest/cor.js";
import type { Sample } from "../htest/types.js";
export type { CorMethod };
/**
 * Handling of missing values, as R's `use`.
 *
 * @category Descriptive statistics
 */
export type CorUse = "everything" | "all.obs" | "complete.obs" | "na.or.complete" | "pairwise.complete.obs";
/**
 * Options for {@link cov} and {@link cor}.
 *
 * @category Descriptive statistics
 */
export interface CovOptions {
    /** Default `"pearson"`. Unambiguous abbreviations are accepted. */
    method?: CorMethod | (string & {});
    /** Default `"everything"`. Unambiguous abbreviations are accepted. */
    use?: CorUse | (string & {});
}
/**
 * Covariance of two vectors, or covariance matrix of the columns of a matrix (or between the columns of `x` and `y`).
 * Equivalent to R's `cov()`.
 *
 * @example
 * ```ts
 * cov([1, 2, 3, 4], [2, 4, 5, 9]);       // 3.6666666666666665
 * cov([[1, 2], [2, 4], [3, 5], [4, 9]]); // [[1.6666666666666667, 3.6666666666666665], [3.6666666666666665, 8.666666666666666]]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function cov(x: Sample, y: Sample, options?: CovOptions): number;
export declare function cov(x: Sample | readonly (readonly number[])[], y?: Sample | readonly (readonly number[])[], options?: CovOptions): number | number[][];
/**
 * Correlation of two vectors, or correlation matrix of the columns of a matrix (or between the columns of `x` and
 * `y`). Equivalent to R's `cor()`. Pearson correlations are computed in double-double, so they can be slightly more
 * accurate than R's (exactly 1 for perfectly correlated data).
 *
 * @example
 * ```ts
 * cor([1, 2, 3, 4], [2, 4, 5, 9]);                         // 0.9647638212377322
 * cor([1, 2, 3, 4], [2, 4, 5, 9], { method: "spearman" }); // 1
 * ```
 *
 * @category Descriptive statistics
 */
export declare function cor(x: Sample, y: Sample, options?: CovOptions): number;
export declare function cor(x: Sample | readonly (readonly number[])[], y?: Sample | readonly (readonly number[])[], options?: CovOptions): number | number[][];
