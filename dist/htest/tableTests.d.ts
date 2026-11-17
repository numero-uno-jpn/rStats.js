import { type Alternative, type Counts, type HTest } from "./types.js";
/**
 * Freeman-Tukey deviate sqrt(O) + sqrt(O + 1) - sqrt(4E + 1) (Bishop, Fienberg and Holland 1975, 14.7). The plain
 * formula cancels for large counts (sqrt(O) + sqrt(O + 1) against sqrt(4E + 1), losing eps sqrt(O) absolute); here it
 * is (a^2 - b^2) / (a + b) with a = sqrt(O) + sqrt(O + 1), b = sqrt(4E + 1) and
 * a^2 - b^2 = 2(O - E) + 2 ((O - E)(O + E) + O) / (sqrt(O (O + 1)) + E), whose rounding is a few eps absolute
 */
export declare function freemanTukeyDeviate(O: number, E: number): number;
/** Freeman-Tukey deviates of a vector or a table (rows) */
export declare function freemanTukeyResiduals(O: readonly number[], E: readonly number[]): number[];
export declare function freemanTukeyResiduals(O: readonly (readonly number[])[], E: readonly (readonly number[])[]): number[][];
/**
 * Corrections of {@link gTest}.
 *
 * @category Hypothesis tests
 */
export type GTestCorrection = "none" | "williams" | "yates";
/**
 * Options for {@link gTest}.
 *
 * @category Hypothesis tests
 */
export interface GTestOptions {
    /**
     * `"none"` (default), `"williams"` (Williams' correction q of the statistic) or `"yates"` (Yates' correction of the
     * counts by 0.5, 2 x 2 tables and two-category goodness of fit only). Unambiguous abbreviations are accepted.
     */
    correct?: GTestCorrection | (string & {});
    /** Expected probabilities for the goodness-of-fit test. Default: equal probabilities. Ignored for a table. */
    p?: readonly number[];
    /** Rescale `p` to sum to 1. Default `false`, in which case `p` must sum to 1 (within sqrt(eps)). */
    rescaleP?: boolean;
}
/**
 * Result of {@link gTest}. Has no `alternative`, as DescTools' `GTest` returns none.
 *
 * @category Hypothesis tests
 */
export interface GTestResult extends Omit<HTest, "alternative"> {
    /** Degrees of freedom (`parameterName` is `"X-squared df"`, as DescTools). */
    parameter: number;
    /** The counts, after Yates' correction where it is applied (as DescTools); an array of rows for a table. */
    observed: number[] | number[][];
    /** Expected counts under the null hypothesis. */
    expected: number[] | number[][];
    /**
     * Freeman-Tukey deviates `sqrt(O) + sqrt(O + 1) - sqrt(4E + 1)` of the counts given (without Yates' correction),
     * approximately standard normal under the null hypothesis.
     */
    ftResiduals: number[] | number[][];
}
/**
 * Log-likelihood ratio (G) test of independence in a contingency table, or of goodness of fit of counts to given
 * probabilities. Equivalent to `DescTools::GTest()` in R.
 *
 * For a table (an array of rows), `G = 2 sum x log(x / E) / q` with `E` the products of the margins over the total and
 * `(r - 1)(c - 1)` degrees of freedom, counting empty rows and columns as DescTools; for a vector (or a table with one
 * row or column), `E = n p` and `k - 1` degrees of freedom. `correct: "williams"` divides by Williams' q
 * (`1 + (n sum 1/R_i - 1)(n sum 1/C_j - 1) / (6 n (r - 1)(c - 1))` for a table, which is not defined with an empty
 * row or column: an error, where DescTools gives G = 0 and p = 1; and `1 + (k + 1) / (6n)` for a vector). `correct: "yates"` moves the counts of a 2 x 2 table by 0.5 toward
 * independence as DescTools does: the off-diagonal cells up and the diagonal down when `x11 x22 - x12 x21 > 0`, and
 * the other way otherwise, also when it is 0 (so that a table of exact independence gets a positive G), and without
 * stopping at 0 (a cell that becomes negative makes G NaN, with the warning "NaNs produced"). For two counts it moves
 * them by 0.5 toward `E` when they differ from it by more than 0.25.
 *
 * The p-value is the upper tail of chi-squared (DescTools computes `1 - pchisq` for a table, which is 0 below about
 * 1e-16). G is summed as a deviance, without the cancellation of the plain sum. The result also has the Freeman-Tukey
 * deviates `ftResiduals`.
 *
 * @param x Counts (nonnegative, finite; not all 0), or a contingency table as an array of rows.
 * @param options See {@link GTestOptions}.
 * @returns The test result, with `statisticName` `"G"`; see {@link GTestResult}.
 * @throws RangeError for negative or non-finite counts, a total of 0, fewer than 2 counts, `p` of the wrong length,
 *   negative or not summing to 1, `"yates"` for anything but a 2 x 2 table or two counts, and `"williams"` for a
 *   table with an empty row or column.
 *
 * @example
 * ```ts
 * gTest([[12, 5], [7, 9]]).statistic;                      // 2.4600430077307167
 * gTest([[12, 5], [7, 9]], { correct: "williams" }).pValue; // 0.12530270793206313
 * gTest([10, 20, 30], { p: [0.2, 0.3, 0.5] }).pValue;      // 0.7527706003419717
 * ```
 *
 * @category Hypothesis tests
 */
