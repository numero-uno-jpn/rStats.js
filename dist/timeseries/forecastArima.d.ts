import { type ArimaResult } from "./arima.js";
/**
 * The Box-Cox transformation: log(x) for lambda = 0, (sign(x) |x|^lambda - 1) / lambda otherwise. Equivalent to
 * `forecast::BoxCox()` in R.
 *
 * @category Time series
 */
export declare function boxCox(x: readonly number[], lambda: number): number[];
/**
 * The inverse Box-Cox transformation (sign-preserving where lambda z + 1 < 0), with forecast's bias adjustment when
 * `fvar` (the forecast variances on the transformed scale) is given and `biasadj` is true. Equivalent to
 * `forecast::InvBoxCox()` in R.
 *
 * @category Time series
 */
export declare function invBoxCox(z: readonly number[], lambda: number, options?: {
    biasadj?: boolean;
    fvar?: number | readonly number[];
}): number[];
/**
 * Chooses the Box-Cox lambda by Guerrero's method (default) or the profile log-likelihood. Equivalent to
 * `forecast::BoxCox.lambda()` in R.
 *
 * @category Time series
 */
export declare function boxCoxLambda(x: readonly number[], options?: {
    method?: "guerrero" | "loglik";
    lower?: number;
    upper?: number;
    frequency?: number;
}): number;
/**
 * Options of {@link forecastArima}.
 *
 * @category Time series
 */
export interface ForecastArimaOptions {
    order?: readonly [number, number, number];
    seasonal?: readonly [number, number, number];
    frequency?: number;
    xreg?: readonly (readonly number[])[];
    xregNames?: readonly string[];
    includeMean?: boolean;
    includeDrift?: boolean;
    includeConstant?: boolean;
    /** A Box-Cox lambda, or "auto" for {@link boxCoxLambda}. */
    lambda?: number | "auto";
    biasadj?: boolean;
    method?: "CSS-ML" | "ML" | "CSS";
}
/**
 * Result of {@link forecastArima}: stats' fit plus forecast's quantities.
 *
 * @category Time series
 */
export interface ForecastArimaResult extends ArimaResult {
    /** forecast's innovations variance: sum of squared residuals / (nobs - number of coefficients). */
    sigma2: number;
    /** stats' MLE of the innovations variance. */
    sigma2Mle: number;
    aicc: number;
    bic: number;
    lambda: number | null;
    biasadj: boolean;
    /** Fitted values on the original scale. */
    fitted: number[];
    /** The series on the original scale. */
    series: number[];
    /** Whether a drift column was added (the last regressor). */
    drift: boolean;
}
/**
 * Fits an ARIMA model as forecast's `Arima()`: stats' arima on the Box-Cox transformed series, with a drift, and
 * forecast's innovations variance, AICc and BIC.
 * Equivalent to `forecast::Arima()` in R.
 *
 * @category Time series
 */
export declare function forecastArima(y: readonly number[], options?: ForecastArimaOptions): ForecastArimaResult;
/** forecastArima with all coefficients fixed (autoArima's exact fits, log 108). Not exported from the entries. */
export declare function forecastArimaFixed(y: readonly number[], options: ForecastArimaOptions, fixed: readonly number[]): ForecastArimaResult;
/**
 * Result of {@link forecast}.
 *
 * @category Time series
 */
export interface ForecastResult {
    mean: number[];
    lower: number[][];
    upper: number[][];
    level: number[];
    method: string;
    /** Forecast standard errors on the transformed scale (where analytic). */
    se?: number[];
}
/**
 * Point forecasts and prediction intervals from a {@link forecastArima} fit (forecast's `forecast.Arima()`).
 * Equivalent to `forecast::forecast()` in R.
 *
 * @category Time series
 */
export declare function forecastFromArima(fit: ForecastArimaResult, options?: {
    h?: number;
    level?: readonly number[];
    xreg?: readonly (readonly number[])[];
    biasadj?: boolean;
}): ForecastResult;
/**
 * The KPSS statistic with a given truncation lag (residuals on 1, or on 1 and t). Not an R function.
 *
 * @category Time series
 */
export declare function kpssStatistic(x: readonly number[], type: "level" | "trend", lag: number): number;
/**
 * The KPSS table's p-value, linear in the statistic between the 10%, 5%, 2.5%, 1% points, clamped to [0.01, 0.10]. Not an R function.
 *
 * @category Time series
 */
export declare function kpssPValue(stat: number, type: "level" | "trend"): number;
/**
 * The Phillips-Perron Z(t_alpha) with a constant (y_t on 1, y_{t-1}), lag trunc(4 (n/100)^0.25). Phillips and Perron's
 * form with the lagged level in the sum of squares and det(X'X). R's ndiffs uses urca's ur.pp, which takes the current
 * y_t there (an implementation error, log 88, 90; the user's policy: not imitated), up to 0.05 off in the statistic.
 */
export declare function ppStatisticConst(y: readonly number[], type: "level" | "trend"): number;
/**
 * The number of first differences needed for stationarity by a unit root test. Equivalent to `forecast::ndiffs()` in R.
 *
 * @category Time series
 */
export declare function ndiffs(x: readonly number[], options?: {
    alpha?: number;
    test?: "kpss" | "adf" | "pp";
    type?: "level" | "trend";
    maxD?: number;
}): number;
