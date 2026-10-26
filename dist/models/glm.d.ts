import type { MatrixInput } from "../linalg/matrix.js";
import { type QR } from "../linalg/qr.js";
import type { Sample } from "../htest/types.js";
import { Warnings, type Family, type GlmFamilyName, type GlmFamilySpec, type GlmLink } from "./glmFamily.js";
export type { GlmFamilyName, GlmFamilySpec, GlmLink, GlmLinkName, QuasiVariance } from "./glmFamily.js";
/** Options for {@link glm}. */
export interface GlmOptions {
    /**
     * The family: a name (`"gaussian"`, the default, `"binomial"`, `"quasibinomial"`, `"poisson"`, `"quasipoisson"`,
     * `"Gamma"`, `"inverse.gaussian"`, `"quasi"`) or an object with the link and, for `quasi`, the variance function,
     * as R's `quasi(link = "log", variance = "mu^2")`.
     */
    family?: GlmFamilyName | GlmFamilySpec;
    /** The link (overrides the family object's): a name such as `"logit"` or `{ power: lambda }` (quasi only). */
    link?: GlmLink;
    /** Prior weights (non-negative). */
    weights?: Sample;
    /** Offset added to the linear predictor. */
    offset?: Sample;
    /** Starting coefficients (intercept first). */
    start?: Sample;
    /** Convergence tolerance on the relative change of the deviance (R's `glm.control(epsilon)`). Default `1e-8`. */
    epsilon?: number;
    /** Maximum number of iterations. Default `25`. */
    maxit?: number;
    /** Include an intercept (a column of ones before the columns of `x`). Default `true`. */
    intercept?: boolean;
}
/** The data and settings of a fit, kept for the refits of {@link glmConfint} and {@link glmAnova}. */
export interface GlmModel {
    /** Model matrix (with the column of ones), rows with a missing value dropped. */
    x: number[][];
    /** Column names: `"(Intercept)"`, `"x1"`, `"x2"`, ... */
    columnNames: string[];
    /** Response as given (a vector, or rows of successes and failures), rows with a missing value dropped. */
    yGiven: number[] | number[][];
    /** Prior weights as given (1 when not given). */
    priorGiven: number[];
    offset: number[];
    /** Whether an offset was given. */
    hasOffset: boolean;
    intercept: boolean;
    familySpec: GlmFamilySpec;
    epsilon: number;
    maxit: number;
    start: number[] | undefined;
}
/** Result of {@link glm}: R's `glm` object. */
export interface GlmResult {
    /** Coefficients (intercept first); NaN for aliased columns. */
    coefficients: number[];
    /** Fitted means, one per row (rows with a missing value dropped). */
    fittedValues: number[];
    linearPredictors: number[];
    deviance: number;
    nullDeviance: number;
    /** AIC; NaN for the quasi families. */
    aic: number;
    rank: number;
    dfResidual: number;
    dfNull: number;
    /** Number of iterations. */
    iter: number;
    converged: boolean;
    /** Whether the step was truncated (halved) in the last iteration. */
    boundary: boolean;
    /** The response as the family reads it (proportions for a two-column binomial response). */
    y: number[];
    /** Prior weights after the response was read (multiplied by the sizes for a two-column binomial response). */
    priorWeights: number[];
    /** Working weights of the last least squares step (0 for rows not used). */
    weights: number[];
    /** Working residuals. */
    residuals: number[];
    /** The family's name and the link's name (`"mu^0.333"` for a power link). */
    family: GlmFamilyName;
    link: string;
    /** R's warnings, each once, in order of first appearance. */
    warnings: string[];
    /** QR decomposition of the last weighted least squares problem (undefined for a model without columns). */
    qr: QR | undefined;
    model: GlmModel;
}
/** Input of the iteratively reweighted least squares (after the response has been read) */
interface IrlsInput {
    x: number[][];
    p: number;
    y: number[];
    w: number[];
    offset: number[];
    fam: Family;
    epsilon: number;
    maxit: number;
    columnNames: string[];
    start?: number[] | undefined;
    etastart?: number[] | undefined;
    mustart: number[];
    /**
     * Stop when the coefficients stop changing (max |change| <= 8 eps max |b|) instead of R's rule on the deviance,
     * which is stationary at the estimate (used by the profile fits of glmConfint)
     */
    untilCoefficients?: boolean | undefined;
}
/** Result of the iterations */
export interface IrlsFit {
    coefficients: number[];
    eta: number[];
    mu: number[];
    deviance: number;
    iter: number;
    converged: boolean;
    boundary: boolean;
    rank: number;
    qr: QR | undefined;
    /** Rows used in the last least squares step */
    used: boolean[];
    workingWeights: number[];
    workingResiduals: number[];
}
/** Iteratively reweighted least squares (glm-behaviour.md, "Fitting") */
export declare function irls(inp: IrlsInput, warnings: Warnings): IrlsFit;
/** Fits a model from its stored data, with the columns `cols` of the model matrix (all by default) */
export declare function refit(model: GlmModel, cols: number[], warnings: Warnings, control?: {
    epsilon?: number;
    maxit?: number;
    etastart?: number[];
    start?: number[] | undefined;
    extraOffset?: number[];
    untilCoefficients?: boolean;
}): {
    fit: IrlsFit;
    fam: Family;
    y: number[];
    w: number[];
    size: number[] | undefined;
    offset: number[];
};
/**
 * Fit a generalized linear model by iteratively reweighted least squares. Equivalent to R's
 * `glm(y ~ x, family = ...)` (or `y ~ x - 1` without intercept); the predictors are given as a matrix instead of a
 * formula. Rows with a missing value (NaN) in `x`, `y`, the weights or the offset are dropped. Every family and link
 * of R's `stats` is available; R's warnings are returned in `warnings`. See {@link glmSummary}, {@link glmResiduals},
 * {@link glmPredict}, {@link glmConfint} and {@link glmAnova} for the methods.
 *
 * @param x Predictors: a matrix (array of rows, one column per predictor; rows of length 0 for a model with the
 *   intercept only) or a vector (one predictor).
 * @param y Response: a vector, or for the binomial families rows of (successes, failures).
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * fit.coefficients; // [intercept, slope]
 * glmSummary(fit).pValue;
 * ```
 */
