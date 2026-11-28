import type { ArimaResult } from "./arima.js";
import { type EtsResult } from "./ets.js";
import { type ForecastArimaResult } from "./forecastArima.js";
import { type HoltWintersResult } from "./holtWinters.js";
import { type ArResult } from "./statsTs.js";
import { type MstlResult } from "./stl.js";
/**
 * Result of {@link stlm}.
 *
 * @category Time series
 */
export interface StlmResult {
    kind: "stlm";
    /** The decomposition of the (Box-Cox transformed) series. */
    stl: MstlResult;
    /** The model of the seasonally adjusted series. */
    model: EtsResult | ForecastArimaResult;
    /** The seasonally adjusted series (transformed scale). */
    adjusted: number[];
    /** The in-sample fit on the original scale. */
    fitted: number[];
    residuals: number[];
    frequency: number;
    lambda: number | null;
    biasadj: boolean;
}
/**
 * A forecast of {@link forecast}.
 *
 * @category Time series
 */
export interface ForecastOutput {
    mean: number[];
    lower: number[][];
    upper: number[][];
    level: number[];
    method: string;
}
/**
 * STL decomposition with a model of the seasonally adjusted series (forecast's `stlm()`): mstl of the series (Box-Cox
 * transformed with `lambda`), then `ets(adjusted, etsModel)` (default "ZZN") or, with `method: "arima"`,
 * `auto.arima(adjusted, seasonal = FALSE)` (log 93: R's model has no seasonal part).
 * Equivalent to `forecast::stlm()` in R.
 *
 * @category Time series
 */
export declare function stlm(y: readonly number[], options: {
    frequency: number;
    method?: "ets" | "arima";
    etsModel?: string;
    sWindow?: number | "periodic";
    robust?: boolean;
    lambda?: number;
    biasadj?: boolean;
}): StlmResult;
/**
 * Forecasts from an {@link stlm} fit (forecast's `forecast.stlm()`): the model's forecasts of the seasonally adjusted
 * series plus the last cycle of the seasonal component, back-transformed with the fit's lambda.
 * Equivalent to `forecast::forecast()` in R.
 *
 * @category Time series
 */
export declare function forecastStlm(fit: StlmResult, options?: {
    h?: number;
    level?: readonly number[];
}): ForecastOutput;
/**
 * Forecasts from a series or a fitted model (forecast's `forecast()`):
 * - a series (`frequency` in the options): ets, or stlf when the period is 13 or more and the series is longer than
 *   two periods (forecast's help; log 93);
 * - an {@link ets} fit, a {@link forecastArima} / {@link autoArima} fit, a stats {@link arima} fit (with its MLE
 *   innovations variance), an {@link stlm} fit, a {@link holtWinters} fit (stats' prediction intervals) or an
 *   {@link ar} fit (normal intervals from the prediction standard errors).
 * `h` defaults to twice the period for seasonal data, else 10.
 * Equivalent to `forecast::forecast()` in R.
 *
 * @category Time series
 */
export declare function forecast(object: readonly number[] | EtsResult | ForecastArimaResult | ArimaResult | StlmResult | HoltWintersResult | ArResult, options?: {
    h?: number;
    level?: readonly number[];
    frequency?: number;
}): ForecastOutput;
