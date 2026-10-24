import type { HTest, Counts } from "./types.js";
/** Options for {@link chisqTest}. */
export interface ChisqTestOptions {
    /** Apply Yates' continuity correction (2 x 2 tables only). Default `true`. */
    correct?: boolean;
    /** Expected probabilities for the goodness-of-fit test. Default: equal probabilities. Ignored for contingency tables. */
    p?: readonly number[];
    /** Rescale `p` to sum to 1. Default `false`, in which case `p` must sum to 1. */
    rescaleP?: boolean;
}
/**
 * Result of {@link chisqTest}. Has no `alternative`, because R's `chisq.test()` does not return one.
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
 * Pearson's chi-squared test. Equivalent to R's `chisq.test()`.
 *
 * Given an array of counts, tests goodness of fit to `options.p`. Given a matrix (an array
 * of rows), tests independence in the contingency table; a matrix with a single row or
 * column is treated as a goodness-of-fit test, as in R. Yates' correction is applied to
 * 2 x 2 tables by default; as in R, the amount subtracted is `min(0.5, min |O - E|)` over
 * all cells. Sums are computed in extended precision, like R.
 *
 * Not implemented: `simulate.p.value` (Monte Carlo p-values) and passing two factor vectors.
 * R's warning for expected counts below 5 is not issued.
 *
 * @param x Counts, or a contingency table as an array of rows.
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
 * ```
 */
export declare function chisqTest(x: Counts | readonly Counts[], options?: ChisqTestOptions): ChisqTestResult;
