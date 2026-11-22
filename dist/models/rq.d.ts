import { type DesignContrast } from "./modelMatrix.js";
import type { DataFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";
/** Algorithm used to fit a quantile-regression model.
 *
 * @category Regression
 */
export type RqMethod = "br" | "fn";
/** Options for {@link rq}.
 *
 * @category Regression
 */
export interface RqOptions {
    /** Quantile probability or probabilities to fit. */
    tau?: number | Sample;
    /** Quantile-regression optimization method. */
    method?: RqMethod;
    /** Nonnegative prior observation weights. */
    weights?: Sample | string;
    /** Contrast coding specifications for factor predictors. */
    contrasts?: Record<string, DesignContrast>;
    /** Explicit level order for factor predictors. */
    levels?: Record<string, readonly string[]>;
    /** Maximum number of optimization iterations. */
    maxit?: number;
    /** Convergence tolerance for the optimization. */
    eps?: number;
}
/** Model data retained by a quantile-regression fit.
 *
 * @category Regression
 */
export interface RqModel {
    /** Model formula used to define the response and predictors. */
    formula: string;
    /** Numeric model matrix used by the fit. */
    x: number[][];
    /** Observed response values. */
    y: number[];
    /** Nonnegative prior observation weights. */
    weights: number[];
    /** Original data-row indices retained in the model frame. */
    rows: number[];
    /** Names of the columns in the model matrix. */
    columnNames: string[];
    /** Quantile probability or probabilities to fit. */
    tau: number[];
    /** Quantile-regression optimization method. */
    method: RqMethod;
}
/** Result returned by {@link rq}.
 *
 * @category Regression
 */
export interface RqResult {
    /** Estimated regression coefficients. */
    coefficients: Record<string, number | number[]>;
    /** Fitted conditional means or quantiles for the input rows. */
    fittedValues: number[] | number[][];
    /** Response residuals for the input rows. */
    residuals: number[] | number[][];
    /** Quantile check-loss objective value. */
    rho: number | number[];
    /** Whether the numerical fitting procedure met its convergence criterion. */
    converged: boolean;
    /** Number of iterations used by the fitting procedure. */
    iterations: number;
    /** Warnings recorded while fitting or summarizing the model. */
    warnings: string[];
    /** Model-frame and design information retained for downstream methods. */
    model: RqModel;
}
/**
 * Fit a linear conditional quantile model. Equivalent to `quantreg::rq()` in R.
 * Uses the formula/model-matrix interface of other regression models.
 *
 * @param formula A formula such as `y ~ x`.
 * @param data A data frame of columns.
 * @param options Quantile, algorithm, and prior weights.
 * @example
 * ```ts
 * rq("y ~ x", { x: [1, 2, 3, 4], y: [2, 1, 4, 3] }, { tau: 0.5 });
 * ```
 * @category Regression
 */
export declare function rq(formula: string, data: DataFrame, options?: RqOptions): RqResult;
/**
 * Predict conditional quantiles for new observations. Equivalent to `quantreg::predict.rq()` in R.
 *
 * @category Regression
 */
export declare function rqPredict(fit: RqResult, newdata: DataFrame): number[] | number[][];
/** Options for rqSummary.
 * @category Regression
 */
export interface RqSummaryOptions {
    /** Standard-error or interval method used for the summary. */
    se?: "nid" | "rank";
    /** Estimated coefficient covariance matrix or matrices. */
    covariance?: boolean;
    /** Confidence level for reported intervals. */
    level?: number;
    /** The iid form of the rank test (R's `iid`). Only `true` (the default) is supported in 1.8.0. */
    iid?: boolean;
}
/** A coefficient row in an rq summary.
 * @category Regression
 */
export interface RqCoefficientSummary {
    /** Quantile probability or probabilities to fit. */
    tau: number;
    /** Model term represented by this coefficient row. */
    term: string;
    /** Estimated coefficient value. */
    estimate: number;
    /** NaN for `se = "rank"`, which gives an interval (`lower`, `upper`) instead. */
    stdError: number;
    /** Wald test statistic for the coefficient. */
    statistic: number;
    /** Two-sided p-value associated with the coefficient statistic. */
    pValue: number;
    /** The confidence limits of `se = "rank"` (R's `lower bd` and `upper bd`). */
    lower?: number;
    /** Upper confidence limit for the coefficient. */
    upper?: number;
}
/** Result of rqSummary.
 * @category Regression
 */
export interface RqSummaryResult {
    /** Estimated regression coefficients. */
    coefficients: RqCoefficientSummary[];
    /** Estimated coefficient covariance matrix or matrices. */
    covariance?: number[][][];
    /** Standard-error or interval method used for the summary. */
    se: string;
    /** Warnings recorded while fitting or summarizing the model. */
    warnings: string[];
}
/** Options for confidence prediction intervals.
 * @category Regression
 */
export interface RqPredictOptions {
    /** Whether prediction output includes confidence intervals. */
    interval?: "none" | "confidence";
    /** Prediction scale or confidence-interval construction method. */
    type?: "none" | "direct" | "percentile";
    /** Confidence level for reported intervals. */
    level?: number;
}
/** Result of confidence prediction.
 * @category Regression
 */
export interface RqPredictResult {
    /** Predicted conditional quantiles or fitted values. */
    fit: number[] | number[][];
    /** Lower confidence limit for the coefficient. */
    lower?: number[] | number[][];
    /** Upper confidence limit for the coefficient. */
    upper?: number[] | number[][];
    /** Confidence level for reported intervals. */
    level: number;
    /** Prediction scale or confidence-interval construction method. */
    type: string;
}
/** Coefficient summary with Hall–Sheather bandwidth and the nid sandwich covariance. Equivalent to R's `summary.rq()`.
 *
 * @category Regression
 */
export declare function rqSummary(fit: RqResult, options?: RqSummaryOptions): RqSummaryResult;
/** Confidence intervals for conditional quantile predictions using nid or direct quantile refits. Equivalent to R's `predict.rq()`.
 *
 * @category Regression
 */
export declare function rqPredictInterval(fit: RqResult, newdata: DataFrame, options?: RqPredictOptions): RqPredictResult;
/** Wald test of equality of slopes across the quantiles in a multiple-tau fit. Equivalent to R's `anova.rq()`.
 *
 * @category Regression
 */
/** Wald comparisons for nested models or slopes across multiple quantiles. Equivalent to R's `anova.rq()`.
 *
 * @category Regression
 */
export declare function rqAnova(fit: RqResult): RqWaldResult;
export declare function rqAnova(fit: RqResult, joint: true): RqWaldResult;
export declare function rqAnova(fit: RqResult, joint: false): RqWaldResult[];
export declare function rqAnova(fit: RqResult, joint: boolean): RqWaldResult | RqWaldResult[];
export declare function rqAnova(fit: RqResult, reduced: RqResult): RqWaldResult;
/** Result of a quantile-regression Wald comparison.
 * @category Regression
 */
export interface RqWaldResult {
    /** Joint Wald statistic for the tested slope restrictions across quantiles. */
    statistic: number;
    /** Numerator degrees of freedom for the Wald test. */
    df: number;
    /** Residual degrees of freedom used for the reference distribution. */
    dfResidual: number;
    /** P-value for the joint Wald comparison. */
    pValue: number;
    /** Wald comparison method used for the multi-quantile test. */
    method: "Wald";
}
