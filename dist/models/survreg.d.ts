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
    /** Degrees of freedom of the t distribution (default 4, at least 3); `parms` is the same, as R names it (give one). */
    df?: number;
    /** R's name for `df`: the degrees of freedom of the t distribution (give one of the two). */
    parms?: number;
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
    /** The regression coefficients (intercept first when present). */
    coefficients: number[];
    /** Their names. */
    coefNames: string[];
    /** The scale of each stratum (fixed or estimated). */
    scale: number[];
    /** The summary table: coefficients and log scales with standard errors, z and p. */
    table: SurvregTable;
    /** The levels of the strata. */
    strataLevels: (string | number | boolean)[];
    /** Whether an offset was given. */
    hasOffset: boolean;
    /** The intercept-only model's intercept and log scale. */
    icoef: number[];
    /** Covariance of the coefficients and log scales. */
    var: number[][];
    /** Log-likelihoods of the intercept-only model and of the model. */
    loglik: [number, number];
    /** Iterations. */
    iter: number;
    /** Degrees of freedom of the model (coefficients and estimated scales). */
    df: number;
    /** Degrees of freedom of the intercept-only model. */
    idf: number;
    /** Residual degrees of freedom. */
    dfResidual: number;
    /** Observations used. */
    n: number;
    /** Linear predictors of the observations used. */
    linearPredictors: number[];
    /** Means of the columns of the model matrix. */
    means: number[];
    /** The score at the estimates. */
    score: number[];
    /** Row names of the table: the coefficients, then Log(scale) or the strata. */
    tableRowNames: string[];
    /** Estimates of the table's rows. */
    value: number[];
    /** Their standard errors. */
    se: number[];
    /** Their z statistics. */
    z: number[];
    /** Their p-values. */
    p: number[];
    /** Likelihood-ratio statistic of the model against the intercept-only model. */
    chi: number;
    /** Its degrees of freedom. */
    chiDf: number;
    /** Its p-value. */
    chiP: number;
    /** The distribution. */
    dist: SurvregDistribution;
    /** Degrees of freedom of the t distribution. */
    distributionDf: number;
    /** The distribution's parameter (R's `parms`). */
    parms: number;
    /** Whether the model has an intercept. */
    intercept: boolean;
    /** The model matrix of the observations used. */
    x: number[][];
    /** Offsets of the observations used. */
    offset: number[];
    /** 0-based indices of the observations used. */
    rows: number[];
    /** Weights of the observations used. */
    weights: number[];
    /** Stratum of each observation used (0-based). */
    strata: number[];
    /** Response on the scale of the distribution (log time for the log distributions). */
    y: number[];
    /** Lower ends of the observations on that scale. */
    lower: number[];
    /** Upper ends. */
    upper: number[];
    /** Censoring status (0 right, 1 exact, 2 left, 3 interval). */
    status: number[];
    /** The type of the survival data. */
    type: SurvregType;
    /** Warnings. */
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
