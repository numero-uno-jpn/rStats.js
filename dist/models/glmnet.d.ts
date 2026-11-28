/**
 * Family used for the penalized generalized linear model.
 * @category Regression
 */
export type GlmnetFamily = "gaussian" | "binomial" | "poisson" | "multinomial";
/**
 * Multinomial penalty structure.
 * @category Regression
 */
export type GlmnetMultiType = "ungrouped" | "grouped";
/**
 * Scale or coefficient selection returned by a penalized-model prediction.
 * @category Regression
 */
export type GlmnetPredictType = "link" | "response" | "class" | "nonzero";
/**
 * Options for {@link glmnet}.
 * @category Regression
 */
export interface GlmnetOptions {
    /** Response distribution used for the penalized fit. */
    family?: GlmnetFamily;
    /** Penalty structure used for a multinomial fit. */
    typeMultinomial?: GlmnetMultiType;
    /** Elastic-net mixing parameter between ridge and lasso penalties. */
    alpha?: number;
    /** Decreasing penalty values defining the fitted regularization path. */
    lambda?: readonly number[];
    /** Requested number of penalty values in the automatic path. */
    nlambda?: number;
    /** Ratio of the final to initial penalty in the automatic path. */
    lambdaMinRatio?: number;
    /** Whether predictor columns are standardized before fitting. */
    standardize?: boolean;
    /** Whether an unpenalized intercept is included. */
    intercept?: boolean;
    /** Nonnegative prior observation weights. */
    weights?: readonly number[];
    /** Known contribution to the linear predictor. */
    offset?: readonly number[];
    /** Nonnegative coefficient-specific penalty multipliers. */
    penaltyFactor?: readonly number[];
    /** Lower bounds imposed on coefficient values. */
    lowerLimits?: number | readonly number[];
    /** Upper bounds imposed on coefficient values. */
    upperLimits?: number | readonly number[];
    /** Maximum number of active coefficients allowed in the path. */
    dfmax?: number;
    /** Maximum number of ever-active coefficients allowed in the path. */
    pmax?: number;
    /** Minimum fractional deviance improvement used for path stopping. */
    fdev?: number;
    /** Maximum fraction of null deviance explained before path stopping. */
    devmax?: number;
    /** Maximum number of optimization iterations per penalty value. */
    maxit?: number;
    /** Convergence tolerance for the penalized optimization. */
    thresh?: number;
}
/**
 * Result of a scalar-family {@link glmnet} fit.
 * @category Regression
 */
export interface GlmnetScalarResult {
    /** Response distribution used for the penalized fit. */
    family: "gaussian" | "binomial" | "poisson";
    /** Elastic-net mixing parameter between ridge and lasso penalties. */
    alpha: number;
    /** Decreasing penalty values defining the fitted regularization path. */
    lambda: number[];
    /** Intercept estimates for each penalty value. */
    a0: number[];
    /** Predictor coefficient estimates for each penalty value. */
    beta: number[][];
    /** Number of nonzero predictor coefficients at each penalty value. */
    df: number[];
    /** Fraction of null deviance explained at each penalty value. */
    devRatio: number[];
    /** Null-model deviance for the fitted family. */
    nullDev: number;
    /** Total number of coordinate-descent passes. */
    npasses: number;
    /** Whether each penalty value met the convergence criterion. */
    converged: boolean[];
    /** Maximum Karush-Kuhn-Tucker residual at each penalty value. */
    kktResidual: number[];
    /** Design, response, and preprocessing information retained by the fit. */
    model: {
        /** Original predictor matrix used by the fit. */
        x: number[][];
        /** Response values used by the fit. */
        y: number[];
        /** Nonnegative prior observation weights. */
        weights: number[];
        /** Known contribution to the linear predictor. */
        offset: number[];
        /** Predictor means used for standardization. */
        xMean: number[];
        /** Predictor scales used for standardization. */
        xScale: number[];
        /** Whether an unpenalized intercept is included. */
        intercept: boolean;
        /** Number of predictor columns. */
        columns: number;
    };
}
/**
 * Result of a multinomial {@link glmnet} fit.
 * @category Regression
 */
export interface GlmnetMultinomialResult {
    /** Response distribution used for the penalized fit. */
    family: "multinomial";
    /** Elastic-net mixing parameter between ridge and lasso penalties. */
    alpha: number;
    /** Decreasing penalty values defining the fitted regularization path. */
    lambda: number[];
    /** Intercept estimates for each penalty value. */
    a0: number[][];
    /** Predictor coefficient estimates for each penalty value. */
    beta: Record<string, number[][]>;
    /** Class-specific degrees of freedom at each penalty value. */
    dfmat: number[][];
    /** Fraction of null deviance explained at each penalty value. */
    devRatio: number[];
    /** Null-model deviance for the fitted family. */
    nullDev: number;
    /** Total number of coordinate-descent passes. */
    npasses: number;
    /** Whether each penalty value met the convergence criterion. */
    converged: boolean[];
    /** Maximum Karush-Kuhn-Tucker residual at each penalty value. */
    kktResidual: number[];
    /** Design, response, and preprocessing information retained by the fit. */
    model: {
        /** Original predictor matrix used by the fit. */
        x: number[][];
        /** Response values used by the fit. */
        y: string[];
        /** Nonnegative prior observation weights. */
        weights: number[];
        /** Known contribution to the linear predictor. */
        offset: number[];
        /** Predictor means used for standardization. */
        xMean: number[];
        /** Predictor scales used for standardization. */
        xScale: number[];
        /** Whether an unpenalized intercept is included. */
        intercept: boolean;
        /** Number of predictor columns. */
        columns: number;
        /** Class labels represented by the multinomial response. */
        classes: string[];
        /** Penalty structure used for a multinomial fit. */
        typeMultinomial: GlmnetMultiType;
    };
}
/**
 * Union of scalar-family and multinomial regularization paths.
 * @category Regression
 */
