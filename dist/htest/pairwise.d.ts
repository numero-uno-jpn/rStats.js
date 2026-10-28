import type { GroupLabel } from "./groups.js";
import { type PAdjustMethod } from "./pAdjust.js";
import { type Alternative, type Sample } from "./types.js";
import { type WilcoxTestOptions } from "./wilcoxTest.js";
/**
 * Result of the pairwise comparisons (R's `pairwise.htest`).
 *
 * @category Multiple comparisons
 */
export interface PairwiseResult {
    /** Description of the tests (R's `method`). */
    method: string;
    /**
     * Adjusted p-values as a lower-triangular table: row `r` compares group `rowNames[r]` with each group
     * `colNames[c]`; entries above the diagonal are `NaN`.
     */
    pValue: number[][];
    /** Labels of the rows (groups 2..k). */
    rowNames: string[];
    /** Labels of the columns (groups 1..k-1). */
    colNames: string[];
    /** Adjustment method. */
    pAdjustMethod: PAdjustMethod | string;
}
/**
 * Common options of the pairwise comparisons.
 *
 * @category Multiple comparisons
 */
export interface PairwiseOptions {
    /** p-value adjustment (see `pAdjust`). Default `"holm"`. */
    pAdjustMethod?: PAdjustMethod | (string & {});
    /** Alternative hypothesis for each comparison of row group against column group. Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
}
/**
 * Options for {@link pairwiseTTest}.
 *
 * @category Multiple comparisons
 */
export interface PairwiseTTestOptions extends PairwiseOptions {
    /** Pool the standard deviation over all groups. Default `!paired`. */
    poolSd?: boolean;
    /** Paired t tests (groups matched by position). Default `false`. */
    paired?: boolean;
}
/**
 * Pairwise t tests between groups, with adjusted p-values. Equivalent to R's `pairwise.t.test()`.
 *
 * @param x Response values.
 * @param g Group labels, parallel to `x`.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * pairwiseTTest(x, g).pValue; // [[0.029519264601117815, NaN], [0.0018407330776394456, 0.029519264601117815]]
 * ```
 *
 * @category Multiple comparisons
 */
export declare function pairwiseTTest(x: Sample, g: readonly GroupLabel[], options?: PairwiseTTestOptions): PairwiseResult;
/**
 * Options for {@link pairwiseWilcoxTest}: those of the comparisons themselves, as for `wilcoxTest`.
 *
 * @category Multiple comparisons
 */
export interface PairwiseWilcoxTestOptions extends PairwiseOptions, Omit<WilcoxTestOptions, "alternative" | "confInt"> {
}
/**
 * Pairwise Wilcoxon rank sum (or signed rank, with `paired`) tests between groups, with adjusted p-values. Equivalent
 * to R's `pairwise.wilcox.test()`. `method` is that of the last comparison, as in R.
 *
 * @example
 * ```ts
 * const x = [1.2, 2.3, 1.8, 2.9, 3.1, 3.6, 4.0, 4.4, 5.2];
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * pairwiseWilcoxTest(x, g).pValue; // [[0.3, NaN], [0.3, 0.3]]
 * ```
 *
 * @category Multiple comparisons
 */
export declare function pairwiseWilcoxTest(x: Sample, g: readonly GroupLabel[], options?: PairwiseWilcoxTestOptions): PairwiseResult;
/**
 * Options for {@link pairwisePropTest}.
 *
 * @category Multiple comparisons
 */
export interface PairwisePropTestOptions {
    /** p-value adjustment (see `pAdjust`). Default `"holm"`. */
    pAdjustMethod?: PAdjustMethod | (string & {});
    /** Continuity correction in each two-group test. Default `true`. */
    correct?: boolean;
}
/**
 * Pairwise two-group tests of equal proportions, with adjusted p-values. Equivalent to R's `pairwise.prop.test()`.
 *
 * @param x Numbers of successes per group.
 * @param n Numbers of trials per group. Groups with `NaN` in `x` or `n` are dropped (the rows and columns are then
 *   numbered over the groups kept, as in R).
 *
 * @example
 * ```ts
 * pairwisePropTest([15, 25, 40], [50, 50, 50]).pValue; // [[0.06619257972219345, NaN], [0.000004217380554293543, 0.006666708050273146]]
 * ```
 *
 * @category Multiple comparisons
 */
export declare function pairwisePropTest(x: readonly number[], n: readonly number[], options?: PairwisePropTestOptions): PairwiseResult;
