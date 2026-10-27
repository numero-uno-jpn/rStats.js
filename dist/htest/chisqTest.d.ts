import type { HTest, Counts } from "./types.js";
/**
 * Options for {@link chisqTest}.
 *
 * @category Hypothesis tests
 */
export interface ChisqTestOptions {
    /** Apply Yates' continuity correction (2 x 2 tables only). Default `true`. */
    correct?: boolean;
    /** Expected probabilities for the goodness-of-fit test. Default: equal probabilities. Ignored for contingency tables. */
    p?: readonly number[];
    /** Rescale `p` to sum to 1. Default `false`, in which case `p` must sum to 1. */
    rescaleP?: boolean;
    /**
     * Compute the p-value by Monte Carlo simulation with `B` replicates (R's `simulate.p.value`), using the random
     * stream of {@link setSeed} as R does. Default `false`.
     */
    simulatePValue?: boolean;
    /** Number of replicates for `simulatePValue`. Default `2000`. */
    B?: number;
}
/**
 * Result of {@link chisqTest}. Has no `alternative`, because R's `chisq.test()` does not return one.
 *
 * @category Hypothesis tests
 */
export interface ChisqTestResult extends Omit<HTest, "alternative"> {
    /** Degrees of freedom (`parameterName` is `"df"`). */
    parameter: number;
    /** Observed counts (an array of rows for a contingency table). */
    observed: number[] | number[][];
    /** Expected counts under the null hypothesis. */
    expected: number[] | number[][];
    /** Pearson residuals `(O - E) / sqrt(E)`. */
    residuals: number[] | number[][];
    /**
     * Standardized residuals `(O - E) / sqrt(V)`, where `V` is
     * `E (1 - row proportion) (1 - column proportion)` for a contingency table and
     * `n p (1 - p)` for goodness of fit.
     */
    stdres: number[] | number[][];
}
/**
 * Result of {@link chisqTest} with two factor vectors: also the levels that label the rows and columns.
 *
 * @category Hypothesis tests
 */
export interface ChisqTestFactorsResult extends ChisqTestResult {
    observed: number[][];
    expected: number[][];
    residuals: number[][];
    stdres: number[][];
    /** Levels of `x` (rows of the table), sorted by code point. */
    rowLevels: string[];
    /** Levels of `y` (columns of the table), sorted by code point. */
    colLevels: string[];
}
/**
 * A factor: category labels, with `null` or `undefined` for missing values (R's NA).
 *
 * @category Hypothesis tests
 */
export type Factor = readonly (string | null | undefined)[];
/**
 * Pearson's chi-squared test. Equivalent to R's `chisq.test()`.
 *
 * Given an array of counts, tests goodness of fit to `options.p`. Given a matrix (an array
 * of rows), tests independence in the contingency table; a matrix with a single row or
 * column is treated as a goodness-of-fit test, as in R. Yates' correction is applied to
 * 2 x 2 tables by default; as in R, the amount subtracted is `min(0.5, min |O - E|)` over
 * all cells. Sums are computed in extended precision, like R.
 *
 * With `simulatePValue: true` the p-value is computed from `B` simulated samples (multinomial for goodness of fit,
 * random tables with the observed margins otherwise), drawn from the random stream of {@link setSeed} exactly as in
 * R, so `setSeed(s)` before the call gives R's p-value after `set.seed(s)`.
 *
 * Given two factor vectors (arrays of labels of the same length), tests independence in their contingency table, as
 * R's `chisq.test(x, y)`; pairs with a missing label are dropped and the levels are sorted by code point.
 *
 * R's warning for expected counts below 5 is not issued.
 *
 * @param x Counts, or a contingency table as an array of rows (or a factor, with `y`).
 * @param options See {@link ChisqTestOptions}.
 * @returns The test result, with `statisticName` `"X-squared"`; see {@link ChisqTestResult}.
 *
 * @example
 * ```ts
 * const r = chisqTest([[12, 5], [7, 15]]);
 * r.statistic; // 4.322120391218687 (with Yates' continuity correction)
 * r.pValue;    // 0.03762001663483994
 *
 * chisqTest([20, 30, 50]).pValue; // 0.0009118819655545154 (goodness of fit, equal p)
 *
 * setSeed(1);
 * chisqTest([20, 15, 25], { simulatePValue: true }).pValue; // 0.296351824087956 (R: set.seed(1); chisq.test(...))
 *
 * chisqTest(["a", "b", "a", "b"], ["u", "u", "v", "v"]).rowLevels; // ["a", "b"]
 * ```
 *
 * @category Hypothesis tests
 */
export declare function chisqTest(x: Counts | readonly Counts[], options?: ChisqTestOptions): ChisqTestResult;
export declare function chisqTest(x: Factor, y: Factor, options?: ChisqTestOptions): ChisqTestFactorsResult;