export declare function gTest(x: Counts | readonly Counts[], options?: GTestOptions): GTestResult;
/**
 * Result of {@link stuartMaxwellTest}. Has no `alternative`, as DescTools' `StuartMaxwellTest` returns none.
 *
 * @category Hypothesis tests
 */
export interface StuartMaxwellTestResult extends Omit<HTest, "alternative"> {
    /** Degrees of freedom: the number of categories left, less 1 (`parameterName` is `"df"`). */
    parameter: number;
    /** The total of the table without the categories removed. */
    N: number;
}
/**
 * Stuart-Maxwell test of marginal homogeneity of a square table (paired classifications into the same categories).
 * Equivalent to `DescTools::StuartMaxwellTest()` in R. The degrees of freedom differ where categories are removed.
 *
 * Categories with no counts off the diagonal (in their row and column) are removed. With the K categories left, `d`
 * the differences of the row and column sums of the first K - 1 and `S` their covariance (`S_ii = r_i + c_i - 2 x_ii`,
 * `S_ij = -(x_ij + x_ji)`), the statistic `d' S^-1 d` is chi-squared with K - 1 degrees of freedom (DescTools keeps the
 * original number of categories less 1). For a 2 x 2 table it is McNemar's statistic without correction.
 *
 * @param table A square table of counts as an array of rows.
 * @returns The test result, with `statisticName` `"chi-squared"`; see {@link StuartMaxwellTestResult}.
 * @throws RangeError for a table that is not square with at least two rows, negative or non-finite counts, fewer
 *   than 2 categories left ("Too many equal marginals, cannot compute") and categories whose off-diagonal counts fall
 *   into unconnected groups (S is then singular).
 *
 * @example
 * ```ts
 * stuartMaxwellTest([[20, 3, 2], [4, 15, 6], [1, 5, 30]]).statistic; // 0.30534351145038163
 * ```
 *
 * @category Hypothesis tests
 */
export declare function stuartMaxwellTest(table: readonly Counts[]): StuartMaxwellTestResult;
/**
 * Options for {@link goodmanKruskalGamma}.
 *
 * @category Hypothesis tests
 */
export interface GoodmanKruskalGammaOptions {
    /** Confidence level of `confInt`, in (0, 1). Default `0.95`. */
    confLevel?: number;
}
/**
 * Result of {@link goodmanKruskalGamma}.
 *
 * @category Hypothesis tests
 */
