import { type DesignContrast } from "./modelMatrix.js";
import type { DataFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";
/**
 * Links of the mean in {@link betareg}.
 * @category Regression
 */
export type BetaregLink = "logit" | "probit" | "cloglog" | "cauchit" | "log" | "loglog";
/**
 * Links of the precision in {@link betareg}.
 * @category Regression
 */
export type BetaregPhiLink = "identity" | "log" | "sqrt";
/**
 * Estimators of {@link betareg}: maximum likelihood, bias-corrected, bias-reduced.
 * @category Regression
 */
export type BetaregType = "ML" | "BC" | "BR";
/**
 * Options for {@link betareg}.
 * @category Regression
 */
export interface BetaregOptions {
    /** Link of the mean (default `"logit"`). */
    link?: BetaregLink;
    /** Link of the precision phi (default `"identity"` for `y ~ x`, `"log"` for `y ~ x | z`). */
    linkPhi?: BetaregPhiLink;
    /** Estimator: `"ML"` (default), `"BC"` (bias-corrected) or `"BR"` (bias-reduced), as Kosmidis and Firth (2010). */
    type?: BetaregType;
    /** Case weights, one per row of `data` (non-negative), or the name of a column of `data`. */
    weights?: Sample | string;
    /** A contrast per factor of the formula (default treatment contrasts). */
    contrasts?: Record<string, DesignContrast>;
    /** Iterations: at most `maxit` (default 5000) Fisher scoring steps for ML and BR. */
    maxit?: number;
}
/**
 * What predictions on new data need.
 * @category Regression
 */
export interface BetaregModel {
    /** The right-hand side of the mean model (parsed). */
    meanRhs: unknown;
    /** The right-hand side of the precision model (parsed; undefined for a constant precision). */
    precisionRhs: unknown;
    /** The levels of the factors. */
    factorLevels: Record<string, readonly string[]>;
    /** The contrasts given. */
    contrasts: Record<string, DesignContrast>;
    /** The variables of both parts (without the response). */
    variables: string[];
    /** The mean model's matrix of the rows used. */
    x: number[][];
    /** The precision model's matrix. */
    z: number[][];
    /** The response. */
    y: number[];
    /** The case weights. */
    weights: number[];
    /** 0-based rows of the data used. */
    rows: number[];
    /** The mean model's matrix as fitted: columns centred and divided by a power of 2 (the hat values use it). */
    xScaled: number[][];
}
/**
 * Result of {@link betareg}.
 * @category Regression
 */
export interface BetaregResult {
    /** Coefficients of the mean model and of the precision model. */
    coefficients: BetaregCoefficients;
    /** Names of the mean coefficients. */
    meanNames: string[];
    /** `(phi)` for a constant precision with the identity link, else `(phi)_` and the term. */
    precisionNames: string[];
    /** All names (mean, then precision), the rows and columns of `vcov`. */
    names: string[];
    /** Covariance of all coefficients: the inverse of the expected information at the estimates. */
    vcov: number[][];
    /** Log-likelihood at the estimates. */
    loglik: number;
    /** Squared (weighted) correlation of the linear predictor and the link-transformed response. */
    pseudoRSquared: number;
    /** The first-order bias at the maximum likelihood estimates (`type: "BC"` only), as R's `bias`. */
    bias?: number[];
    /** Fitted means. */
    fitted: number[];
    /** Linear predictors of the mean. */
    linearPredictor: number[];
    /** Fitted precisions. */
    precision: number[];
    /** Link of the mean. */
    link: BetaregLink;
    /** Link of the precision. */
    linkPhi: BetaregPhiLink;
    /** The estimator. */
    type: BetaregType;
    /** Rows used. */
    n: number;
    /** Rows with a positive weight. */
    nobs: number;
    /** Residual degrees of freedom of the null model (constant mean and precision): nobs − 2. */
    dfNull: number;
    /** Residual degrees of freedom of this model. */
    dfResidual: number;
    /** Fisher scoring iterations (rStats.js's, not R's BFGS and scoring counts). */
    iterations: number;
    /** Whether the iterations converged. */
    converged: boolean;
    /** What predictions and residuals need. */
    model: BetaregModel;
    /** Warnings. */
    warnings: string[];
}
/**
 * The coefficients of a {@link betareg} fit.
 * @category Regression
 */
export interface BetaregCoefficients {
    /** Of the mean model. */
    mean: number[];
    /** Of the precision model. */
    precision: number[];
}
/**
 * A Wald table of {@link betaregSummary}.
 * @category Regression
 */
export interface BetaregCoefficientTable {
    /** Coefficient names. */
    names: string[];
    /** Estimates. */
    estimate: number[];
    /** Standard errors. */
    se: number[];
    /** Wald z statistics. */
    z: number[];
    /** Two-sided p-values. */
    p: number[];
}
/**
 * Beta regression for rates and proportions in (0, 1): the mean linked to a linear predictor, the precision phi
 * constant (`y ~ x`) or linked to its own regressors (`y ~ x | z`), fitted by maximum likelihood, or bias-corrected or
 * bias-reduced (Kosmidis and Firth 2010). Equivalent to R's `betareg::betareg()`.
 *
 * The response must lie strictly between 0 and 1 (R fits an extended-support distribution to 0 and 1; rStats.js does
 * not). rStats.js maximises the likelihood to convergence by Fisher scoring; R stops its optimiser slightly earlier,
 * so estimates agree with R's to about 1e-7 relative.
 * @example
 * ```ts
 * const fit = betareg("y ~ x", { y: [0.21, 0.35, 0.3, 0.52, 0.48, 0.66, 0.6, 0.81], x: [1, 2, 3, 4, 5, 6, 7, 8] });
 * fit.coefficients; // { mean: [-1.5409, 0.33424], precision: [62.03] }
 * ```
 * @category Regression
 */
export declare function betareg(formula: string, data: DataFrame, options?: BetaregOptions): BetaregResult;
/**
 * Result of {@link betaregSummary}.
 * @category Regression
 */
export interface BetaregSummaryResult {
    /** Wald table of the mean coefficients. */
    mean: BetaregCoefficientTable;
    /** Wald table of the precision coefficients. */
    precision: BetaregCoefficientTable;
    /** Log-likelihood. */
    loglik: number;
    /** Number of coefficients (the degrees of freedom of the log-likelihood). */
    df: number;
    /** Akaike's information criterion. */
    aic: number;
    /** Pseudo R². */
    pseudoRSquared: number;
    /** The estimator. */
    type: BetaregType;
    /** Link of the mean. */
    link: BetaregLink;
    /** Link of the precision. */
    linkPhi: BetaregPhiLink;
    /** Minimum, quartiles and maximum of the quantile residuals. */
    residuals: number[];
}
/**
 * Summary of a {@link betareg} fit: Wald tests of the mean and precision coefficients. Equivalent to
 * `betareg::summary.betareg()` in R.
 * @example
 * ```ts
 * const fit = betareg("y ~ x", { y: [0.21, 0.35, 0.3, 0.52, 0.48, 0.66, 0.6, 0.81], x: [1, 2, 3, 4, 5, 6, 7, 8] });
 * betaregSummary(fit).mean.p; // [2.355e-12, 2.267e-14]
 * ```
 * @category Regression
 */
export declare function betaregSummary(fit: BetaregResult): BetaregSummaryResult;
/**
 * Options for {@link betaregConfint}.
 * @category Regression
 */
export interface BetaregConfintOptions {
    /** Confidence level (default 0.95). */
    level?: number;
}
/**
 * Result of {@link betaregConfint}.
 * @category Regression
 */
export interface BetaregConfintResult {
    /** Coefficient names (mean, then precision). */
    names: string[];
    /** Lower limits. */
    lower: number[];
    /** Upper limits. */
    upper: number[];
}
/**
 * Wald confidence intervals of all coefficients of a {@link betareg} fit. Equivalent to R's
 * `confint()`.
 * @example
 * ```ts
 * const fit = betareg("y ~ x", { y: [0.21, 0.35, 0.3, 0.52, 0.48, 0.66, 0.6, 0.81], x: [1, 2, 3, 4, 5, 6, 7, 8] });
 * betaregConfint(fit, { level: 0.9 });
 * // { names: ["(Intercept)", "x", "(phi)"], lower: [-1.9023, 0.26223, 11.375], upper: [-1.1794, 0.40625, 112.68] }
 * ```
 * @category Regression
 */
export declare function betaregConfint(fit: BetaregResult, options?: BetaregConfintOptions): BetaregConfintResult;
/**
 * Options for {@link betaregPredict}.
 * @category Regression
 */
export interface BetaregPredictOptions {
    /** New data (default: the rows of the fit). */
    newdata?: DataFrame;
    /**
     * `"response"` (the mean, default), `"link"`, `"precision"`, `"variance"`, `"parameters"` (rows of [mu, phi]),
     * `"density"`, `"probability"` or `"quantile"` (at `at`).
     */
    type?: "response" | "link" | "precision" | "variance" | "parameters" | "density" | "probability" | "quantile";
    /** Where `"density"`, `"probability"` and `"quantile"` are evaluated (default 0.5). */
    at?: number | readonly number[];
    /**
     * One value of `at` per row (a vector) or every value at every row (a matrix of rows x at). Default: per row when
     * `at` has as many values as there are rows, else the matrix (as R).
     */
    elementwise?: boolean;
}
/**
 * Predictions of a {@link betareg} fit: means, linear predictors, precisions, variances, or the density,
 * distribution function or quantiles of the fitted beta distributions. Equivalent to
 * `betareg::predict.betareg()` in R.
 * @example
 * ```ts
 * const fit = betareg("y ~ x", { y: [0.21, 0.35, 0.3, 0.52, 0.48, 0.66, 0.6, 0.81], x: [1, 2, 3, 4, 5, 6, 7, 8] });
 * betaregPredict(fit, { newdata: { x: [2.5, 9] } }); // [0.33064, 0.81265]
 * betaregPredict(fit, { type: "quantile", at: [0.1, 0.9] }); // one row per observation: [[0.16414, 0.30026], ...]
 * ```
 * @category Regression
 */
export declare function betaregPredict(fit: BetaregResult, options?: BetaregPredictOptions): number[] | number[][];
/**
 * Options for {@link betaregResiduals}.
 * @category Regression
 */
export interface BetaregResidualsOptions {
    /** `"quantile"` (default), `"deviance"`, `"pearson"`, `"response"`, `"weighted"`, `"sweighted"` or `"sweighted2"`. */
    type?: "quantile" | "deviance" | "pearson" | "response" | "weighted" | "sweighted" | "sweighted2";
}
/**
 * Residuals of a {@link betareg} fit (Espinheira, Ferrari and Cribari-Neto 2008; quantile residuals of Dunn and Smyth
 * 1996). Every type but `"response"` is multiplied by the square root of the case weight, as R. Equivalent to
 * `betareg::residuals.betareg()` in R.
 * @example
 * ```ts
 * const fit = betareg("y ~ x", { y: [0.21, 0.35, 0.3, 0.52, 0.48, 0.66, 0.6, 0.81], x: [1, 2, 3, 4, 5, 6, 7, 8] });
 * betaregResiduals(fit, { type: "sweighted2" }).slice(0, 3); // [-0.38464, 1.1271, -1.2608]
 * ```
 * @category Regression
 */
export declare function betaregResiduals(fit: BetaregResult, options?: BetaregResidualsOptions): number[];
