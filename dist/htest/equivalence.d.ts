import { type Sample } from "./types.js";
/**
 * Options for {@link tost}.
 *
 * @category Hypothesis tests
 */
export interface TostOptions {
    /** The equivalence margin: equivalence means |mean difference| < epsilon. Positive. Default `1` (as R). */
    epsilon?: number;
    /** Paired TOST on `x - y` (pairs with `NaN` are dropped). Default `false`. */
    paired?: boolean;
    /** Pooled variance (Student's t) instead of Welch's. Default `false`. */
    varEqual?: boolean;
    /** One minus the level of each one-sided test, in (0.5, 1); the interval is a 1 - 2(1 - confLevel) interval.
     *  Default `0.95`. */
    confLevel?: number;
    /** The level of each one-sided test, in (0, 0.5); overrides `confLevel` (which becomes `1 - alpha`). */
    alpha?: number;
}
/**
 * Result of {@link tost}.
 *
 * @category Hypothesis tests
 */
export interface TostResult {
    /** `"Welch Two Sample TOST"`, `" Two Sample TOST"` (pooled; the leading space is R's) or `"Paired TOST"`. */
    method: string;
    /** Degrees of freedom of the t tests (`parameterName` `"df"`). */
    parameter: number;
    /** `"df"`. */
    parameterName: string;
    /** The larger of the two one-sided p-values, `P(T > (epsilon - |d|)/se)` (R's `tost.p.value`). */
    pValue: number;
    /** `"rejected"` (equivalence shown: `confInt` lies inside (-epsilon, epsilon)) or `"not rejected"`, as R. */
    result: "rejected" | "not rejected";
    /** `d -+ qt(confLevel, df) se`: the 1 - 2(1 - confLevel) interval of the difference (R's `tost.interval`). */
    confInt: [number, number];
    /** `confLevel` (or `1 - alpha`), R's `conf.level` attribute of the interval. */
    confLevel: number;
    /** `[mean of x, mean of y]`, or the mean of the differences for a paired test. */
    estimate: number | number[];
    /** Names of `estimate`, as tTest's. */
    estimateNames: string | string[];
    /** The margin. */
    epsilon: number;
    /** Standard error of the difference (R's `se.diff`). */
    seDiff: number;
    /** Warnings (none: input without a defined result is an error). */
    warnings: string[];
}
/**
 * Two one-sided t tests (TOST) of equivalence of two means. Equivalent to `equivalence::tost()` in R.
 *
 * Equivalence, |mean(x) - mean(y)| < epsilon, is shown at level alpha = 1 - confLevel when both one-sided t tests of
 * H01: d <= -epsilon and H02: d >= epsilon reject; the p-value is the larger of their p-values and `confInt` the dual
 * 1 - 2 alpha interval (90% for the default `confLevel` 0.95). The difference, standard error and degrees of freedom are
 * those of {@link tTest} (Welch's by default, pooled with `varEqual`, paired with `paired`), with tTest's checks and
 * errors. Used on 0/1 data it compares two proportions with a t approximation; for counts
 * {@link binomDiffEquivalenceTest} is the better test.
 *
 * Unlike R, a level of 0.5 or less (`confLevel`) or of 0.5 or more (`alpha`) is an error (the interval would be empty),
 * and so is a margin that is not positive.
 *
 * @param x Sample.
 * @param y Second sample.
 * @param options See {@link TostOptions}.
 * @returns See {@link TostResult}.
 * @throws RangeError for a margin that is not positive and finite or a level out of range; Error where tTest has
 *   too few observations or the data are essentially constant.
 *
 * @example
 * ```ts
 * const r = tost([5.1, 4.9, 5.6, 5.8, 6.0, 5.4], [5.3, 5.0, 5.5, 5.7, 5.9, 5.2], { epsilon: 0.5 });
 * r.pValue;  // 0.029694342816029128
 * r.confInt; // [-0.36394177233776226, 0.4306084390044287] (a 90% interval)
 * r.result;  // "rejected"
 * ```
 *
 * @category Hypothesis tests
 */
export declare function tost(x: Sample, y: Sample, options?: TostOptions): TostResult;
/**
 * Statistics of {@link binomDiffEquivalenceTest}.
 *
 * @category Hypothesis tests
 */
export type BinomDiffEquivalenceMethod = "mn" | "mee" | "wald";
/**
 * Options for {@link binomDiffEquivalenceTest}.
 *
 * @category Hypothesis tests
 */
