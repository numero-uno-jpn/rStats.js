import type { Sample } from "../htest/types.js";
/**
 * How ties are ranked, as R's `ties.method`.
 *
 * @category Descriptive statistics
 */
export type TiesMethod = "average" | "first" | "last" | "random" | "max" | "min";
/**
 * Options for {@link rank}.
 *
 * @category Descriptive statistics
 */
export interface RankOptions {
    /** Ranks of tied values. Default `"average"`. */
    tiesMethod?: TiesMethod;
    /**
     * Missing values: `"last"` (default, R's `na.last = TRUE`) ranks them after the others, `"first"` (`FALSE`) before
     * them, `"keep"` leaves them `NaN`.
     */
    naLast?: "last" | "first" | "keep";
}
/**
 * Sample ranks. Equivalent to R's `rank()`.
 *
 * @example
 * ```ts
 * rank([10, 20, 20, 30]);                         // [1, 2.5, 2.5, 4]
 * rank([10, 20, 20, 30], { tiesMethod: "min" });  // [1, 2, 2, 4]
 * ```
 *
 * @category Descriptive statistics
 */
export declare function rank(x: Sample, options?: RankOptions): number[];
