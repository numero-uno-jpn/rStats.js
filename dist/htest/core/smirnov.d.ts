export type SmirnovAlternative = "two.sided" | "less" | "greater";
export interface SmirnovOptions {
    /** Which statistic: max |F_x - F_y| ("two.sided", default), max (F_x - F_y) ("greater"), max (F_y - F_x) ("less"). */
    alternative?: SmirnovAlternative;
    /**
     * The pooled sample (length m + n). With ties, the statistic is only observed where the sorted values change.
     * Omit for continuous data without ties.
     */
    z?: readonly number[];
}
/**
 * P(D >= d) for the two-sample Smirnov statistic with sample sizes m and n, exactly.
 * The comparison D >= d is done on the integer scale |i n - j m| >= d m n with a relative fuzz of 1e-10, so that a
 * statistic computed in floating point from the data is not lost to rounding.
 *
 * @param d - Value of the statistic.
 * @param m - Size of the first sample (x).
 * @param n - Size of the second sample (y).
 */
export declare function psmirnovUpper(d: number, m: number, n: number, options?: SmirnovOptions): number;
