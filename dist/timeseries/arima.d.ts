/**
 * Seasonal part of an ARIMA model.
 *
 * @category Time series
 */
export interface ArimaSeasonal {
    /** (P, D, Q). Default [0, 0, 0]. */
    order?: readonly [number, number, number];
    /** The period. Default the series' frequency. */
    period?: number;
}
/**
 * Options of {@link arima}.
 *
 * @category Time series
 */
export interface ArimaOptions {
    /** (p, d, q). Default [0, 0, 0]. */
    order?: readonly [number, number, number];
    /** The seasonal part (an order, or an order and a period). */
    seasonal?: ArimaSeasonal | readonly [number, number, number];
    /** The series' frequency (the seasonal period by default). Default 1. */
    frequency?: number;
    /** Regressors: one array per regressor, each of the series' length. */
    xreg?: readonly (readonly number[])[];
    /** Names of the regressors. Default "xreg1", "xreg2", ... (or "xreg" for one). */
    xregNames?: readonly string[];
    /** Include a mean (ignored when differenced). Default true. */
    includeMean?: boolean;
    /** Transform the AR parameters to stationarity during the ML optimisation. Default true. */
    transformPars?: boolean;
    /** Fixed values (NaN for the free ones), in the order of the coefficients. */
    fixed?: readonly number[];
    /** Starting values (NaN filled by defaults). */
    init?: readonly number[];
    /** "CSS-ML" (default), "ML" or "CSS". */
    method?: "CSS-ML" | "ML" | "CSS";
    /** Initial observations ignored by CSS (at least the AR lags). */
    nCond?: number;
    /** Prior variance multiple of the presample values in a differenced model. Default 1e6. */
    kappa?: number;
    /** "R" (default): the variance matrix from R's numerical Hessian (agrees with R); "exact": a converged Hessian. */
    hessian?: "R" | "exact";
}
/**
 * The state space model behind a fit, for forecasting.
 *
 * @category Time series
 */
export interface ArimaStateModel {
    phi: number[];
    theta: number[];
    delta: number[];
    /** Filtered state and covariance at the end of the series (in units of sigma2). */
    a: number[];
    P: number[][];
}
/**
 * Result of {@link arima}.
 *
 * @category Time series
 */
export interface ArimaResult {
    /** The coefficients (AR, MA, seasonal AR, seasonal MA, intercept, regressors). */
    coef: number[];
    /** Their names (ar1, ma1, sar1, sma1, intercept, regressor names). */
    coefNames: string[];
    /** The MLE of the innovations variance (CSS: the mean of the squared CSS residuals). */
    sigma2: number;
    /** The variance matrix of the free coefficients (rows and columns as `coefNames` of the free ones). */
    varCoef: number[][];
    /** The maximised log-likelihood of the differenced data (CSS: R's approximation). */
    loglik: number;
    /** -2 loglik + 2 (free coefficients + 1); NaN for CSS. */
    aic: number;
    /** (p, q, P, Q, period, d, D). */
    arma: [number, number, number, number, number, number, number];
    /** The fitted innovations (standardised one-step errors; NaN at missing values). */
    residuals: number[];
    /** "CSS-ML", "ML" or "CSS". */
    method: "CSS-ML" | "ML" | "CSS";
    /** Initial observations not used by CSS. */
    nCond: number;
    /** The number of observations used in the likelihood. */
    nobs: number;
    /** The optimiser's convergence code (0 = converged). */
    code: number;
    /** Mask of the free coefficients. */
    mask: boolean[];
    /** The state space model at the end of the series. */
    model: ArimaStateModel;
    /** The series (as given). */
    x: number[];
    /** The regressors (as given), including no intercept column. */
    xreg: number[][];
    /** Whether a mean was included. */
    includeMean: boolean;
}
/** The full AR and MA coefficients (lags 1..) from the non-seasonal and seasonal ones. */
export declare function expandArma(ar: readonly number[], ma: readonly number[], sar: readonly number[], sma: readonly number[], s: number): {
    phi: number[];
    theta: number[];
};
/**
 * The roots' smallest modulus of 1 + c_1 z + ... + c_k z^k (Infinity for a constant). Not an R function.
 *
 * @category Time series
 */
export declare function minRootModulus(c: readonly number[]): number;
export declare function stationaryCovariance(phi: readonly number[], theta: readonly number[], r: number): number[][];
/**
 * Fits an ARIMA model by exact maximum likelihood (Kalman filter) or conditional sum of squares. Equivalent to R's
 * `arima()`. The estimates are taken to the optimum, where R's optimiser may stop slightly short.
 *
 * @example
 * ```ts
 * // R's lh (48 luteinizing hormone measurements)
 * const lh = [2.4, 2.4, 2.4, 2.2, 2.1, 1.5, 2.3, 2.3, 2.5, 2.0, 1.9, 1.7, 2.2, 1.8, 3.2, 3.2, 2.7, 2.2, 2.2, 1.9, 1.9, 1.8, 2.7, 3.0,
 *   2.3, 2.0, 2.0, 2.9, 2.9, 2.7, 2.7, 2.3, 2.6, 2.4, 1.8, 1.7, 1.5, 1.4, 2.1, 3.3, 3.5, 3.5, 3.1, 2.6, 2.1, 3.4, 3.0, 2.9];
 * const fit = arima(lh, { order: [1, 0, 0] });
 * fit.coef; // [0.5739243884, 2.413285608] (ar1, intercept; the last digits differ between platforms' math libraries)
 * ```
 *
 * @category Time series
 */
export declare function arima(xIn: readonly number[], options?: ArimaOptions): ArimaResult;
/** The fit of x / c on the scale of x (the regression coefficients, the state, sigma2 and the likelihood). */
export declare function unscaleArima(fs: ArimaResult, c: number, x: number[]): ArimaResult;
/** Records that `r` is the fit `fs` (of the series / c) mapped back: forecasts are then made from `fs`. */
export declare function registerScaledArima(r: object, fs: ArimaResult, c: number): void;
/** The standardised fit behind `r`, when there is one. */
export declare function scaledArima(r: object): {
    fit: ArimaResult;
    c: number;
} | undefined;
/**
 * Result of {@link predictArima}.
 *
 * @category Time series
 */
export interface PredictArimaResult {
    pred: number[];
    se: number[];
}
/**
 * Forecasts from an {@link arima} fit by the Kalman filter (the exact predictor from the finite past). Equivalent to
 * R's `predict.Arima()`.
 *
 * @category Time series
 */
export declare function predictArima(fit: ArimaResult, nAhead?: number, options?: {
    newxreg?: readonly (readonly number[])[];
    sigma2?: number;
}): PredictArimaResult;
