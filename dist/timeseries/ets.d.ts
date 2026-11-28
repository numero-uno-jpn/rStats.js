/** @category Time series */
export type EtsError = "A" | "M";
/** @category Time series */
export type EtsTrend = "N" | "A" | "M";
/** @category Time series */
export type EtsSeason = "N" | "A" | "M";
/**
 * A fully specified ETS model.
 *
 * @category Time series
 */
export interface EtsSpec {
    error: EtsError;
    trend: EtsTrend;
    damped: boolean;
    season: EtsSeason;
    m: number;
}
/**
 * Parameters and initial states in R's order: alpha, beta, gamma, phi, l, b, s0 .. s_{m-2} (s0 the most recent).
 *
 * @category Time series
 */
export interface EtsParameters {
    alpha: number;
    beta?: number;
    gamma?: number;
    phi?: number;
    l: number;
    b?: number;
    s?: number[];
}
interface FilterOut {
    e: number[];
    mu: number[];
    states: number[][];
    lik: number;
    sse: number;
}
/** The filter of table 2.3 given the parameters and initial states (states rows 0..n: l, b, s1..sm). */
export declare function etsFilter(y: readonly number[], spec: EtsSpec, par: EtsParameters): FilterOut;
/** The admissible region (Hyndman et al. 2008, ch. 10): the discount matrix F - g w' of the linear model is stable. */
export declare function admissible(spec: EtsSpec, al: number, be: number, ga: number, ph: number): boolean;
interface FitOut {
    spec: EtsSpec;
    par: EtsParameters;
    filter: FilterOut;
    nParams: number;
}
/**
 * Fits one model by minimising lik (= -2 loglik) within the usual bounds and the admissible region. `bounds: "simple"`
 * is forecast's initial = "simple" (its own Holt-Winters filter, log 91): alpha, beta* = beta / alpha and gamma in
 * [0, 1], no admissibility check.
 */
export declare function fitModel(y: readonly number[], spec: EtsSpec, fixed?: Partial<Record<"alpha" | "beta" | "gamma" | "phi", number>>, fixedInit?: {
    l: number;
    b?: number;
    s?: number[];
}, optCrit?: "lik" | "mse", bounds?: "usual" | "simple", start?: Partial<Record<"alpha" | "beta" | "gamma" | "phi", number>>): FitOut | null;
/**
 * Options of {@link ets}.
 *
 * @category Time series
 */
export interface EtsOptions {
    frequency?: number;
    /** Three letters (error, trend, season) of A, M, N and Z (chosen); default "ZZZ". */
    model?: string;
    /** true / false, or undefined to try both when the trend is chosen. */
    damped?: boolean;
    alpha?: number;
    beta?: number;
    gamma?: number;
    phi?: number;
    additiveOnly?: boolean;
    allowMultiplicativeTrend?: boolean;
    restrict?: boolean;
    ic?: "aicc" | "aic" | "bic";
    lambda?: number;
    biasadj?: boolean;
    nmse?: number;
    /** The estimation criterion: the likelihood (default) or the mean squared one-step error. */
    optCrit?: "lik" | "mse";
}
/**
 * Result of {@link ets}.
 *
 * @category Time series
 */
export interface EtsResult {
    spec: EtsSpec;
    /** "ETS(M,Ad,M)" etc. */
    method: string;
    par: EtsParameters;
    /** Number of estimated parameters (smoothing parameters and initial states). */
    nParams: number;
    loglik: number;
    aic: number;
    bic: number;
    aicc: number;
    sigma2: number;
    mse: number;
    amse: number;
    fitted: number[];
    residuals: number[];
    states: number[][];
    x: number[];
    lambda: number | null;
    biasadj: boolean;
}
/**
 * Exponential smoothing state space model (forecast's `ets()`): one model, or the smallest information criterion
 * among the allowed models for the letters given as "Z". The parameters are estimated to the optimum of the
 * likelihood within the usual bounds and the admissible region (R's optimiser can stop earlier).
 * Equivalent to `forecast::ets()` in R.
 *
 * @category Time series
 */
export declare function ets(y: readonly number[], options?: EtsOptions): EtsResult;
/** Fits a given model with given smoothing parameters and initial states (no estimation): for ses/holt/hw "simple". */
export declare function etsFixedInitial(y: readonly number[], spec: EtsSpec, init: {
    l: number;
    b?: number;
    s?: number[];
}, fixed?: Partial<Record<"alpha" | "beta" | "gamma" | "phi", number>>, optCrit?: "lik" | "mse", bounds?: "usual" | "simple"): EtsResult;
/** The fit at given parameters (no estimation; for checks against R's own estimates). */
export declare function etsAt(y: readonly number[], spec: EtsSpec, par: EtsParameters, nParams: number): EtsResult;
/**
 * Result of {@link forecastEts}.
 *
 * @category Time series
 */
export interface EtsForecast {
    mean: number[];
    lower: number[][];
    upper: number[][];
    level: number[];
    method: string;
    variance?: number[];
}
/**
 * Point forecasts and prediction intervals from an {@link ets} fit (forecast's `forecast.ets()`): the analytic
 * variances of classes 1 and 2, the exact moments of class 3 (MNM, MAM, MAdM), and simulation otherwise (npaths
 * paths with rStats.js's R-compatible generator, seeded by `seed`). Two departures from R's forecast.ets (the
 * model's formulas are used): damped class 3 forecasts use l + phi b at h = 1, and ANA / MNA put the seasonal term
 * of c_j at j mod m = 0.
 * Equivalent to `forecast::forecast()` in R.
 *
 * @category Time series
 */
export declare function forecastEts(fit: EtsResult, options?: {
    h?: number;
    level?: readonly number[];
    npaths?: number;
    seed?: number;
    biasadj?: boolean;
}): EtsForecast;
export {};
