import { type FormulaNode } from "./formula.js";
import { type DesignContrast } from "./modelMatrix.js";
import type { DataFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";
/** Name of the cumulative distribution used by an ordinal regression.
 *
 * @category Regression
 */
export type PolrMethod = "logistic" | "probit" | "cloglog" | "loglog" | "cauchit";
/**
 * Options for {@link polr}.
 *
 * @category Regression
 */
export interface PolrOptions {
    /** Cumulative link. Default `"logistic"`. */
    method?: PolrMethod;
    /** Non-negative prior weights, or the name of a data column. */
    weights?: Sample | string;
    /** Offset added to the linear predictor. */
    offset?: Sample;
    /** Initial slopes followed by the ordered cut-points. */
    start?: Sample;
    /** Contrasts for categorical predictors. */
    contrasts?: Record<string, "contr.treatment" | "contr.sum" | "contr.helmert">;
    /** Explicit response and predictor levels. */
    levels?: Record<string, readonly string[]>;
    /** Maximum optimisation iterations. Default `1000`. */
    maxit?: number;
    /** Relative optimisation tolerance. Default `1e-12`. */
    reltol?: number;
}
/** Stored formula, design metadata and observations needed by prediction and model comparison.
 *
 * @category Regression
 */
export interface PolrModel {
    /** Original model formula. */
    formula: string;
    /** Parsed formula syntax tree; internal implementation detail. @internal */
    rhs: FormulaNode;
    /** Predictor variable names in model-matrix order. */
    predictorVariables: string[];
    /** Observed or declared levels for categorical predictors. */
    factorLevels: Record<string, readonly string[]>;
    /** Contrast matrices used to construct the design; internal representation. @internal */
    contrasts: Record<string, DesignContrast>;
    /** Name of the data column used as an offset, when supplied by name. */
    offsetColumn?: string;
    /** Whether the offset was supplied separately from the formula. */
    externalOffset: boolean;
    /** Response column name. */
    response: string;
    /** Retained design matrix. */
    x: number[][];
    /** Names of design-matrix columns. */
    columnNames: string[];
    /** Response values encoded as ordered category indices. */
    y: number[];
    /** Ordered response category labels. */
    responseLevels: string[];
    /** Prior weights for retained observations. */
    weights: number[];
    /** Offset values for retained observations. */
    offset: number[];
    /** Original row indices retained after missing-value handling. */
    rows: number[];
    /** Cumulative-link distribution. */
    method: PolrMethod;
    /** Maximised log likelihood. */
    logLikelihood: number;
    /** Internal unconstrained optimisation parameters. */
    theta: number[];
    /** Observed Hessian in internal parameter coordinates. */
    rawHessian: number[][];
}
/**
 * Result of {@link polr}: cumulative-link estimates and their observed-information covariance.
 *
 * @category Regression
 */
export interface PolrResult {
    /** Named slope estimates, excluding the cut-points. */
    coefficients: Record<string, number>;
    /** Named ordered cut-points, separately from the slopes. */
    zeta: Record<string, number>;
    /** Fitted category probabilities, one row per retained observation. */
    fittedValues: number[][];
    /** Linear predictors, offset included. */
    linearPredictors: number[];
    /** Residual deviance, `-2 logLik`. */
    deviance: number;
    /** Maximised log likelihood. */
    logLik: number;
    /** Akaike information criterion. */
    aic: number;
    /** Bayesian information criterion. */
    bic: number;
    /** Number of estimated slopes and cut-points. */
    edf: number;
    /** Sum of the positive case weights. */
    nobs: number;
    /** Whether the numerical optimisation converged. */
    converged: boolean;
    /** Optimiser convergence code. */
    convergence: number;
    /** Distinct warnings in first-occurrence order. */
    warnings: string[];
    /** Data and numerical state retained for the companion methods. */
    model: PolrModel;
}
/** Table of slope and cut-point estimates, standard errors and Wald statistics.
 *
 * @category Regression
 */
export interface PolrSummaryResult {
    /** Coefficient and cut-point names. */
    rows: string[];
    /** Summary statistic column names. */
    columns: ["Value", "Std. Error", "t value"];
    /** Rows of estimates, standard errors and test statistics. */
    values: number[][];
    /** Warnings produced while computing the summary. */
    warnings: string[];
}
/** Covariance matrix of the slope and cut-point estimates in coefficient order.
 *
 * @category Regression
 */
export interface PolrVcovResult {
    /** Parameter names in matrix row order. */
    rows: string[];
    /** Parameter names in matrix column order. */
    columns: string[];
    /** Covariance matrix values. */
    values: number[][];
    /** Warnings produced while computing the covariance. */
    warnings: string[];
}
/**
 * Options for {@link polrConfint}.
 *
 * @category Regression
 */
export interface PolrConfintOptions {
    /** Interval method. Default "profile". */
    method?: "profile" | "wald";
    /** Confidence level. Default 0.95. */
    level?: number;
    /** Slope names or 1-based slope positions. Omitted means all slopes. */
    parm?: string | number | readonly (string | number)[];
}
/**
 * Confidence intervals for ordinal-regression slopes.
 *
 * @category Regression
 */
export interface PolrConfintResult {
    /** Parameter names for the intervals. */
    rows: string[];
    /** Lower and upper confidence-limit labels. */
    columns: string[];
    /** Confidence limits, one pair per parameter. */
    values: number[][];
    /** Warnings produced while computing the intervals. */
    warnings: string[];
}
/**
 * Options for {@link polrPredict}.
 *
 * @category Regression
 */
export interface PolrPredictOptions {
    /** New predictor columns; omitted to return predictions for the fitted observations. */
    newdata?: DataFrame;
    /** Row labels for a new data frame (default: "1", "2", ...). */
    rowNames?: readonly string[];
    /** Return the most likely category (default) or the category probabilities. */
    type?: "class" | "probs";
}
/**
 * Probability matrix returned when {@link PolrPredictOptions.type} is "probs".
 *
 * @category Regression
 */
export interface PolrPredictProbs {
    /** Prediction row labels. */
    rows: string[];
    /** Response category labels. */
    columns: string[];
    /** Predicted category probabilities; null marks an unavailable value. */
    values: (number | null)[][];
    /** Warnings produced while predicting. */
    warnings: string[];
}
/**
 * Predicted categories, or a probability matrix when type is "probs".
 *
 * @category Regression
 */
export type PolrPredictResult = (string | null)[] | PolrPredictProbs;
type PolrDerivatives = {
    value: number;
    gradient: number[];
    hessian: number[][];
};
/** Internal derivative hook used by finite-difference verification in the model tests. */
export declare function __polrDerivativesForTest(x: readonly (readonly number[])[], y: readonly number[], weights: readonly number[], offset: readonly number[], levels: number, method: PolrMethod, theta: readonly number[]): PolrDerivatives;
/**
 * Fit a cumulative-link ordinal regression. Equivalent to R's `MASS::polr()`.
 *
 * @param formula A formula such as `"rating ~ treatment + age"`.
 * @param data The data frame: an object of columns.
 * @param options The link, weights, offset, starts, contrasts and optimisation controls.
 * @returns The fitted slopes, cut-points, fitted probabilities and likelihood statistics.
 *
 * @example
 * ```ts
 * const fit = polr("rating ~ dose", { rating: ["low", "medium", "high", "low", "medium", "high"], dose: [0, 1, 2, 0, 1, 2] });
 * fit.zeta;
 * ```
 *
 * @category Regression
 */
export declare function polr(formula: string, data: DataFrame, options?: PolrOptions): PolrResult;
/**
 * Predict ordinal categories or their probabilities for new observations. Equivalent to R's `predict.polr()`.
 *
 * @param fit A fit returned by {@link polr}.
 * @param options New predictor columns, optional row labels, and the prediction type.
 * @returns Predicted category labels, or a matrix with one probability column per response level.
 *
 * @example
 * ```ts
 * const fit = polr("rating ~ dose", { rating: ["low", "medium", "high", "low", "medium", "high"], dose: [0, 1, 2, 0, 1, 2] });
 * polrPredict(fit, { newdata: { dose: [0, 1, 2] } });
 * ```
 *
 * @category Regression
 */
export declare function polrPredict(fit: PolrResult, options?: PolrPredictOptions): PolrPredictResult;
/**
 * Summary table of the slope and cut-point estimates. Equivalent to R's `summary.polr()`.
 *
 * @param fit A fit returned by {@link polr}.
 * @returns Estimates, standard errors and Wald t statistics.
 *
 * @category Regression
 */
export declare function polrSummary(fit: PolrResult): PolrSummaryResult;
/**
 * Covariance matrix of the slopes and cut-points. Equivalent to R's `vcov.polr()`.
 *
 * @param fit A fit returned by {@link polr}.
 * @returns The covariance matrix in slope-then-cut-point order.
 *
 * @category Regression
 */
export declare function polrVcov(fit: PolrResult): PolrVcovResult;
/**
 * Equivalent to R's `confint.polr()`.
 *
 * @param fit A fit returned by {@link polr}.
 * @param options The interval method, confidence level and selected slope parameters.
 * @returns A table of lower and upper confidence limits; cut-points are not included.
 *
 * @example
 * ```ts
 * const fit = polr("rating ~ dose", { rating: ["low", "medium", "high", "low", "medium", "high"], dose: [0, 1, 2, 0, 1, 2] });
 * polrConfint(fit, { method: "wald", level: 0.95 });
 * ```
 *
 * @category Regression
 */
export declare function polrConfint(fit: PolrResult, options?: PolrConfintOptions): PolrConfintResult;
/** Result table from sequential likelihood-ratio comparisons of nested ordinal-regression fits.
 *
 * @category Regression
 */
export interface PolrAnovaResult {
    /** Likelihood-ratio analysis-of-deviance table. */
    table: {
        /** Formula or term label for each fitted model. */
        Model: string[];
        /** Residual degrees of freedom for each model. */
        "Resid. df": number[];
        /** Residual deviance for each model. */
        "Resid. Dev": number[];
        /** Label of each sequential model comparison. */
        Test: string[];
        /** Degrees of freedom for each likelihood-ratio test. */
        "   Df": (number | "NA")[];
        /** Likelihood-ratio statistic for each comparison. */
        "LR stat.": (number | "NA")[];
        /** Chi-squared tail probability for each comparison. */
        "Pr(Chi)": (number | "NA")[];
    };
    /** Model or term labels associated with the comparison. */
    rows: string[];
    /** Heading describing the comparison. */
    heading: string[];
    /** Warnings produced while comparing models. */
    warnings: string[];
}
/**
 * Equivalent to R's `anova.polr()`.
 *
 * @param fits Two or more nested fits, ordered from the smallest to the largest model.
 * @returns The sequential likelihood-ratio chi-squared comparison table.
 *
 * @example
 * ```ts
 * const data = {
 *   rating: [
 *     "low", "low", "low", "medium", "medium", "high",
 *     "low", "low", "medium", "medium", "medium", "high",
 *     "low", "medium", "medium", "medium", "high", "high",
 *     "low", "low", "medium", "medium", "medium", "high",
 *     "low", "medium", "medium", "medium", "high", "high",
 *     "low", "medium", "medium", "high", "high", "high",
 *   ],
 *   dose: [
 *     0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
 *     2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0,
 *     1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2,
 *   ],
 *   treatment: [
 *     "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A", "A",
 *     "A", "A", "A", "A", "A", "A", "B", "B", "B", "B", "B", "B",
 *     "B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B",
 *   ],
 * };
 * const small = polr("rating ~ dose", data);
 * const large = polr("rating ~ dose + treatment", data);
 * polrAnova(small, large);
 * ```
 *
 * @category Regression
 */
export declare function polrAnova(...fits: PolrResult[]): PolrAnovaResult;
export {};
