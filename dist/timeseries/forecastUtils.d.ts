import { type MstlResult } from "./stl.js";
import type { ArimaResult } from "./arima.js";
/**
 * One row of {@link accuracy}.
 *
 * @category Time series
 */
export interface AccuracyRow {
    ME: number;
    RMSE: number;
    MAE: number;
    MPE: number;
    MAPE: number;
    MASE: number;
    ACF1: number;
    TheilU?: number;
}
/**
 * Accuracy measures (forecast's `accuracy()`): ME, RMSE, MAE, MPE, MAPE, MASE (scaled by the training data's mean
 * |y_t - y_{t-m}|), ACF1 of the errors; for a test set also Theil's U.
 * Equivalent to `forecast::accuracy()` in R.
 *
 * @category Time series
 */
export declare function accuracy(training: {
    y: readonly number[];
    fitted: readonly number[];
}, options?: {
    frequency?: number;
    test?: {
        y: readonly number[];
        forecast: readonly number[];
    };
}): {
    training: AccuracyRow;
    test?: AccuracyRow;
};
/**
 * Moving-average smoother (forecast's `ma()`): order k, centred (a 2 x k average) for even k when `centre`. Equivalent to `forecast::ma()` in R.
 *
 * @category Time series
 */
export declare function ma(x: readonly number[], order: number, options?: {
    centre?: boolean;
}): number[];
/**
 * Fourier terms (forecast's `fourier()`): S_k = sin(2 pi k t / m), C_k = cos(2 pi k t / m) for k = 1..K, t = 1..n (or
 * n + 1..n + h), the sine dropped at k = m / 2; columns named "S1-12", "C1-12", ...
 * Equivalent to `forecast::fourier()` in R.
 *
 * @category Time series
 */
export declare function fourier(options: {
    frequency: number;
    K: number;
    n: number;
    h?: number;
}): {
    names: string[];
    columns: number[][];
};
/**
 * Seasonal dummies (forecast's `seasonaldummy()`): m - 1 columns, the last period omitted; `start` the cycle position (1-based) of the first row. Equivalent to `forecast::seasonaldummy()` in R.
 *
 * @category Time series
 */
export declare function seasonaldummy(options: {
    frequency: number;
    n: number;
    start?: number;
    h?: number;
}): number[][];
/**
 * Days in each month or quarter (forecast's `monthdays()`). Equivalent to `forecast::monthdays()` in R.
 *
 * @category Time series
 */
export declare function monthdays(options: {
    startYear: number;
    startPeriod?: number;
    n: number;
    frequency?: 12 | 4;
}): number[];
/**
 * Easter Sunday of year Y (anonymous Gregorian algorithm) as [month, day]. Not an R function.
 *
 * @category Time series
 */
export declare function easterSunday(Y: number): [number, number];
/**
 * The Easter holidays in each month or quarter (forecast's `easter()`): the share of Good Friday .. Easter Sunday (..
 * Monday with `easterMon`) falling in the period, rounded to two decimals (as R). Departs from R for quarterly data
 * with `easterMon` when the holidays span two quarters: R's shares are shifted there (it warns about a replacement
 * length; log 91), rStats.js gives each quarter its share.
 * Equivalent to `forecast::easter()` in R.
 *
 * @category Time series
 */
export declare function easter(options: {
    startYear: number;
    startPeriod?: number;
    n: number;
    frequency?: 12 | 4;
    easterMon?: boolean;
}): number[];
/**
 * Trading days in each month or quarter (forecast's `bizdays()`): weekdays minus the holidays of the financial centre
 * ("New York" (NYSE, default), "London", "NERC", "Toronto", "Zurich"; the rules of log 30-32).
 * Equivalent to `forecast::bizdays()` in R.
 *
 * @category Time series
 */
export declare function bizdays(options: {
    startYear: number;
    startPeriod?: number;
    n: number;
    frequency?: 12 | 4;
    finCenter?: "New York" | "London" | "NERC" | "Toronto" | "Zurich";
}): number[];
/**
 * The Diebold-Mariano test with the Harvey-Leybourne-Newbold correction (forecast's `dm.test()`): d = |e1|^power -
 * |e2|^power, its variance from the autocovariances up to h - 1 (over n), t(n - 1).
 * Equivalent to `forecast::dm.test()` in R.
 *
 * @category Time series
 */
export declare function dmTest(e1: readonly number[], e2: readonly number[], options?: {
    alternative?: "two.sided" | "less" | "greater";
    h?: number;
    power?: number;
}): {
    statistic: number;
    parameter: number;
    pValue: number;
};
/**
 * Cross-validation and information criteria of a linear model (forecast's `CV()`): CV = mean((e / (1 - h_ii))^2), AIC =
 * n log(SSE/n) + 2(k + 2), AICc, BIC, adjusted R^2 (k = the number of predictors).
 * Equivalent to `forecast::CV()` in R.
 *
 * @category Time series
 */