export interface GoodmanKruskalGammaResult {
    /** Gamma, `(C - D) / (C + D)` with C and D the numbers of concordant and discordant pairs (NaN when both are 0). */
    estimate: number;
    /** The Wald interval `gamma -/+ z ase`, clipped to [-1, 1]. */
    confInt: [number, number];
    /** The confidence level of `confInt`. */
    confLevel: number;
    /** The asymptotic standard error ASE1 (not under the null hypothesis). */
    ase: number;
    /** Warnings (none: DescTools gives none either). */
    warnings: string[];
}
/**
 * Goodman and Kruskal's gamma of a table of two ordered classifications, with its asymptotic standard error and a
 * Wald confidence interval. Equivalent to `DescTools::GoodmanKruskalGamma()` in R.
 *
 * `gamma = (C - D) / (C + D)` with C and D the numbers of concordant and discordant pairs. The standard error is the
 * non-null ASE1 (Agresti 2010, section 7.1): `sqrt(sum x psi^2)` with `psi_ij = 2 (D Pc_ij - C Pd_ij) / (C + D)^2`,
 * `Pc_ij` the counts above-left and below-right of cell (i, j) and `Pd_ij` those above-right and below-left. The
 * interval is `[max(-1, gamma - z ase), min(1, gamma + z ase)]`, z the normal quantile of `1 - (1 - confLevel) / 2`.
 * Without concordant or discordant pairs (a table with one row, for example) gamma and the interval are NaN, as
 * DescTools. No test of gamma = 0 is given (it would need the null standard error).
 *
 * @param table A table of counts (nonnegative, finite) as an array of rows; rows and columns in their order.
 * @param options See {@link GoodmanKruskalGammaOptions}.
 * @returns See {@link GoodmanKruskalGammaResult}.
 * @throws RangeError for negative or non-finite counts, or a level outside (0, 1).
 *
 * @example
 * ```ts
 * const g = goodmanKruskalGamma([[10, 5, 2], [3, 8, 6], [1, 4, 9]]);
 * g.estimate; // 0.6703296703296703
 * g.confInt;  // [0.4241347346132843, 0.9165246060460562]
 * ```
 *
 * @category Hypothesis tests
 */
export declare function goodmanKruskalGamma(table: readonly Counts[], options?: GoodmanKruskalGammaOptions): GoodmanKruskalGammaResult;
/**
 * Options for {@link lblTest}.
 *
 * @category Hypothesis tests
 */
export interface LblTestOptions {
    /** `"two.sided"` (default), `"less"` (negative association) or `"greater"` (positive association). */
    alternative?: Alternative | (string & {});
    /** Scores of the rows. Default `1, 2, ..., r`. */
    rowScores?: readonly number[];
    /** Scores of the columns. Default `1, 2, ..., c`. */
    colScores?: readonly number[];
}
/**
 * Result of {@link lblTest}.
 *
 * @category Hypothesis tests
 */
export type LblTestResult = HTest;
/**
 * Asymptotic linear-by-linear association test of a table of two ordered classifications (the Mantel test of trend).
 * Equivalent to `coin::lbl_test()` in R. As coin's asymptotic test, except for tables with a two-level factor.
 *
 * `Z = sqrt(N - 1) r`, r the Pearson correlation of the row and column scores over the N observations: the linear
 * statistic `sum x_ij u_i v_j` standardised by its permutation (conditional) mean and variance. The scores are 1..k
 * by default for every factor (the level index; empty rows and columns keep their place). coin leaves a two-level
 * factor unordered and codes it by an indicator of its first level, which turns the sign of Z, and refuses 2 x 2
 * tables; here two-level factors are scored like the others and a 2 x 2 table is tested (Z^2 is then the 'N - 1'
 * chi-squared statistic). p-values from the normal distribution: `"greater"` is positive association.
 *
 * @param table A table of counts (nonnegative, finite) as an array of rows.
 * @param options See {@link LblTestOptions}.
 * @returns The test result, with `statisticName` `"Z"`; see {@link LblTestResult}.
 * @throws RangeError for negative or non-finite counts, a total of at most 1, scores of the wrong length or not
 *   finite, and tables whose row or column scores do not vary over the observations (Z undefined).
 *
 * @example
 * ```ts
 * lblTest([[10, 5, 2], [3, 8, 6], [1, 4, 9]]).statistic; // 3.601652214003794
 * ```
 *
 * @category Hypothesis tests
 */
export declare function lblTest(table: readonly Counts[], options?: LblTestOptions): LblTestResult;
