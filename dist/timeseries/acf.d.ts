/** Kind of autocorrelation statistic returned by acf().
 * @category Time series
 */
export type AcfType = "correlation" | "covariance" | "partial";
/** Policy for missing observations in a time series.
 * @category Time series
 */
export type AcfNaAction = "fail" | "pass";
/** Options for autocorrelation and autocovariance. Equivalent to the arguments of R's stats::acf().
 * @category Time series
 */
export interface AcfOptions {
    /** Statistic to return: correlation, covariance or partial autocorrelation. */
    type?: AcfType;
    /** Maximum non-negative lag to return, in observation units. */
    lagMax?: number;
    /** Whether to subtract the series mean before computing products. */
    demean?: boolean;
    /** Whether missing values cause an error or are omitted pairwise. */
    naAction?: AcfNaAction;
    /** Confidence level used for the white-noise bounds. */
    ci?: number;
}
/** Options for partial autocorrelation. Equivalent to the arguments of R's stats::pacf().
 * @category Time series
 */
export interface PacfOptions {
    /** Maximum positive lag to return, in observation units. */
    lagMax?: number;
    /** Whether missing values cause an error or are omitted pairwise. */
    naAction?: AcfNaAction;
}
/** Options for cross-correlation and cross-covariance. Equivalent to the arguments of R's stats::ccf().
 * @category Time series
 */
export interface CcfOptions {
    /** Statistic to return: correlation or covariance. */
    type?: "correlation" | "covariance";
    /** Maximum absolute lag to return, in observation units. */
    lagMax?: number;
    /** Whether to subtract each series mean before computing products. */
    demean?: boolean;
    /** Whether missing values cause an error or are omitted pairwise. */
    naAction?: AcfNaAction;
    /** Confidence level used for the white-noise bounds. */
    ci?: number;
}
/** Result of an autocorrelation, partial-autocorrelation or cross-correlation calculation.
 * @category Time series
 */
export interface AcfResult {
    /** Integer lags corresponding to the returned values. */
    lag: number[];
    /** Autocorrelation, autocovariance or partial-autocorrelation values at each lag. */
    acf: number[];
    /** Kind of statistic returned. */
    type: AcfType;
    /** Number of observations in the input series. */
    nUsed: number;
    /** White-noise confidence bound for the selected confidence level. */
    clim: number;
}
/**
 * Computes autocorrelation, autocovariance or partial autocorrelation of a univariate series.
 * Equivalent to R's `stats::acf()`.
 * @category Time series
 */
export declare function acf(input: readonly number[] | readonly (readonly number[])[], options?: AcfOptions): AcfResult;
/**
 * Computes partial autocorrelation of a univariate series with the Durbin–Levinson recursion.
 * Equivalent to R's `stats::pacf()`.
 * @category Time series
 */
export declare function pacf(input: readonly number[] | readonly (readonly number[])[], options?: PacfOptions): AcfResult;
/**
 * Computes cross-correlation or cross-covariance of two equal-length series. Lag k pairs x[t+k] with y[t].
 * Equivalent to R's `stats::ccf()`.
 * @category Time series
 */
export declare function ccf(xInput: readonly number[] | readonly (readonly number[])[], yInput: readonly number[] | readonly (readonly number[])[], options?: CcfOptions): AcfResult;
