/**
 * Options for {@link ICC}.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface ICCOptions {
    /** One minus the confidence level of the intervals, in (0, 1) (psych's `alpha`). Default `0.05`; overrides
     *  `confLevel`. */
    alpha?: number;
    /** Confidence level of the intervals, in (0, 1). Default `0.95`. */
    confLevel?: number;
    /**
     * `true` (default, as psych): the mean squares from the REML estimates of the variance components, which are not
     * negative (where a component would be negative, it is 0 and the coefficients that depend on it are 0, F 1);
     * `false`: the ANOVA mean squares (coefficients may be negative).
     */
    lmer?: boolean;
}
/**
 * One of the six forms in {@link ICCResult}.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface ICCRow {
    /** `"ICC1"`, `"ICC2"`, `"ICC3"`, `"ICC1k"`, `"ICC2k"` or `"ICC3k"`. */
    type: "ICC1" | "ICC2" | "ICC3" | "ICC1k" | "ICC2k" | "ICC3k";
    /** psych's row name: `"Single_raters_absolute"`, `"Single_random_raters"`, ... */
    name: string;
    /** The intraclass correlation. */
    ICC: number;
    /** F statistic of the test of ICC = 0. */
    F: number;
    /** Numerator degrees of freedom. */
    df1: number;
    /** Denominator degrees of freedom. */
    df2: number;
    /** Upper-tail p-value of the F test. */
    pValue: number;
    /** Lower confidence limit. */
    lower: number;
    /** Upper confidence limit. */
    upper: number;
}
/**
 * Result of {@link ICC}.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface ICCResult {
    /** The six forms, in psych's order ICC1, ICC2, ICC3, ICC1k, ICC2k, ICC3k. */
    results: ICCRow[];
    /** Mean square of subjects (REML: `k σ²_subject + σ²_e`). */
    MSB: number;
    /** Mean square of raters (REML: `n σ²_rater + σ²_e`). */
    MSJ: number;
    /** Residual mean square (REML: `σ²_e`). */
    MSE: number;
    /** Mean square within subjects, used by ICC1 and ICC1k (REML: `σ²_e + σ²_rater`). */
    MSW: number;
    /** Number of subjects (rows). */
    n: number;
    /** Number of raters (columns). */
    k: number;
    /** Confidence level of the intervals, `1 - alpha`. */
    confLevel: number;
    /** Whether the REML path was used. */
    lmer: boolean;
    /** R's warnings (aov's `essentially perfect fit` where the residual mean square is 0 on the ANOVA path). */
    warnings: string[];
}
/**
 * The six intraclass correlations of Shrout and Fleiss (1979), with their F tests and confidence intervals.
 * Equivalent to `psych::ICC(x, alpha, lmer)` in R. Only complete data are accepted.
 *
 * `x` is an n × k matrix (an array of rows): the ratings of the k raters for each of the n subjects. The forms are
 * ICC1 = (MSB − MSW)/(MSB + (k − 1)MSW) (one-way), ICC2 = (MSB − MSE)/(MSB + (k − 1)MSE + k(MSJ − MSE)/n) (two-way
 * random raters, absolute agreement), ICC3 = (MSB − MSE)/(MSB + (k − 1)MSE) (two-way fixed raters, consistency), and
 * their averages over k raters ICC1k, ICC2k, ICC3k. With `lmer: true` (the default, as psych) the mean squares are
 * rebuilt from the REML estimates of the variance components of the two-way random model, which are not negative;
 * where both ANOVA components are not negative they equal the ANOVA mean squares. psych fits that model with lme4,
 * whose optimiser stops early (results about 1e-5 relative off); here the REML estimates are computed exactly, in
 * closed form.
 *
 * ICC1, ICC3, ICC1k and ICC3k agree with {@link icc} (irr's forms); the interval of ICC2k is psych's (ICC2's bounds
 * transformed by Spearman-Brown), not irr's (McGraw and Wong's average-agreement interval).
 *
 * Where the residual mean square is 0 (ratings that differ between raters by constants), the F statistics of ICC2 and
 * ICC3 are Infinity with p-value 0, and ICC3, ICC3k and their bounds are 1.
 *
 * @param x An n × k matrix of ratings (array of rows), without missing values.
 * @param options See {@link ICCOptions}.
 * @returns See {@link ICCResult}.
 * @throws TypeError if x is not a matrix of numbers; RangeError for missing or infinite ratings (psych's REML path
 *   accepts missing ratings; here they are an error), fewer than 2 subjects or raters, ratings that are all equal or
 *   identical for every subject, or a level out of range.
 *
 * @example
 * ```ts
 * const r = ICC([[9, 2, 5, 8], [6, 1, 3, 2], [8, 4, 6, 8], [7, 1, 2, 6], [10, 5, 6, 9], [6, 2, 4, 7]]);
 * r.results[1]!.ICC;   // 0.28976377952755905 (ICC2)
 * r.results[4]!.lower; // 0.07113681530250335 (ICC2k)
 * ```
 *
 * @category Agreement, reliability and factor analysis
 */
export declare function ICC(x: readonly (readonly number[])[], options?: ICCOptions): ICCResult;
