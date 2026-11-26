import { type VectorOrMatrix } from "../linalg/matrix.js";
import { type GroupLabel } from "../htest/groups.js";
import type { DataFrame } from "../models/modelFrame.js";
/** Options for LDA fitting.
 * @category Multivariate analysis
 */
export interface LdaOptions {
    /** Fitting method; only "moment" is supported. Default "moment". */
    method?: "moment" | string;
    /** Prior class probabilities, in class-level order. Defaults to observed class proportions. */
    prior?: readonly number[];
    /** Numerical tolerance for rank determination and within-class covariance calculations. Default 1e-4. */
    tol?: number;
    /** Return leave-one-out cross-validation predictions instead of a fitted model. Default false. */
    CV?: boolean;
    /** Names for predictor columns in matrix input. */
    xNames?: readonly string[];
    /** Declared class levels; unused levels remain in `lev` and produce warnings. */
    groupLevels?: readonly GroupLabel[];
    /** Explicit factor levels for formula variables. */
    levels?: Record<string, readonly string[]>;
}
/** Options for LDA prediction.
 * @category Multivariate analysis
 */
export interface LdaPredictionOptions {
    /** Prediction method; only "plug-in" is supported. Default "plug-in". */
    method?: "plug-in" | string;
    /** New predictor rows; omitted to predict the observations used to fit the model. */
    newdata?: VectorOrMatrix;
    /** Prior class probabilities for this prediction. Defaults to the fitted priors. */
    prior?: readonly number[];
    /** Number of discriminant score dimensions to return. Defaults to all available dimensions. */
    dimen?: number;
}
/** A labelled LDA result matrix.
 * @category Multivariate analysis
 */
export interface LdaTable {
    /** Row labels, or null when rows are observations without labels. */
    rows: string[] | null;
    /** Column labels, or null when columns are not named. */
    cols: string[] | null;
    /** Numeric matrix entries in row-major order. */
    values: number[][];
}
/** A fitted linear discriminant model.
 * @category Multivariate analysis
 */
export interface LdaFit {
    /** Prior class probabilities in the order of `lev`. */
    prior: number[];
    /** Number of training observations in each class. */
    counts: number[];
    /** Class means, with classes in rows and predictors in columns. */
    means: LdaTable;
    /** Metric-normalised discriminant directions, with predictors in rows and dimensions in columns. */
    scaling: LdaTable;
    /** Singular values associated with the discriminant dimensions. */
    svd: number[];
    /** Number of observations used to fit the model. */
    N: number;
    /** Class labels in prediction and prior order. */
    lev: string[];
    /** Warnings produced while fitting the model. */
    warnings: string[];
    /** @internal Unscaled class means retained for prediction. */
    _means: number[][];
    /** @internal Class labels with non-empty training observations. */
    _activeLev: string[];
    /** @internal Prior-weighted center of the predictor columns. */
    _center: number[];
    /** @internal Internal discriminant directions in scaled predictor coordinates. */
    _scaling: number[][];
    /** @internal Inverse pooled within-class covariance matrix. */
    _covInverse: number[][];
    /** @internal Predictor scale factors used internally. */
    _scale: number[];
    /** @internal Column origins in coordinates divided by `_scale`. */
    _origin: number[];
    /** @internal Column spread factors after removing a dominant offset. */
    _spread: number[];
    /** @internal Scaled training predictor matrix. */
    _x: number[][];
    /** @internal Predictor column names. */
    _xNames: string[];
    /** @internal Rank tolerance used to fit the model. */
    _tol: number;
}
/** Plug-in prediction from an LDA fit.
 * @category Multivariate analysis
 */
export interface LdaPrediction {
    /** Predicted class label for each observation. */
    class: string[];
    /** Posterior class probabilities, with classes in columns. */
    posterior: LdaTable;
    /** Discriminant scores for each observation. */
    x: LdaTable;
}
/** Leave-one-out LDA predictions.
 * @category Multivariate analysis
 */
export interface LdaCVResult {
    /** Leave-one-out predicted class label for each training observation. */
    class: string[];
    /** Leave-one-out posterior class probabilities, with classes in columns. */
    posterior: LdaTable;
}
/**
 * Linear discriminant analysis (moment method). Equivalent to R's `MASS::lda()`. The moment method only. Supports matrix/group and formula/data-frame inputs.
 * Directions are metric-normalised and their signs are deterministic.
 *
 * @param x Predictor matrix.
 * @param grouping Class labels.
 * @param options Prior probabilities, tolerance, and leave-one-out CV.
 * @category Multivariate analysis
 */
export declare function lda(x: VectorOrMatrix, grouping: readonly GroupLabel[], options?: LdaOptions & {
    CV?: false;
}): LdaFit;
/** Leave-one-out cross-validation result overload. */
export declare function lda(x: VectorOrMatrix, grouping: readonly GroupLabel[], options: LdaOptions & {
    CV: true;
}): LdaCVResult;
/**
 * Linear discriminant analysis from a formula, e.g. `"class ~ x1 + x2"` or `"class ~ ."`.
 *
 * @param formula Formula.
 * @param data Data frame.
 * @param options Prior probabilities, tolerance, and leave-one-out CV.
 */
export declare function lda(formula: string, data: DataFrame, options?: LdaOptions & {
    CV?: false;
}): LdaFit;
export declare function lda(formula: string, data: DataFrame, options: LdaOptions & {
    CV: true;
}): LdaCVResult;
/**
 * Plug-in prediction for a fitted {@link lda} model. Equivalent to R's `predict.lda()`. The plug-in method only.
 *
 * @param fit A fitted LDA model.
 * @param options New observations, prior override, and number of discriminant scores.
 * @category Multivariate analysis
 */
export declare function ldaPredict(fit: LdaFit, options?: LdaPredictionOptions): LdaPrediction;
