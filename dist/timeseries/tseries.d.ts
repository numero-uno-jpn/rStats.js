/**
 * A test result of the tseries functions.
 *
 * @category Time series
 */
export interface TseriesTest {
    statistic: number;
    parameter: number | number[];
    pValue: number;
    method: string;
}
/**
 * The augmented Dickey-Fuller test (tseries' `adf.test()`): Delta y_t on 1, t, y_{t-1} and k lagged differences
 * (default k = trunc((n - 1)^(1/3))), the t value of y_{t-1}; p from Fuller's tau_tau table at n - 1 (clamped to
 * [0.01, 0.99]); "explosive" gives 1 - p.
 * Equivalent to `tseries::adf.test()` in R.
 *
 * @category Time series
 */
export declare function adfTest(x: readonly number[], options?: {
    alternative?: "stationary" | "explosive";
    k?: number;
}): TseriesTest;
/**
 * The KPSS test (tseries' `kpss.test()`): the null "Level" or "Trend", truncation lag trunc(4 (n/100)^0.25) (`lshort`)
 * or trunc(12 (n/100)^0.25); p interpolated in the KPSS table (clamped to [0.01, 0.10]).
 * Equivalent to `tseries::kpss.test()` in R.
 *
 * @category Time series
 */
export declare function kpssTest(x: readonly number[], options?: {
    null?: "Level" | "Trend";
    lshort?: boolean;
}): TseriesTest;
/**
 * The Phillips-Perron test (tseries' `pp.test()`): y_t on 1, t, y_{t-1}; Phillips and Perron's closed forms with
 * det(X'X) (log 8), type "Z(alpha)" (default, as R) or "Z(t_alpha)", truncation lag trunc(4 (n/100)^0.25) (`lshort`)
 * or trunc(12 (n/100)^0.25); p from Fuller's n(rho - 1) or tau_tau table at n - 1; "explosive" gives 1 - p.
 * Equivalent to `tseries::pp.test()` in R.
 *
 * @category Time series
 */
export declare function ppTest(x: readonly number[], options?: {
    alternative?: "stationary" | "explosive";
    type?: "Z(alpha)" | "Z(t_alpha)";
    lshort?: boolean;
}): TseriesTest;
/**
 * The Phillips-Ouliaris cointegration test (tseries' `po.test()`): x has 2 to 6 columns (variables) as rows of
 * observations; u = the residuals of the first column on the others (with an intercept when `demean`, default),
 * Z = (n - 1)(rho - 1) - (lambda^2 - s^2) / (2 sum u_{t-1}^2 / (n - 1)^2) from u_t on u_{t-1}; lag trunc((n - 1)/100)
 * (`lshort`) or trunc((n - 1)/30); p from Table Ib / Ia (clamped to [0.01, 0.15]).
 * Equivalent to `tseries::po.test()` in R.
 *
 * @category Time series
 */
export declare function poTest(x: readonly (readonly number[])[], options?: {
    demean?: boolean;
    lshort?: boolean;
}): TseriesTest;
/**
 * The Jarque-Bera test for normality (tseries' `jarque.bera.test()`): n (S^2/6 + (K - 3)^2/24) with the moments over n,
 * chi-squared with 2 df.
 * Equivalent to `tseries::jarque.bera.test()` in R.
 *
 * @category Time series
 */
export declare function jarqueBeraTest(x: readonly number[]): TseriesTest;
/**
 * The Wald-Wolfowitz runs test (tseries' `runs.test()`) of a two-valued sequence: z = (R - mean) / sd with mean 1 +
 * 2 n1 n2 / n and variance 2 n1 n2 (2 n1 n2 - n) / (n^2 (n - 1)), normal p for "two.sided" (default), "less" or
 * "greater".
 * Equivalent to `tseries::runs.test()` in R.
 *
 * @category Time series
 */
export declare function runsTest(x: readonly (boolean | number | string)[], options?: {
    alternative?: "two.sided" | "less" | "greater";
}): TseriesTest;
/**
 * Teraesvirta's neural network test for neglected nonlinearity (tseries' `terasvirta.test()`): y_t on 1 and its lags,
 * then also on the second and third order products of the lags; Chisq = n log(SSR0 / SSR1) (n the series length) or
 * F on (df, n - lag - df) (log 14). The series is standardised when `scale` (default).
 * Equivalent to `tseries::terasvirta.test()` in R.
 *
 * @category Time series
 */
export declare function terasvirtaTest(x: readonly number[], options?: {
    lag?: number;
    type?: "Chisq" | "F";
    scale?: boolean;
}): TseriesTest;
/**
 * White's neural network test for neglected nonlinearity (tseries' `white.test()`): q logistic hidden units with
 * weights runif((lag + 1) q, -range/2, range/2) (by columns, the first row on the constant), their principal components
 * 2..qstar + 1 (standardised), then the statistic as {@link terasvirtaTest} (log 15). The weights come from rStats.js's
 * R-compatible generator: with `seed` (R's `set.seed`) the value equals R's; without, the current stream is used.
 * Equivalent to `tseries::white.test()` in R.
 *
 * @category Time series
 */
export declare function whiteTest(x: readonly number[], options?: {
    lag?: number;
    qstar?: number;
    q?: number;
    range?: number;
    type?: "Chisq" | "F";
    scale?: boolean;
    seed?: number;
}): TseriesTest;
