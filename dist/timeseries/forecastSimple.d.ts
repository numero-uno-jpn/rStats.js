import { type EtsResult } from "./ets.js";
/**
 * A forecast with intervals and the in-sample fit.
 *
 * @category Time series
 */
export interface SimpleForecast {
    mean: number[];
    lower: number[][];
    upper: number[][];
    level: number[];
    fitted: number[];
    residuals: number[];
    method: string;
    /** The ets model behind ses / holt / hw / stlf. */
    model?: EtsResult;
}
/**
 * Forecasts by the mean (forecast's `meanf()`): intervals mean +- qt(level, n - 1) sd(y) sqrt(1 + 1/n).
 * Equivalent to `forecast::meanf()` in R.
 *
 * @category Time series
 */
export declare function meanf(y: readonly number[], options?: {
    h?: number;
    level?: readonly number[];
}): SimpleForecast;
/**
 * Random walk forecasts (forecast's `rwf()`), with a drift (y_n - y_1)/(n - 1) when `drift`. sigma = sqrt(mean(res^2))
 * without a drift, sd(res) with one; se_h = sigma sqrt(h) or sigma sqrt(h (1 + h/(n - 1))).
 * Equivalent to `forecast::rwf()` in R.
 *
 * @category Time series
 */
export declare function rwf(y: readonly number[], options?: {
    h?: number;
    drift?: boolean;
    level?: readonly number[];
    lag?: number;
}): SimpleForecast;
/**
 * Naive forecasts (forecast's `naive()`): {@link rwf} without a drift. Equivalent to `forecast::naive()` in R.
 *
 * @category Time series
 */
export declare function naive(y: readonly number[], options?: {
    h?: number;
    level?: readonly number[];
}): SimpleForecast;
/**
 * Seasonal naive forecasts (forecast's `snaive()`): y_{n - m + ...}, se_h = sigma sqrt(floor((h - 1)/m) + 1). Equivalent to `forecast::snaive()` in R.
 *
 * @category Time series
 */
export declare function snaive(y: readonly number[], options: {
    frequency: number;
    h?: number;
    level?: readonly number[];
}): SimpleForecast;
/**
 * Simple exponential smoothing (forecast's `ses()`): ets(y, "ANN"), or with `initial: "simple"` the level started at
 * y_1 and alpha minimising the one-step SSE.
 * Equivalent to `forecast::ses()` in R.
 *
 * @category Time series
 */
export declare function ses(y: readonly number[], options?: {
    h?: number;
    level?: readonly number[];
    initial?: "optimal" | "simple";
    alpha?: number;
}): SimpleForecast;
/**
 * Holt's linear trend method (forecast's `holt()`): ets AAN (AAdN damped, MMN exponential); `initial: "simple"`
 * starts at l = y_1, b = y_2 - y_1.
 * Equivalent to `forecast::holt()` in R.
 *
 * @category Time series
 */
export declare function holt(y: readonly number[], options?: {
    h?: number;
    level?: readonly number[];
    damped?: boolean;
    exponential?: boolean;
    initial?: "optimal" | "simple";
}): SimpleForecast;
/**
 * Holt-Winters seasonal method (forecast's `hw()`): ets AAA or MAM (damped: AAdA, MAdM); `initial: "simple"` starts at
 * l = mean(y[1:m]), b = (mean(y[m+1:2m]) - mean(y[1:m]))/m, s = y[1:m] - l (or / l).
 * Equivalent to `forecast::hw()` in R.
 *
 * @category Time series
 */
export declare function hw(y: readonly number[], options: {
    frequency: number;
    h?: number;
    level?: readonly number[];
    seasonal?: "additive" | "multiplicative";
    damped?: boolean;
    initial?: "optimal" | "simple";
}): SimpleForecast;
/**
 * The theta method (forecast's `thetaf()`): a seasonality test |r_m| > qnorm(0.95) sqrt((1 + 2 sum_{i<m} r_i^2)/n), a
 * multiplicative decompose when seasonal, ses by MSE, mean = ses mean + b/2 (h - 1 + 1/alpha - (1 - alpha)^n / alpha)
 * with b the slope of lm(y ~ t), reseasonalised. Departs from R when seasonal: the interval bounds are reseasonalised
 * (R adds the adjusted-scale width to the reseasonalised mean) and the residuals are y - fitted (R's are on the
 * adjusted scale); the user's decision, log 91-92.
 * Equivalent to `forecast::thetaf()` in R.
 *
 * @category Time series
 */
export declare function thetaf(y: readonly number[], options?: {
    frequency?: number;
    h?: number;
    level?: readonly number[];
}): SimpleForecast;
/**
 * Croston's method for intermittent demand (forecast's `croston()`): SES with alpha on the non-zero demands and on the
 * intervals between them (counted from time 0), each started at its first value; forecast k z / p with k = 1 (croston),
 * 1 - alpha/2 (sba) or 1 - alpha/(2 - alpha) (sbj). No intervals. Departs from R when the last observation is a
 * demand: R's forecast is the state before it (the last fitted value, the last observation unused; log 91), rStats.js
 * forecasts from the state after it.
 * Equivalent to `forecast::croston()` in R.
 *
 * @category Time series
 */
export declare function croston(y: readonly number[], options?: {
    h?: number;
    alpha?: number;
    type?: "croston" | "sba" | "sbj";
}): {
    mean: number[];
    fitted: number[];
    method: string;
};
/**
 * STL + ETS forecasts (forecast's `stlf()`): mstl(y), forecast(ets(seasonally adjusted, "ZZN")), plus the last cycle of
 * the seasonal component repeated.
 * Equivalent to `forecast::stlf()` in R.
 *
 * @category Time series
 */
export declare function stlf(y: readonly number[], options: {
    frequency: number;
    h?: number;
    level?: readonly number[];
}): SimpleForecast;
/**
 * Result of {@link tslm}.
 *
 * @category Time series
 */
export interface TslmResult {
    coefficients: number[];
    coefficientNames: string[];
    fitted: number[];
    residuals: number[];
    /** Forecasts with t intervals from the regression. */
    forecast: (h: number, level?: readonly number[]) => {
        mean: number[];
        lower: number[][];
        upper: number[][];
        level: number[];
    };
}
/**
 * Linear regression on a trend (1..n) and seasonal dummies (forecast's `tslm(y ~ trend + season)`), the first season
 * the baseline.
 * Equivalent to `forecast::tslm()` in R.
 *
 * @category Time series
 */
export declare function tslm(y: readonly number[], options?: {
    frequency?: number;
    trend?: boolean;
    season?: boolean;
}): TslmResult;
