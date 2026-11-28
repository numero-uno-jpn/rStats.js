import { type ArimaResult } from "./arima.js";
/**
 * Linear filtering of a series (stats' `filter()`): convolution, y_i = sum_j f_j x_{i + o - (j - 1)} with o = 0 for
 * `sides: 1` and floor(p / 2) for `sides: 2` (NaN where an index falls outside, or wrapped with `circular`), or
 * recursive, y_i = x_i + sum_j f_j y_{i - j} with `init` (the most recent value first, as R).
 * Equivalent to R's `filter()`.
 *
 * @category Time series
 */
export declare function tsFilter(x: readonly number[], f: readonly number[], options?: {
    method?: "convolution" | "recursive";
    sides?: 1 | 2;
    circular?: boolean;
    init?: readonly number[];
}): number[];
/**
 * Box-Pierce or Ljung-Box test of white noise (stats' `Box.test()`): r_k the autocorrelations (mean removed, divided by
 * n), Q = n sum r_k^2 or n (n + 2) sum r_k^2 / (n - k), chi-squared on lag - fitdf degrees of freedom.
 * Equivalent to R's `Box.test()`.
 *
 * @category Time series
 */
export declare function boxTest(x: readonly number[], options?: {
    lag?: number;
    type?: "Box-Pierce" | "Ljung-Box";
    fitdf?: number;
}): {
    statistic: number;
    parameter: number;
    pValue: number;
    method: string;
};
/**
 * The inverse of differencing (stats' `diffinv()`): the cumulative sums at the given lag, repeated `differences`
 * times, starting from `xi` (zeros by default).
 * Equivalent to R's `diffinv()`.
 *
 * @category Time series
 */
export declare function diffinv(x: readonly number[], options?: {
    lag?: number;
    differences?: number;
    xi?: readonly number[];
}): number[];
/**
 * Result of {@link decompose}.
 *
 * @category Time series
 */
export interface DecomposeResult {
    x: number[];
    seasonal: number[];
    trend: number[];
    random: number[];
    figure: number[];
    type: "additive" | "multiplicative";
}
/**
 * Classical seasonal decomposition by moving averages (stats' `decompose()`). `start` is the position (1..frequency)
 * of the first observation in the cycle; `figure` starts at that position, as R's.
 * Equivalent to R's `decompose()`.
 *
 * @category Time series
 */
export declare function decompose(x: readonly number[], options: {
    frequency: number;
    type?: "additive" | "multiplicative";
    filter?: readonly number[];
}): DecomposeResult;
/**
 * Result of {@link ar}.
 *
 * @category Time series
 */
export interface ArResult {
    order: number;
    ar: number[];
    varPred: number;
    xMean: number;
    /** ar.ols's intercept (of the demeaned series). */
    xIntercept?: number;
    /** aic minus its minimum, for orders 0..orderMax. */
    aic: number[];
    partialacf?: number[];
    residuals: number[];
    method: string;
    orderMax: number;
    /** The series (for predictions). */
    x: number[];
}
/**
 * Fits an autoregressive model with the order chosen by AIC (stats' `ar()`): Yule-Walker (default), Burg, OLS or MLE
 * (arima0 for each order).
 * Equivalent to R's `ar()`.
 *
 * @category Time series
 */
export declare function ar(x: readonly number[], options?: {
    method?: "yule-walker" | "burg" | "ols" | "mle";
    orderMax?: number;
    aic?: boolean;
    demean?: boolean;
    varMethod?: 1 | 2;
}): ArResult;
/**
 * Predictions from an {@link ar} fit (stats' `predict.ar`): the AR recursion about the mean, se = sqrt(var.pred cumsum(psi^2)). Equivalent to R's `predict()`.
 *
 * @category Time series
 */
export declare function predictAr(fit: ArResult, nAhead?: number): {
    pred: number[];
    se: number[];
};
/**
 * stats' `arima0()`: an ARIMA model by maximum likelihood of the differenced series (no diffuse prior; the mean with
 * `includeMean` when d + D = 0), with R's fast recursions once the prediction variance is within `delta` of its limit
 * (default 0.01, as R; a negative delta gives the exact likelihood, equal to arima's). Log 84, 87.
 * Equivalent to R's `arima0()`.
 *
 * @category Time series
 */
export declare function arima0(x: readonly number[], options?: {
    order?: readonly [number, number, number];
    seasonal?: readonly [number, number, number];
    frequency?: number;
    includeMean?: boolean;
    delta?: number;
}): ArimaResult;