export declare function glm(x: MatrixInput | Sample, y: Sample | MatrixInput, options?: GlmOptions): GlmResult;
/** The family object of a fit */
export declare function familyOf(fit: GlmResult): Family;
/** Pearson dispersion of summary.glm (1 for binomial and poisson) */
export declare function glmDispersion(fit: GlmResult, warnings?: Warnings): number;
/** Options for {@link glmSummary}. */
export interface GlmSummaryOptions {
    /** Dispersion to use instead of the estimate (or 1 for binomial and poisson). */
    dispersion?: number;
}
/** Result of {@link glmSummary}: the quantities of R's `summary(glm)`. */
export interface GlmSummary {
    dispersion: number;
    /** The coefficient table of the columns that are not aliased, in their order. */
    estimate: number[];
    stdError: number[];
    statistic: number[];
    pValue: number[];
    /** `"z value"` when the dispersion is fixed (binomial, poisson), else `"t value"`. */
    statisticName: "z value" | "t value";
    /** (R'R)^-1 of the columns that are not aliased. */
    covUnscaled: number[][];
    /** covUnscaled times the dispersion. */
    covScaled: number[][];
    dfResidual: number;
    /** Warnings (such as "observations with zero weight not used for calculating dispersion"). */
    warnings: string[];
}
/**
 * Summary of a generalized linear model: the dispersion, the coefficient table and the covariance of the estimates.
 * Equivalent to R's `summary()` for a `glm` fit.
 */
export declare function glmSummary(fit: GlmResult, options?: GlmSummaryOptions): GlmSummary;
/** Kinds of residuals of {@link glmResiduals}. */
export type GlmResidualType = "deviance" | "pearson" | "working" | "response";
/**
 * Residuals of a generalized linear model, one per row. Equivalent to R's `residuals(fit, type)` for a `glm` fit
 * (default `"deviance"`).
 */
export declare function glmResiduals(fit: GlmResult, type?: GlmResidualType): number[];
/**
 * Diagonal of the hat matrix of the last weighted least squares step, for the rows of non-zero prior weight.
 * Equivalent to R's `hatvalues()` for a `glm` fit.
 */
export declare function glmHatvalues(fit: GlmResult): number[];
/**
 * Standardized deviance residuals, for the rows of non-zero prior weight. Equivalent to R's `rstandard()` for a
 * `glm` fit.
 */
export declare function glmRstandard(fit: GlmResult, options?: GlmSummaryOptions): number[];
/** Cook's distances, for the rows of non-zero prior weight. Equivalent to R's `cooks.distance()` for a `glm` fit. */
export declare function glmCooksDistance(fit: GlmResult, options?: GlmSummaryOptions): number[];
/** Options for {@link glmPredict}. */
export interface GlmPredictOptions {
    /** New predictor values, with the columns of `x` (no column of ones). Default: the data of the fit. */
    newdata?: MatrixInput | Sample;
    /** Offset for `newdata`. Default 0. */
    newoffset?: Sample;
    /** `"link"` (default; the linear predictor) or `"response"` (the mean). */
    type?: "link" | "response";
    /** Dispersion for the standard errors instead of the summary's. */
    dispersion?: number;
}
/**
 * Predictions of a generalized linear model with their standard errors. Equivalent to R's
 * `predict(fit, newdata, type, se.fit = TRUE)` for a `glm` fit. Aliased columns are left out, as R does.
 */
export declare function glmPredict(fit: GlmResult, options?: GlmPredictOptions): {
    fit: number[];
    seFit: number[];
};
