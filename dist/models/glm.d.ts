import type { MatrixInput } from "../linalg/matrix.js";
import { type QR } from "../linalg/qr.js";
import type { Sample } from "../htest/types.js";
import { Warnings, type Family, type GlmFamilyName, type GlmFamilySpec, type GlmLink } from "./glmFamily.js";
export type { GlmFamilyName, GlmFamilySpec, GlmLink, GlmLinkName, QuasiVariance } from "./glmFamily.js";
/**
 * Options for {@link glm}.
 *
 * @category Generalized linear models
 */
export interface GlmOptions {
    /**
     * The family: a name (`"gaussian"`, the default, `"binomial"`, `"quasibinomial"`, `"poisson"`, `"quasipoisson"`,
     * `"Gamma"`, `"inverse.gaussian"`, `"quasi"`) or an object with the link and, for `quasi`, the variance function,
     * as R's `quasi(link = "log", variance = "mu^2")`.
     */
    family?: GlmFamilyName | GlmFamilySpec;
    /**
     * The link (overrides the family object's): a name such as `"logit"` or `{ power: lambda }` (quasi only). As in R,
     * any named link may be used with any family except `quasi`, which takes only its own list.
     */
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
/**
 * The data and settings of a fit, kept for the refits of {@link glmConfint} and {@link glmAnova}.
 *
 * @category Generalized linear models
 */
export interface GlmModel {
    /** Model matrix (with the column of ones), rows with a missing value dropped. */
    x: number[][];
    /** Column names: `"(Intercept)"`, `"x1"`, `"x2"`, ... */
    columnNames: string[];
    /** Response as given (a vector, or rows of successes and failures), rows with a missing value dropped. */
    yGiven: number[] | number[][];
    /** Prior weights as given (1 when not given). */
    priorGiven: number[];
    /** Offset, one per row (0 when not given). */
    offset: number[];
    /** Whether an offset was given. */
    hasOffset: boolean;
    /** Whether the model has an intercept. */
    intercept: boolean;
    /** The family and link of the fit. */
    familySpec: GlmFamilySpec;
    /** Convergence tolerance (R's `glm.control(epsilon)`). */
    epsilon: number;
    /** Maximum number of iterations (R's `glm.control(maxit)`). */
    maxit: number;
    /** Starting coefficients, if given. */
    start: number[] | undefined;
}
/**
 * Result of {@link glm}: R's `glm` object.
 *
 * @category Generalized linear models
 */
export interface GlmResult {
    /** Coefficients (intercept first); NaN for aliased columns. */
    coefficients: number[];
    /** Fitted means, one per row (rows with a missing value dropped). */
    fittedValues: number[];
    /** Linear predictors, one per row, offset included (R's `linear.predictors`). */
    linearPredictors: number[];
    /** Residual deviance. */
    deviance: number;
    /** Deviance of the model with the intercept only, or of the empty model without intercept (R's `null.deviance`). */
    nullDeviance: number;
    /** AIC; NaN for the quasi families. */
    aic: number;
    /** Numerical rank of the model matrix. */
    rank: number;
    /** Residual degrees of freedom (R's `df.residual`). */
    dfResidual: number;
    /** Degrees of freedom of the null deviance (R's `df.null`). */
    dfNull: number;
    /** Number of iterations. */
    iter: number;
    /** Whether the iterations converged. */
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
    /** The link's name, such as `"logit"`. */
    link: string;
    /** R's warnings, each once, in order of first appearance. */
    warnings: string[];
    /** QR decomposition of the last weighted least squares problem (undefined for a model without columns). */
    qr: QR | undefined;
    /** The data and settings of the fit, for the refits of {@link glmConfint} and {@link glmAnova}. */
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
 * `glm(y ~ x, family = ...)`. Or `y ~ x - 1` without intercept; the predictors are given as a matrix instead of a
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
 * fit.coefficients; // [-4.2491, 1.214]
 * glmSummary(fit).pValue; // [0.20976, 0.18341]
 * ```
 *
 * @category Generalized linear models
 */
export declare function glm(x: MatrixInput | Sample, y: Sample | MatrixInput, options?: GlmOptions): GlmResult;
/** The family object of a fit */
export declare function familyOf(fit: GlmResult): Family;
/** Pearson dispersion of summary.glm (1 for binomial and poisson) */
export declare function glmDispersion(fit: GlmResult, warnings?: Warnings): number;
/**
 * Options for {@link glmSummary}.
 *
 * @category Generalized linear models
 */
export interface GlmSummaryOptions {
    /** Dispersion to use instead of the estimate (or 1 for binomial and poisson). */
    dispersion?: number;
}
/**
 * Result of {@link glmSummary}: the quantities of R's `summary(glm)`.
 *
 * @category Generalized linear models
 */
export interface GlmSummary {
    /** The dispersion used (estimated, given, or 1 for binomial and poisson). */
    dispersion: number;
    /** The coefficient table of the columns that are not aliased, in their order. */
    estimate: number[];
    /** Standard errors (R's `Std. Error`). */
    stdError: number[];
    /** z or t statistics (see `statisticName`). */
    statistic: number[];
    /** Two-sided p-values (R's `Pr(>|z|)` or `Pr(>|t|)`). */
    pValue: number[];
    /** `"z value"` when the dispersion is fixed (binomial, poisson), else `"t value"`. */
    statisticName: "z value" | "t value";
    /** (R'R)^-1 of the columns that are not aliased. */
    covUnscaled: number[][];
    /** covUnscaled times the dispersion. */
    covScaled: number[][];
    /** Residual degrees of freedom (R's `df.residual`). */
    dfResidual: number;
    /** Warnings (such as "observations with zero weight not used for calculating dispersion"). */
    warnings: string[];
}
/**
 * Summary of a generalized linear model: the dispersion, the coefficient table and the covariance of the estimates,
 * for a `glm` fit. Equivalent to R's `summary()`.
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * const s = glmSummary(fit);
 * s.estimate; // [-4.2491, 1.214]
 * s.stdError; // [3.3878, 0.91258]
 * s.statisticName; // "z value"
 * ```
 *
 * @category Generalized linear models
 */
export declare function glmSummary(fit: GlmResult, options?: GlmSummaryOptions): GlmSummary;
/**
 * Kinds of residuals of {@link glmResiduals}.
 *
 * @category Generalized linear models
 */
export type GlmResidualType = "deviance" | "pearson" | "working" | "response";
/**
 * Residuals of a generalized linear model, one per row, for a `glm` fit (default `"deviance"`). Equivalent to R's
 * `residuals(fit, type)`.
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * glmResiduals(fit); // [-0.30644, -0.54776, 1.4436, -1.4436, 0.54776, 0.30644]
 * glmResiduals(fit, "pearson"); // [-0.21925, -0.40231, 1.3546, -1.3546, 0.40231, 0.21925]
 * ```
 *
 * @category Generalized linear models
 */
export declare function glmResiduals(fit: GlmResult, type?: GlmResidualType): number[];
/**
 * Diagonal of the hat matrix of the last weighted least squares step, for the rows of non-zero prior weight, for a
 * `glm` fit. Equivalent to R's `hatvalues()`.
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * glmHatvalues(fit); // [0.28361, 0.37762, 0.33877, 0.33877, 0.37762, 0.28361]
 * ```
 *
 * @category Generalized linear models
 */
export declare function glmHatvalues(fit: GlmResult): number[];
/**
 * Standardized deviance residuals, for the rows of non-zero prior weight, for a `glm` fit. Equivalent to R's
 * `rstandard()`.
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * glmRstandard(fit); // [-0.36205, -0.69432, 1.7753, -1.7753, 0.69432, 0.36205]
 * ```
 *
 * @category Generalized linear models
 */
export declare function glmRstandard(fit: GlmResult, options?: GlmSummaryOptions): number[];
/**
 * Cook's distances, for the rows of non-zero prior weight, for a `glm` fit. Equivalent to R's `cooks.distance()`.
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * glmCooksDistance(fit); // [0.013283, 0.078894, 0.71087, 0.71087, 0.078894, 0.013283]
 * ```
 *
 * @category Generalized linear models
 */
export declare function glmCooksDistance(fit: GlmResult, options?: GlmSummaryOptions): number[];
/**
 * Options for {@link glmPredict}.
 *
 * @category Generalized linear models
 */
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
 * Predictions of a generalized linear model with their standard errors, for a `glm` fit. Equivalent to R's
 * `predict(fit, newdata, type, se.fit = TRUE)`. Aliased columns are left out, as R does.
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * glmPredict(fit, { newdata: [7] }); // { fit: [4.2491], seFit: [3.3878] }
 * glmPredict(fit, { newdata: [7], type: "response" }).fit; // [0.98592]
 * ```
 *
 * @category Generalized linear models
 */
export declare function glmPredict(fit: GlmResult, options?: GlmPredictOptions): {
    /** Predictions on the scale of `type`, one per row. */
    fit: number[];
    /** Their standard errors (R's `se.fit`). */
    seFit: number[];
};
