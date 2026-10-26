/**
 * Adjustment method for {@link pAdjust}, as in R's `p.adjust.methods`. `"fdr"` is an alias of `"BH"`.
 */
export type PAdjustMethod = "holm" | "hochberg" | "hommel" | "bonferroni" | "BH" | "BY" | "fdr" | "none";
/** Options for {@link pAdjust}. */
export interface PAdjustOptions {
    /** Adjustment method. Default `"holm"`. Unambiguous abbreviations are accepted, as in R. */
    method?: PAdjustMethod | (string & {});
    /**
     * Number of comparisons. Default: the number of non-`NaN` p-values. Must not be smaller
     * than that; must be an integer for `"hommel"`.
     */
    n?: number;
}
/**
 * Adjusts p-values for multiple comparisons. Equivalent to R's `p.adjust()`.
 *
 * `NaN` values are excluded from the adjustment and returned as `NaN` in place. If `n` is
 * 1 or less, the p-values are returned unchanged. Differences from R: with `"hommel"` a
 * non-integer `n` is an error, and an empty `p` always gives an empty result.
 *
 * @param p p-values.
 * @param options See {@link PAdjustOptions}, or just the method name as a string.
 * @returns Adjusted p-values, in the same order as `p`.
 *
 * @example
 * ```ts
 * const p = [0.01, 0.02, 0.03, 0.04, 0.05];
 * pAdjust(p);       // [0.05, 0.08, 0.09, 0.09, 0.09] (Holm)
 * pAdjust(p, "BH"); // [0.05, 0.05, 0.05, 0.05, 0.05]
 * pAdjust(p, { method: "bonferroni", n: 10 });
 * ```
 */
export declare function pAdjust(p: readonly number[] | Float64Array, options?: PAdjustOptions | PAdjustMethod | (string & {})): number[];
