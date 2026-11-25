/**
 * The largest grand total for which the table of log factorials (total + 1 doubles, 128 MB at the limit) is built:
 * r2dtable and the simulated p-values of chisqTest and fisherTest (#285, #286, #336); the same 2^24 as the exact
 * supports of fisherTest and mantelhaenTest (#232)
 */
export declare const MAX_TABLE_TOTAL: number;
/** log k! for k = 0..n, accumulated as sums of logs (the table AS 159 uses) */
export declare function logFactorialTable(n: number): Float64Array;
/**
 * One random table with row totals `r` and column totals `c` (equal sums, non-negative integers), filled into `out`
 * column by column (out[i + j * nr]). `fact` is {@link logFactorialTable} of at least the grand total.
 */
export declare function rcont2(r: readonly number[], c: readonly number[], fact: Float64Array, out: Int32Array): void;
/**
 * Random two-way tables with given row and column totals. Equivalent to R's `r2dtable()`.
 *
 * Uses Patefield's (1981) algorithm and consumes the same uniforms as R, so after `setSeed` the tables are R's.
 * Each table is returned as an array of rows (R returns a list of matrices).
 *
 * @param n Number of tables (fractions are truncated, as in R).
 * @param r Row totals (non-negative integers, at least two).
 * @param c Column totals (non-negative integers, at least two), with the same sum as `r`.
 * @returns An array of `n` tables, each `r.length` rows of `c.length` counts.
 * @throws RangeError for invalid arguments or totals that differ, and (when n >= 1) for a grand total above 2^24
 *   (16777216; R allows up to 2147483647), as the table of log factorials has total + 1 entries.
 *
 * @example
 * ```ts
 * setSeed(1);
 * r2dtable(1, [3, 2], [2, 3]); // [[[1, 2], [1, 1]]]  (R: set.seed(1); r2dtable(1, c(3, 2), c(2, 3)))
 * ```
 *
 * @category Random numbers
 */
export declare function r2dtable(n: number, r: readonly number[], c: readonly number[]): number[][][];
