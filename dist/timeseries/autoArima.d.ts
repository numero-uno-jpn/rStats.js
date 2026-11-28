import { type ForecastArimaResult } from "./forecastArima.js";
/**
 * Options of {@link autoArima}.
 *
 * @category Time series
 */
export interface AutoArimaOptions {
    frequency?: number;
    d?: number;
    D?: number;
    maxP?: number;
    maxQ?: number;
    maxSeasonalP?: number;
    maxSeasonalQ?: number;
    maxOrder?: number;
    maxD?: number;
    maxSeasonalD?: number;
    startP?: number;
    startQ?: number;
    startSeasonalP?: number;
    startSeasonalQ?: number;
    stationary?: boolean;
    seasonal?: boolean;
    ic?: "aicc" | "aic" | "bic";
    stepwise?: boolean;
    nmodels?: number;
    /** Rank the models by their CSS fits (default: n > 150 or frequency > 12), then refit the best without it. */
    approximation?: boolean;
    allowdrift?: boolean;
    allowmean?: boolean;
    lambda?: number | "auto";
    biasadj?: boolean;
    test?: "kpss" | "adf" | "pp";
    seasonalTest?: "seas" | "ocsb";
    alpha?: number;
    xreg?: readonly (readonly number[])[];
    xregNames?: readonly string[];
}
/**
 * One model of the search (forecast's trace).
 *
 * @category Time series
 */
export interface AutoArimaTraceEntry {
    order: [number, number, number];
    seasonal: [number, number, number];
    constant: boolean;
    /** The criterion (Infinity for a rejected or failed fit; the CSS fit's value with approximation). */
    ic: number;
}
/**
 * Result of {@link autoArima}: the chosen model's fit and the search.
 *
 * @category Time series
 */
export interface AutoArimaResult extends ForecastArimaResult {
    trace: AutoArimaTraceEntry[];
}
/**
 * Chooses and fits an ARIMA model by forecast's `auto.arima()` rules: d by {@link ndiffs} (after the seasonal
 * differences), D by {@link nsdiffs}, then the stepwise search on the AICc (or all models up to maxOrder with
 * `stepwise: false`).
 * Equivalent to `forecast::auto.arima()` in R.
 *
 * With approximation, models are ranked by the CSS fits' AICc; R's printed trace adds a constant per series whose origin
 * is not known (it does not change the choice), so the trace values here are the CSS AICc themselves.
 *
 * @category Time series
 */
export declare function autoArima(y: readonly number[], options?: AutoArimaOptions): AutoArimaResult;
