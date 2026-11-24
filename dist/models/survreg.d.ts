/** Built-in parametric distributions supported by {@link survreg}.
 * @category Survival analysis
 */
export type SurvregDistribution = "extreme" | "logistic" | "gaussian" | "weibull" | "exponential" | "rayleigh" | "loggaussian" | "lognormal" | "loglogistic" | "t";
/** Censoring representation accepted by {@link survreg}.
 * @category Survival analysis
 */
export type SurvregType = "right" | "left" | "interval" | "interval2";
/** Iteration controls for {@link survreg}.
 * @category Survival analysis
 */
export interface SurvregControl {
    maxiter?: number;
    relTolerance?: number;
    tolerChol?: number;
}
/** Options for {@link survreg}.
 * @category Survival analysis
 */
export interface SurvregOptions {
    type?: SurvregType;
    time2?: readonly number[];
    dist?: SurvregDistribution;
    weights?: readonly number[];
    offset?: readonly number[];
    strata?: readonly (string | number | boolean)[];
    scale?: number;
    init?: readonly number[];
    df?: number;
    control?: SurvregControl;
    intercept?: boolean;
    confLevel?: number;
}
/** Coefficient and log-scale summary table.
 * @category Survival analysis
 */
export interface SurvregTable {
    value: number[];
    se: number[];
    z: number[];
    p: number[];
}
/** Result of {@link survreg}, including the fitted model data needed by diagnostics.
 * @category Survival analysis
 */
export interface SurvregResult {
    coefficients: number[];
    coefNames: string[];
    scale: number[];
    table: SurvregTable;
    strataLevels: (string | number | boolean)[];
    hasOffset: boolean;
    icoef: number[];
    var: number[][];
    loglik: [number, number];
    iter: number;
    df: number;
    idf: number;
    dfResidual: number;
    n: number;
    linearPredictors: number[];
    means: number[];
    score: number[];
    tableRowNames: string[];
    value: number[];
    se: number[];
    z: number[];
    p: number[];
    chi: number;
    chiDf: number;
    chiP: number;
    dist: SurvregDistribution;
    distributionDf: number;
    parms: number;
    intercept: boolean;
    x: number[][];
    offset: number[];
    rows: number[];
    weights: number[];
    strata: number[];
    y: number[];
    lower: number[];
    upper: number[];
    status: number[];
    type: SurvregType;
    warnings: string[];
}
/** Prediction options for {@link survregPredict}.
 * @category Survival analysis
 */
export interface SurvregPredictOptions {
    type?: "lp" | "linear" | "link" | "response" | "quantile" | "uquantile";
    p?: number | readonly number[];
    newX?: readonly (readonly number[])[];
    newStrata?: readonly (string | number | boolean)[];
    newOffset?: readonly number[];
    seFit?: boolean;
}
/** Predictions and their standard errors.
 * @category Survival analysis
 */
export interface SurvregPredictionResult {
    fit: number[] | number[][];
    seFit?: number[] | number[][];
    warnings: string[];
}
/** Residual options for {@link survregResiduals}.
 * @category Survival analysis
 */
export interface SurvregResidualsOptions {
    type?: "response" | "deviance" | "working" | "dfbeta" | "dfbetas" | "ldcase" | "ldresp" | "ldshape" | "matrix";
    weighted?: boolean;
}
/**
 * Fit a parametric survival regression model. Equivalent to R's `survival::survreg()`.
 *
 * Supports right, left and interval censoring, separate log-scales by stratum, case weights, offsets and the
 * extreme-value, logistic, Gaussian and t families (including their log-time forms).
 *
 * @param time Observed time or lower interval endpoint.
 * @param event Event/status indicator; for interval data use 0=right, 1=exact, 2=left, 3=interval.
 * @param x Predictor matrix (one row per observation); the intercept is added by default.
 * @param options Distribution, censoring, weights, strata, scale, starting values and iteration controls.
 * @returns The fitted coefficients, covariance, likelihoods, score, summary table and data needed for predictions/residuals.
 *
 * @example
 * ```ts
 * const fit = survreg([1, 2, 3, 4, 5, 6], [1, 1, 0, 1, 0, 1], [[0], [1], [0], [1], [0], [1]], { dist: "weibull" });
 * fit.coefficients.length; // 2
 * ```
 *
 * @category Survival analysis
 */
export declare function survreg(time: readonly number[], event?: readonly (number | boolean)[], x?: readonly (readonly number[])[], options?: SurvregOptions): SurvregResult;
/**
 * Predictions from a parametric survival regression fit. Equivalent to R's `predict.survreg()`.
 * @param fit A fit returned by {@link survreg}.
 * @param options Prediction type, quantile probabilities and optional new covariates.
 * @returns Predictions; a matrix is returned for multiple quantiles.
 * @example
 * ```ts
 * const fit = survreg([1, 2, 3, 4, 5], [1, 1, 0, 1, 0], [[0], [1], [0], [1], [0]]);
 * survregPredict(fit, { type: "response" });
 * ```
 * @category Survival analysis
 */
export declare function survregPredict(fit: SurvregResult, options?: SurvregPredictOptions): number[] | number[][] | SurvregPredictionResult;
/**
 * Residuals from a parametric survival regression fit. Equivalent to R's `residuals.survreg()`.
 * @param fit A fit returned by {@link survreg}.
 * @param options Residual type and whether to multiply by case weights.
 * @returns A vector or matrix of residual diagnostics.
 * @example
 * ```ts
 * const fit = survreg([1, 2, 3, 4, 5], [1, 1, 0, 1, 0]);
 * survregResiduals(fit, { type: "working" });
 * ```
 * @category Survival analysis
 */
export declare function survregResiduals(fit: SurvregResult, options?: SurvregResidualsOptions): number[] | number[][];
