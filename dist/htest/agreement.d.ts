/**
 * Weighting of the disagreements in {@link kappa2}.
 *
 * @category Agreement, reliability and factor analysis
 */
export type Kappa2Weight = "unweighted" | "equal" | "squared";
/**
 * Options for {@link kappa2}.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface Kappa2Options {
    /**
     * `"unweighted"` (default): only identical ratings agree. `"equal"`: weights `1 − d/(c − 1)` for levels `d` apart
     * (of `c` levels); `"squared"`: `1 − d²/(c − 1)²`. Unambiguous abbreviations are accepted.
     */
    weight?: Kappa2Weight | (string & {});
}
/**
 * Result of {@link kappa2} and {@link kappamFleiss}.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface KappaResult {
    /** The kappa coefficient. */
    value: number;
    /** z statistic of the test of kappa = 0 (absent for Fleiss' exact kappa). */
    statistic?: number;
    /** Two-sided p-value of the z test (absent for Fleiss' exact kappa). */
    pValue?: number;
}
/**
 * Cohen's kappa for two raters, unweighted or weighted, with the z test of kappa = 0. Equivalent to
 * `irr::kappa2(ratings, weight)` in R. The ratings are numeric.
 *
 * The levels are the distinct ratings of both raters sorted as R sorts their character forms (so 10 sorts before 2,
 * which matters for the weighted kappas). Rows with a missing value (`NaN`) are dropped. The variance of the test is
 * the one under the null hypothesis; the p-value is computed as 2 Φ(−|z|), so small p-values are more accurate than
 * irr's.
 *
 * @param ratings - An n × 2 matrix (array of rows): the ratings of the two raters for each subject.
 * @param options - See {@link Kappa2Options}.
 *
 * @example
 * ```ts
 * kappa2([[1, 1], [2, 2], [3, 2], [1, 1], [2, 3], [3, 3]]); // { value: 0.49999999999999994, statistic: 1.7320508075688772, pValue: 0.08326451666355043 }
 * ```
 *
 * @category Agreement, reliability and factor analysis
 */
export declare function kappa2(ratings: readonly (readonly number[])[], options?: Kappa2Options): Required<KappaResult>;
/**
 * Options for {@link kappamFleiss}.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface KappamFleissOptions {
    /** Conger's exact kappa instead of Fleiss' (no test is then given). Default `false`. */
    exact?: boolean;
}
/**
 * Fleiss' kappa for several raters (or Conger's exact kappa), with the z test of kappa = 0 for Fleiss' kappa.
 * Equivalent to `irr::kappam.fleiss(ratings, exact)` in R. The ratings are numeric, without missing values.
 *
 * The p-value is computed as 2 Φ(−|z|), so small p-values are more accurate than irr's.
 *
 * @param ratings - An n × m matrix (array of rows): the ratings of the m raters for each of the n subjects.
 * @param options - See {@link KappamFleissOptions}.
 *
 * @example
 * ```ts
 * kappamFleiss([[1, 1, 2], [2, 2, 2], [3, 3, 2], [1, 1, 1], [2, 3, 3]]).value; // 0.3918918918918918
 * ```
 *
 * @category Agreement, reliability and factor analysis
 */
export declare function kappamFleiss(ratings: readonly (readonly number[])[], options?: KappamFleissOptions): KappaResult;
/**
 * Options for {@link icc}. Unambiguous abbreviations of the choices are accepted.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface IccOptions {
    /** `"oneway"` (default; subjects are the only effect) or `"twoway"` (subjects and raters). */
    model?: "oneway" | "twoway" | (string & {});
    /** Two-way model: `"consistency"` (default) or `"agreement"` (rater differences count as disagreement). */
    type?: "consistency" | "agreement" | (string & {});
    /** `"single"` (default; the reliability of one rater) or `"average"` (of the mean of the k raters). */
    unit?: "single" | "average" | (string & {});
    /** The value of the coefficient under the null hypothesis. Default `0`. */
    r0?: number;
    /** Confidence level of the interval. Default `0.95`. */
    confLevel?: number;
}
/**
 * Result of {@link icc}.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface IccResult {
    /** The intraclass correlation coefficient. */
    value: number;
    /** F statistic of the test of ICC = r0. */
    Fvalue: number;
    /** Numerator degrees of freedom of the F test. */
    df1: number;
    /** Denominator degrees of freedom of the F test. */
    df2: number;
    /** Upper-tail p-value of the F test. */
    pValue: number;
    /** Lower confidence limit. */
    lbound: number;
    /** Upper confidence limit. */
    ubound: number;
}
/**
 * Intraclass correlation coefficient with its F test and confidence interval (McGraw and Wong's forms).
 * Equivalent to `irr::icc(ratings, model, type, unit, r0, conf.level)` in R. No missing values are allowed.
 *
 * @param ratings - An n × k matrix (array of rows): the ratings of the k raters for each of the n subjects.
 * @param options - See {@link IccOptions}.
 *
 * @example
 * ```ts
 * icc([[9, 2, 5, 8], [6, 1, 3, 2], [8, 4, 6, 8], [7, 1, 2, 6], [10, 5, 6, 9], [6, 2, 4, 7]],
 *     { model: "twoway", type: "agreement" }).value; // 0.28976377952755905
 * ```
 *
 * @category Agreement, reliability and factor analysis
 */
export declare function icc(ratings: readonly (readonly number[])[], options?: IccOptions): IccResult;
/**
 * Result of {@link cronbachAlpha}.
 *
 * @category Agreement, reliability and factor analysis
 */
export interface CronbachAlphaResult {
    /** Cronbach's alpha from the covariances. */
    rawAlpha: number;
    /** Alpha from the correlations (standardized items). */
    stdAlpha: number;
    /** Guttman's lambda 6, from the squared multiple correlations. */
    G6: number;
    /** Mean correlation between the items. */
    averageR: number;
    /** Raw alpha of the items without each item in turn. */
    alphaDrop: number[];
}
/**
 * Cronbach's alpha of a set of items, standardized alpha, Guttman's lambda 6 and the mean inter-item correlation,
 * and alpha with each item dropped. Equivalent to `psych::alpha()` in R. It gives the `total` row and
 * `alpha.drop$raw_alpha` of `alpha(x)` with its defaults (no missing values, no reversed items).
 *
 * @param x - An n × k matrix (array of rows): k items observed on n subjects.
 *
 * @example
 * ```ts
 * cronbachAlpha([[1, 2, 2], [2, 3, 3], [3, 3, 4], [4, 5, 4], [2, 2, 3]]).rawAlpha; // 0.935483870967742
 * ```
 *
 * @category Agreement, reliability and factor analysis
 */
export declare function cronbachAlpha(x: readonly (readonly number[])[]): CronbachAlphaResult;
/**
 * Partial correlation of columns `i` and `j` of `x` given all its other columns. Equivalent to
 * `psych::partial.r(x, c(i, j), others)` in R. Returns its off-diagonal element (no missing values).
 *
 * @param x - An n × p matrix (array of rows), the variables in the columns.
 * @param i - 0-based column index.
 * @param j - 0-based column index, different from `i`.
 *
 * @example
 * ```ts
 * partialR([[1, 2, 3], [2, 1, 5], [3, 5, 4], [4, 3, 8], [5, 6, 7]], 0, 1); // 0.9804877404385672
 * ```
 *
 * @category Agreement, reliability and factor analysis
 */
export declare function partialR(x: readonly (readonly number[])[], i: number, j: number): number;