export type GlmnetResult = GlmnetScalarResult | GlmnetMultinomialResult;
/**
 * Options for {@link glmnetPredict}.
 * @category Regression
 */
export interface GlmnetPredictOptions {
    /** Penalty value or values at which coefficients or predictions are requested. */
    s?: number | readonly number[];
    /** Prediction scale or output representation. */
    type?: GlmnetPredictType;
    /** Known contribution to the linear predictor. */
    offset?: readonly number[];
}
/**
 * Options for {@link cvGlmnet}; fold assignments are required.
 * @category Regression
 */
export interface CvGlmnetOptions extends GlmnetOptions {
    /** Fixed fold assignment for deterministic cross-validation. */
    foldid: readonly number[];
    /** Loss or performance measure evaluated on held-out folds. */
    typeMeasure?: "deviance" | "mse" | "mae" | "class" | "auc";
    /** Whether fold-level scores are summarized before the cross-validation mean and standard error. */
    grouped?: boolean;
    /** Whether held-out predictions are retained. */
    keep?: boolean;
}
/**
 * Cross-validation summary returned by {@link cvGlmnet}.
 * @category Regression
 */
export interface CvGlmnetResult {
    /** Full-data penalized fit associated with cross-validation. */
    fit: GlmnetResult;
    /** Decreasing penalty values defining the fitted regularization path. */
    lambda: number[];
    /** Mean cross-validated loss at each penalty value. */
    cvm: number[];
    /** Estimated standard error of the cross-validated loss. */
    cvsd: number[];
    /** Upper one-standard-error bound for the cross-validated loss. */
    cvup: number[];
    /** Lower one-standard-error bound for the cross-validated loss. */
    cvlo: number[];
    /** Number of nonzero coefficients at each penalty value. */
    nzero: number[];
    /** Penalty value minimizing the mean cross-validated loss. */
    lambdaMin: number;
    /** Largest penalty within one standard error of the minimum loss. */
    lambda1se: number;
    /** Fixed fold assignment for deterministic cross-validation. */
    foldid: number[];
    /** Name of the cross-validation measure used. */
    name?: string;
    /** Warnings generated during cross-validation. */
    warnings?: string[];
    /** Held-out predictions retained when keep is enabled. */
    fitPreval?: number[][] | number[][][];
}
/**
 * Fit a penalized generalized linear model path. Equivalent to R's `glmnet::glmnet()`.
 *
 * @category Regression
 */
export declare function glmnet(x: readonly (readonly number[])[], y: readonly number[], options?: GlmnetOptions & {
    family?: "gaussian" | "binomial" | "poisson";
}): GlmnetScalarResult;
export declare function glmnet(x: readonly (readonly number[])[], y: readonly string[], options: GlmnetOptions & {
    family: "binomial";
}): GlmnetScalarResult;
export declare function glmnet(x: readonly (readonly number[])[], y: readonly string[], options: GlmnetOptions & {
    family: "multinomial";
}): GlmnetMultinomialResult;
/** Extract coefficients at selected penalty values. Equivalent to R's `coef.glmnet()`.
 *
 * @category Regression
 */
export declare function glmnetCoef(fit: GlmnetScalarResult, s?: number | readonly number[]): number[][];
export declare function glmnetCoef(fit: GlmnetMultinomialResult, s?: number | readonly number[]): Record<string, number[][]>;
/** Predict from a penalized generalized linear model. Equivalent to R's `predict.glmnet()`.
 *
 * @category Regression
 */
export declare function glmnetPredict(fit: GlmnetScalarResult, newx: readonly (readonly number[])[], options?: GlmnetPredictOptions): number[][];
export declare function glmnetPredict(fit: GlmnetMultinomialResult, newx: readonly (readonly number[])[], options: GlmnetPredictOptions & {
    type: "class";
}): string[][];
export declare function glmnetPredict(fit: GlmnetMultinomialResult, newx: readonly (readonly number[])[], options?: GlmnetPredictOptions & {
    type?: "link" | "response" | "nonzero";
}): number[][][];
/** Cross-validate a penalized generalized linear model. Equivalent to R's `cv.glmnet()`.
 *
 * @category Regression
 */
export declare function cvGlmnet(x: readonly (readonly number[])[], y: readonly number[], options: CvGlmnetOptions): CvGlmnetResult;
export declare function cvGlmnet(x: readonly (readonly number[])[], y: readonly string[], options: CvGlmnetOptions & {
    family: "binomial" | "multinomial";
}): CvGlmnetResult;
