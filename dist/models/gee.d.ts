import { type GlmFamilyName, type GlmFamilySpec, type GlmLink } from "./glmFamily.js";
import type { DataFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";
/** Working-correlation structures supported by geeglm.
 * @category Regression
 */
/**
 * Working correlation structures supported by a GEE fit.
 * @category Regression
 */
export type GeeCorrelation = "independence" | "exchangeable" | "ar1" | "unstructured" | "userdefined" | "fixed";
/** Cluster identifiers may be numeric, character, or logical.
 * @category Regression
 */
export type GeeId = readonly (number | string | boolean)[];
/** Coefficient covariance estimators.
 * @category Regression
 */
export type GeeStdErr = "san.se";
/** Options for a marginal generalized estimating equation fit.
 * @category Regression
 */
export interface GeeOptions {
    /** Cluster identifier column or values. */
    id: string | GeeId;
    /** Within-cluster observation order or wave values. */
    waves?: string | Sample;
    /** Response distribution used by the estimating equations. */
    family?: GlmFamilyName | GlmFamilySpec;
    /** Link function for the response mean. */
    link?: GlmLink;
    /** Working correlation structure. */
    corstr?: GeeCorrelation;
    /** Standard-error estimator requested for the coefficient covariance. */
    "std.err"?: GeeStdErr;
    /** User-supplied or fixed pairwise working-correlation values. */
    zcor?: readonly (readonly number[])[] | Sample;
    /** Prior observation weights. */
    weights?: string | Sample;
    /** Known contribution to the linear predictor. */
    offset?: string | Sample;
    /** Whether to hold the scale parameter fixed at scale.value. */
    "scale.fix"?: boolean;
    /** Fixed scale parameter value when scale.fix is enabled. */
    "scale.value"?: number;
    /** Convergence tolerance for coefficient updates. */
    epsilon?: number;
    /** Maximum number of fitting iterations. */
    maxit?: number;
}
interface GeeOffsetTerm {
    variable: string;
    log: boolean;
}
/** A fitted generalized estimating equation model.
 * @category Regression
 */
export interface GeeResult {
    /** Estimated marginal-model coefficients. */
    coefficients: number[];
    /** Fitted marginal means for the original input rows. */
    fittedValues: number[];
    /** Fitted linear predictors for the original input rows. */
    linearPredictors: number[];
    /** Response residuals for the original input rows. */
    residuals: number[];
    /** Pearson residuals for the original input rows. */
    pearsonResiduals: number[];
    /** Robust sandwich covariance matrix of the coefficient estimates. */
    covariance: number[][];
    /** Model-based covariance matrix under the working correlation. */
    modelCovariance: number[][];
    /** Model-based covariance matrix under independence working correlation. */
    independenceCovariance: number[][];
    /** Estimated working-correlation parameter values. */
    alpha: number[];
    /** Scale or dispersion parameter. */
    scale: number;
    /** Number of coefficient-update iterations performed. */
    iterations: number;
    /** Whether the coefficient iteration met its convergence criterion. */
    converged: boolean;
    /** Response distribution used by the estimating equations. */
    family: GlmFamilyName;
    /** Link function for the response mean. */
    link: string;
    /** Working correlation structure. */
    corstr: GeeCorrelation;
    /** Standard-error estimator used by the fit. */
    stdErr: GeeStdErr;
    /** Names of the model-matrix columns. */
    columnNames: string[];
    /** Original data-row indices retained in the model frame. */
    rows: number[];
    /** Cluster identifiers corresponding to retained rows. */
    clusterIds: (number | string | boolean)[];
    /** Within-cluster observation order or wave values. */
    waves: number[];
    /** Warnings recorded while fitting or summarizing the model. */
    warnings: string[];
    /** Model-frame, design, and cluster information retained for downstream methods. */
    model: {
        /** Original model formula. */
        formula: string;
        /** Mean-model formula after offset terms are separated. */
        meanFormula: string;
        /** Offset terms extracted from the formula.
         * @internal
         */
        offsetTerms: GeeOffsetTerm[];
        /** Name of the data column supplied through the offset option, if any. */
        offsetOptionColumn: string | undefined;
        /** Whether an offset was supplied outside the formula. */
        hasExternalOffset: boolean;
        /** Model-matrix column to formula-term assignment. */
        termAssign: number[];
        /** Labels of the formula terms. */
        termLabels: string[];
        /** Name of the response variable. */
        responseVariable: string;
        /** Whether the mean model includes an intercept. */
        intercept: boolean;
        /** Model matrix for retained observations. */
        x: number[][];
        /** Response values for retained observations. */
        y: number[];
        /** Cluster identifiers for retained observations. */
        ids: (number | string | boolean)[];
        /** Within-cluster observation order or wave values. */
        waves: number[];
        /** Prior observation weights. */
        weights: number[];
        /** Known contribution to the linear predictor. */
        offset: number[];
        /** Response distribution used by the estimating equations. */
        family: GlmFamilyName | GlmFamilySpec;
        /** Link function for the response mean. */
        link: GlmLink | undefined;
        /** Working correlation structure. */
        corstr: GeeCorrelation;
        /** Whether the scale parameter is fixed. */
        scaleFix: boolean;
        /** Scale value used when scale is fixed. */
        scaleValue: number;
        /** Convergence tolerance for coefficient updates. */
        epsilon: number;
        /** Maximum number of fitting iterations. */
        maxit: number;
        /** User-supplied or fixed pairwise working-correlation values. */
        zcor: number[][] | undefined;
        /** Data frame retained for prediction and model comparisons. */
        data: DataFrame;
    };
}
/** Coefficient and nuisance-parameter summary of a GEE fit.
 * @category Regression
 */
export interface GeeSummaryResult {
    /** Original data-row indices retained in the model frame. */
    rows: string[];
    /** Column labels for the returned summary table. */
    columns: ["Estimate", "Std. Error", "Wald", "Pr(>|W|)"];
    /** Numeric values in the returned summary table. */
    values: number[][];
    /** Scale or dispersion parameter. */
    scale: number;
    /** Estimated working-correlation summary. */
    correlation: {
        /** Labels for the reported working-correlation rows. */
        rows: string[];
        /** Estimated working-correlation values. */
        estimate: number[];
    };
    /** Warnings recorded while fitting or summarizing the model. */
    warnings: string[];
}
/** A GEE coefficient covariance matrix.
 * @category Regression
 */
export interface GeeVcovResult {
    /** Original data-row indices retained in the model frame. */
    rows: string[];
    /** Column labels for the returned summary table. */
    columns: string[];
    /** Numeric values in the returned summary table. */
    values: number[][];
}
/** Prediction options for a GEE fit.
 * @category Regression
 */
export interface GeePredictOptions {
    /** Optional data frame used to construct predictions. */
    newdata?: DataFrame;
    /** Prediction scale or covariance selection. */
    type?: "link" | "response";
    /** Offset values for new observations. */
    newoffset?: Sample;
}
/** Wald comparison table for GEE models.
 * @category Regression
 */
export interface GeeAnovaResult {
    /** Original data-row indices retained in the model frame. */
    rows: string[];
    /** Column labels for the returned summary table. */
    columns: ["Df", "X2", "Pr(>Chi)"];
    /** Numeric values in the returned summary table. */
    values: number[][];
}
/**
 * Options for selecting the covariance matrix returned by geeVcov.
 * @category Regression
 */
export interface GeeVcovOptions {
    /** Covariance matrix to return: robust sandwich or model-based. */
    type?: "robust" | "naive";
}
/**
 * Options for a GEE Wald analysis of variance.
 * @category Regression
 */
export interface GeeAnovaOptions {
    /** Wald test used for the sequential term comparison. */
    test?: "Wald";
}
/**
 * Quasi-likelihood information criteria returned by geeQIC.
 * @category Regression
 */
export interface GeeQICResult {
    /** Quasi-likelihood under the independence model criterion. */
    QIC: number;
    /** Uncorrected quasi-likelihood information criterion. */
    QICu: number;
    /** Quasi-likelihood component. */
    Q: number;
    /** Correlation information criterion. */
    CIC: number;
    /** Number of fitted mean-model parameters. */
    params: number;
    /** Finite-sample corrected QIC. */
    QICC: number;
}
/**
 * Fit a marginal generalized estimating equation model.
 * Equivalent to `geepack::geeglm()` in R.
 * @category Regression
 */
export declare function geeglm(formula: string, data: DataFrame, options: GeeOptions): GeeResult;
/**
 * Return robust or model-based coefficient covariance.
 * Equivalent to R's `vcov()`.
 * @category Regression
 */
export declare function geeVcov(fit: GeeResult, options?: GeeVcovOptions): GeeVcovResult;
/**
 * Summarize the coefficient estimates of a GEE fit.
 * Equivalent to R's `summary.geeglm()`.
 * @category Regression
 */
export declare function geeSummary(fit: GeeResult, options?: Record<string, never>): GeeSummaryResult;
/**
 * Predict marginal means on the link or response scale.
 * Equivalent to R's `predict.geeglm()`.
 * @category Regression
 */
export declare function geePredict(fit: GeeResult, options?: GeePredictOptions): number[];
/**
 * Compare GEE terms or nested models using Wald tests.
 * Equivalent to R's `anova()`.
 * @category Regression
 */
export declare function geeAnova(fit: GeeResult, options?: GeeAnovaOptions | GeeResult): GeeAnovaResult;
/**
 * Calculate quasi-likelihood information criteria for a GEE fit (Pan, 2001).
 * Equivalent to `geepack::QIC()` in R.
 * @category Regression
 */
export declare function geeQIC(fit: GeeResult): GeeQICResult;
export {};
