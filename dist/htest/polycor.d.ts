/** Result of {@link polychor} and {@link polyserial}. */
export interface PolycorResult {
    /** The correlation (`NaN` where polycor returns NA). */
    rho: number;
    /** polycor's warnings, in order. */
    warnings: string[];
}
/** Options of {@link polychor} and {@link polyserial}. */
export interface PolycorOptions {
    /**
     * Estimate the correlation and the thresholds together by maximum likelihood (polycor's `ML = TRUE`), instead of
     * the two-step estimate. Default `false`.
     */
    ML?: boolean;
    /**
     * Also return the variances of the estimates, the chi-square test of bivariate normality and the thresholds
     * (polycor's `std.err = TRUE`). Without `ML`, the correlation is the maximum-likelihood one given the two-step
     * thresholds. Default `false`.
     */
    stdErr?: boolean;
}
/** Result of {@link polychor} with `stdErr`. */
export interface PolychorStdErrResult extends PolycorResult {
    /**
     * Variances and covariances of the estimates (the inverse of the negative Hessian of the log-likelihood at the
     * maximum), in the order rho, the row thresholds, the column thresholds; 1 × 1 (rho alone) without `ML`.
     */
    var: number[][];
    /** Chi-square statistic of the test of bivariate normality. */
    chisq: number;
    /** Its degrees of freedom, r c − r − c. */
    df: number;
    /** The number of observations (the total of the table). */
    n: number;
    /** The row thresholds (the estimates with `ML`, the two-step ones otherwise). */
    rowCuts: number[];
    /** The column thresholds. */
    colCuts: number[];
}
/** Result of {@link polyserial} with `stdErr`. */
export interface PolyserialStdErrResult extends PolycorResult {
    /** Variances and covariances of the estimates, in the order rho, the thresholds; 1 × 1 (rho alone) without `ML`. */
    var: number[][];
    /** Chi-square statistic of the test of bivariate normality (polycor's, on a binned table). */
    chisq: number;
    /** Its degrees of freedom, 3 s − 1 for s categories. */
    df: number;
    /** The number of observations used. */
    n: number;
    /** The thresholds of the ordinal variable (the estimates with `ML`, the two-step ones otherwise). */
    cuts: number[];
}
type Table = readonly (readonly number[])[];
/**
 * Polychoric correlation of two ordinal variables. By default the two-step estimate: thresholds from the margins,
 * then the maximum-likelihood correlation given them. Equivalent to polycor's `polychor(x, y)` or `polychor(table)`.
 *
 * Given `x` and `y`, the table has the sorted distinct values of `x` as rows and those of `y` as columns (pairs with
 * a missing value are not counted). Rows and columns with a zero margin are removed with a warning; with fewer than
 * two rows or columns left, `rho` is `NaN` (and the result has no other fields).
 *
 * With `ML`, the correlation and the thresholds are estimated together by maximum likelihood; with `stdErr`, the
 * result also has their variances, the chi-square test of bivariate normality and the thresholds (with `stdErr`
 * alone, the correlation is maximised given the two-step thresholds). The exact maximum is returned (R's optimisers
 * stop about 1e-4 short of it). If the likelihood increases up to |rho| = 0.9999, `rho` is ±0.9999 with a warning.
 *
 * @param table - A contingency table (array of rows of counts).
 * @param options - `ML` and `stdErr` (see {@link PolycorOptions}).
 *
 * @example
 * ```ts
 * polychor([[20, 8, 1], [5, 30, 9], [2, 6, 25]]).rho; // 0.785882312445335
 * polychor([[20, 8, 1], [5, 30, 9], [2, 6, 25]], { ML: true }).rho; // 0.7911463316235798
 * ```
 */
export declare function polychor(table: Table, options: PolycorOptions & {
    stdErr: true;
}): PolychorStdErrResult;
export declare function polychor(table: Table, options?: PolycorOptions): PolycorResult;
/**
 * Polychoric correlation of two ordinal variables given as vectors of category codes (see the table form).
 *
 * @param x - Categories of the first variable.
 * @param y - Categories of the second variable, the same length.
 * @param options - `ML` and `stdErr` (see {@link PolycorOptions}).
 */
export declare function polychor(x: readonly number[], y: readonly number[], options: PolycorOptions & {
    stdErr: true;
}): PolychorStdErrResult;
export declare function polychor(x: readonly number[], y: readonly number[], options?: PolycorOptions): PolycorResult;
/**
 * Polyserial correlation of a numeric variable and an ordinal one. By default the two-step (ad hoc) estimate.
 * Equivalent to polycor's `polyserial(x, y)`.
 *
 * Pairs with a missing value are dropped. The categories of `y` are its sorted distinct values, coded 1, 2, ...;
 * with fewer than two, `rho` is `NaN` (and the result has no other fields). A two-step estimate beyond ±0.9999 is set
 * to ±0.9999 with a warning.
 *
 * With `ML`, the correlation and the thresholds are estimated together by maximum likelihood; with `stdErr`, the
 * result also has their variances, polycor's chi-square test of bivariate normality and the thresholds (with `stdErr`
 * alone, the correlation is maximised given the two-step thresholds). The exact maximum is returned (R's optimisers
 * stop about 1e-4 short of it). If the likelihood increases up to |rho| = 0.9999, `rho` is ±0.9999 with a warning.
 *
 * @param x - The numeric variable.
 * @param y - Categories of the ordinal variable, the same length.
 * @param options - `ML` and `stdErr` (see {@link PolycorOptions}).
 *
 * @example
 * ```ts
 * polyserial([0.2, -1.1, 0.8, 1.5, -0.3, 0.1, -0.9, 2.0], [1, 1, 2, 3, 2, 2, 1, 2]).rho; // 0.8085111526489707
 * ```
 */
export declare function polyserial(x: readonly number[], y: readonly number[], options: PolycorOptions & {
    stdErr: true;
}): PolyserialStdErrResult;
export declare function polyserial(x: readonly number[], y: readonly number[], options?: PolycorOptions): PolycorResult;
export {};