export interface BinomDiffEquivalenceTestOptions {
    /** The equivalence margin epsilon, in (0, 1): equivalence means -epsilon < p1 - p2 < epsilon. Required. */
    margin?: number;
    /** The statistic: `"mn"` (Miettinen-Nurminen score, the default), `"mee"` (Farrington-Manning score) or `"wald"`.
     *  Unambiguous abbreviations are accepted. */
    method?: BinomDiffEquivalenceMethod | (string & {});
    /** The level of each one-sided test, in (0, 0.5). Default `0.05`. */
    alpha?: number;
}
/**
 * Result of {@link binomDiffEquivalenceTest}.
 *
 * @category Hypothesis tests
 */
export interface BinomDiffEquivalenceTestResult {
    /** The statistic, in full (`"mn"`, `"mee"` or `"wald"`). */
    method: BinomDiffEquivalenceMethod;
    /** The estimate p1 - p2. */
    estimate: number;
    /** The margin epsilon. */
    margin: number;
    /** The level of each one-sided test. */
    alpha: number;
    /**
     * `[z(-margin), z(margin)]`, z(delta0) = (p1 - p2 - delta0) / sqrt(var(delta0)): the statistics of H01: p1 - p2 <=
     * -margin (large values reject) and of H02: p1 - p2 >= margin (small values reject).
     */
    statistic: [number, number];
    /** `"z"`. */
    statisticName: string;
    /** `[P(Z > z(-margin)), P(Z < z(margin))]`: the one-sided p-values of H01 and H02. */
    pValues: [number, number];
    /** The larger of `pValues`: the p-value of the test of equivalence. */
    pValue: number;
    /** `"rejected"` (equivalence shown: both p-values below alpha) or `"not rejected"`, as {@link tost}'s `result`. */
    result: "rejected" | "not rejected";
    /** The 1 - 2 alpha interval of p1 - p2 of {@link binomDiffCI} with the same method; equivalence is shown exactly when
     *  it lies inside (-margin, margin). */
    confInt: [number, number];
    /** `1 - 2 alpha`. */
    confLevel: number;
    /** Warnings (none: input without a defined result is an error). */
    warnings: string[];
}
/**
 * Test of equivalence of two independent proportions x1/n1 and x2/n2 within a margin. Two one-sided tests of
 * H01: p1 - p2 <= -margin and H02: p1 - p2 >= margin, each at level `alpha`; equivalence is shown when both reject.
 * Not an R function. (The R packages in scope give the dual intervals, `DescTools::BinomDiffCI`, or test one bound at
 * a time.)
 *
 * The statistic at a bound delta0 is z = (p1 - p2 - delta0) / sqrt(var), with var the variance of p1 - p2 at the
 * maximum likelihood estimate of (p1, p2) under p1 - p2 = delta0 (Farrington and Manning 1990, `"mee"`), the same times
 * N/(N - 1) (Miettinen and Nurminen 1985, `"mn"`, the default), or at the observed proportions (`"wald"`). The
 * p-values are normal tails. The test is dual to {@link binomDiffCI} with the same method at the level 1 - 2 alpha:
 * equivalence is shown exactly when that interval, returned as `confInt`, lies inside (-margin, margin).
 *
 * The Wald variance is 0 when both proportions are 0 or 1: the statistics are then infinite and the p-values 0 or 1,
 * as binomDiffCI's Wald interval is a point there.
 *
 * @param x1 Successes in group 1.
 * @param n1 Trials in group 1.
 * @param x2 Successes in group 2.
 * @param n2 Trials in group 2.
 * @param options See {@link BinomDiffEquivalenceTestOptions}; `margin` is required.
 * @returns See {@link BinomDiffEquivalenceTestResult}.
 * @throws RangeError for counts that are not integers with 0 <= x <= n, n > 0, a margin outside (0, 1), alpha
 *   outside (0, 0.5), or an unknown method.
 *
 * @example
 * ```ts
 * const r = binomDiffEquivalenceTest(80, 100, 78, 100, { margin: 0.15 });
 * r.pValues; // [0.0018937433499954864, 0.012899725361675841]
 * r.pValue;  // 0.012899725361675841
 * r.confInt; // [-0.07557697533608577, 0.11553638647686569] (binomDiffCI, method "mn", 90%)
 * r.result;  // "rejected"
 * ```
 *
 * @category Hypothesis tests
 */
export declare function binomDiffEquivalenceTest(x1: number, n1: number, x2: number, n2: number, options?: BinomDiffEquivalenceTestOptions): BinomDiffEquivalenceTestResult;