export declare function cvLm(x: readonly (readonly number[])[], y0: readonly number[]): {
    CV: number;
    AIC: number;
    AICc: number;
    BIC: number;
    AdjR2: number;
};
/**
 * The Ljung-Box test of a model's residuals (forecast's `checkresiduals()`, without the plots): lag = min(2m, n/5) for
 * seasonal data or min(10, n/5), at least df + 3, df = the number of ARMA coefficients (0 for plain residuals).
 * Equivalent to `forecast::checkresiduals()` in R.
 *
 * @category Time series
 */
export declare function checkresiduals(residuals: readonly number[], options?: {
    frequency?: number;
    df?: number;
}): {
    statistic: number;
    parameter: number;
    pValue: number;
    lag: number;
};
/** The number of ARMA coefficients of a fit (for checkresiduals' df). */
export declare function armaCoefficients(fit: ArimaResult): number;
/**
 * Time series cross-validation (forecast's `tsCV()`): for each origin t the forecast errors of y_{t+1..t+h} from the fit
 * to y_1..y_t, stored in row t (NaN where unavailable).
 * Equivalent to `forecast::tsCV()` in R.
 *
 * @category Time series
 */
export declare function tsCV(y: readonly number[], forecastFun: (y: number[], h: number) => readonly number[], options?: {
    h?: number;
}): number[][];
/**
 * The (p, d, q) or (p, d, q, P, D, Q, frequency) of an ARIMA fit (forecast's `arimaorder()`). Equivalent to `forecast::arimaorder()` in R.
 *
 * @category Time series
 */
export declare function arimaorder(fit: ArimaResult): Record<string, number>;
/**
 * The AR spectrum (stats' `spec.ar()` at n.freq frequencies 0..0.5) of x: var.pred / |1 - sum a_k e^{-2 pi i f k}|^2. Equivalent to R's `spec.ar()`.
 *
 * @category Time series
 */
export declare function specAr(x: readonly number[], options?: {
    nFreq?: number;
}): {
    freq: number[];
    spec: number[];
    order: number;
};
/**
 * The dominant period of a series (forecast's `findfrequency()`): 1 unless the maximum of the AR spectrum of the
 * detrended series exceeds 10; then round(1 / f) at the maximum, or, when the maximum is at the lowest frequency, at
 * the largest value after the spectrum first rises (1 if that is the last frequency).
 * Equivalent to `forecast::findfrequency()` in R.
 *
 * @category Time series
 */
export declare function findfrequency(x: readonly number[]): number;
/**
 * Interpolation of missing values (forecast's `na.interp()`): linear for non-seasonal series (or at most two periods
 * observed); for seasonal series the seasonal component of a robust mstl of a first filling (lm on Fourier terms K =
 * min(5, floor(m/2)) and a polynomial of degree min(6, floor(n/10))), the seasonally adjusted series interpolated
 * linearly.
 * Equivalent to `forecast::na.interp()` in R.
 *
 * @category Time series
 */
export declare function naInterp(x: readonly number[], options?: {
    frequency?: number;
}): number[];
/**
 * Outliers and their replacements (forecast's `tsoutliers()`): the remainder of seasadj(robust mstl) minus supsmu (or x
 * minus supsmu), points outside [Q1 - 3 IQR, Q3 + 3 IQR], replaced by na.interp with them removed; `iterate` passes
 * (default 2), the union of the flags.
 * Equivalent to `forecast::tsoutliers()` in R.
 *
 * @category Time series
 */
export declare function tsoutliers(x: readonly number[], options?: {
    frequency?: number;
    iterate?: number;
}): {
    index: number[];
    replacements: number[];
};
/**
 * The series with missing values interpolated and outliers replaced (forecast's `tsclean()`).
 * Equivalent to `forecast::tsclean()` in R.
 *
 * @category Time series
 */
export declare function tsclean(x: readonly number[], options?: {
    frequency?: number;
    replaceMissing?: boolean;
    iterate?: number;
}): number[];
/**
 * The seasonal component of an {@link mstl} decomposition (forecast's `seasonal()`; zeros without one). Equivalent to `forecast::seasonal()` in R.
 *
 * @category Time series
 */
export declare function seasonalComponent(dec: MstlResult): number[];
/**
 * The trend-cycle component of an {@link mstl} decomposition (forecast's `trendcycle()`). Equivalent to `forecast::trendcycle()` in R.
 *
 * @category Time series
 */
export declare function trendcycle(dec: MstlResult): number[];
/**
 * The remainder component of an {@link mstl} decomposition (forecast's `remainder()`). Equivalent to `forecast::remainder()` in R.
 *
 * @category Time series
 */
export declare function remainder(dec: MstlResult): number[];
