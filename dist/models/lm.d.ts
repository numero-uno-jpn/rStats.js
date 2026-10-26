import type { MatrixInput } from "../linalg/matrix.js";
import { type QR } from "../linalg/qr.js";
import type { Sample } from "../htest/types.js";
import type { DataFrame } from "./modelFrame.js";
import { type Design, type ModelMatrixOptions } from "./modelMatrix.js";
/** Options for {@link lm}. */
export interface LmOptions {
    /** Include an intercept (a column of ones before the columns of `x`). Default `true`. */
    intercept?: boolean;
    /** Weights for weighted least squares (non-negative; rows of weight 0 are left out of the fit). */
    weights?: Sample;
}
/** Result of {@link lm}: the fit and the quantities of R's `summary(lm)`. */
export interface LmResult {
    /** Coefficients (intercept first); NaN for aliased columns. */
    coefficients: number[];
    /** Residuals y - fitted (rows with a missing value dropped; rows of weight 0 included). */
    residuals: number[];
    fittedValues: number[];
    /** Numerical rank of the model matrix. */
    rank: number;
    /** Residual degrees of freedom, n - rank (n counts the rows of non-zero weight). */
    dfResidual: number;
    /** The coefficient table of the columns that are not aliased, in their order. */
    coefTable: {
        estimate: number[];
        stdError: number[];
        tValue: number[];
        pValue: number[];
    };
    /** Residual standard error. */
    sigma: number;
    /** R^2; 0 for a model with nothing beyond the intercept, as in R. */
    rSquared: number;
    /** Adjusted R^2; 0 for a model with nothing beyond the intercept, as in R. */
    adjRSquared: number;
    /**
     * Overall F statistic with its degrees of freedom. Absent (as is `fPValue`) when the model has nothing beyond the
     * intercept, where R's `summary(lm)` has no `fstatistic`.
     */
    fStatistic?: {
        value: number;
        numdf: number;
        dendf: number;
    };
    /** p-value of the overall F test; absent with `fStatistic`. */
    fPValue?: number;
    /** Whether the model has an intercept. */
    intercept: boolean;
    /** The QR decomposition of the (weighted) model matrix. */
    qr: QR;
}
/** Options of {@link lm} with a formula. */
export interface LmFormulaOptions extends ModelMatrixOptions {
    /** Weights: an array parallel to the rows of `data`, or the name of a numeric column. */
    weights?: Sample | string;
}
/** Result of {@link lm} with a formula: the fit of the model matrix, with the formula's terms. */
export interface LmFormulaResult extends LmResult {
    /** The formula. */
    formula: string;
    /** The response's name. */
    response: string;
    /** Names of the coefficients (the model matrix's column names). */
    coefNames: string[];
    /** The term of each coefficient (0 for the intercept). */
    assign: number[];
    /** Labels of the terms. */
    termLabels: string[];
    /** Degree of each term. */
    order: number[];
    /** The variables of the formula, the response first. */
    variables: string[];
    /** R's factors attribute of the terms (one array per variable, one code per term). */
    factors: number[][];
    /** 0-based indices of the rows of `data` used. */
    rows: number[];
    /** The model matrix (rows used). */
    x: number[][];
    /** The response (rows used). */
    y: number[];
    /** The weights (rows used), if any. */
    weights?: number[];
    /** The effects Q'y of the (weighted) fit, one per row of non-zero weight. */
    effects: number[];
    /** The weighted residual sum of squares. */
    rss: number;
    /** Number of rows of non-zero weight. */
    nObs: number;
    /** Whether this is an `aov` fit. */
    aov: boolean;
    /** R's warnings (from the model matrix and from `summary()`). */
    warnings: string[];
}
/** The formula fit (lm, and aov without Error()) */
export declare function lmFormulaFit(formula: string, d: Design, aov: boolean): LmFormulaResult;
/**
 * Fit a linear model from a formula. Equivalent to R's `lm(formula, data)` (with `weights` and `contrasts`)
 * together with `summary()`.
 *
 * The model matrix is that of {@link modelMatrix} (but levels without rows are dropped, as R's
 * `drop.unused.levels`); the fit is that of the matrix form (same pivoting and tolerance), its sums of squares computed
 * in double-double so that data with a large mean keep their accuracy. Rows with a missing value in a variable of the
 * formula or in the weights are dropped (`rows` lists those used).
 *
 * @param formula A formula such as `"y ~ A * B + x"`.
 * @param data The data frame: an object of columns.
 *
 * @example
 * ```ts
 * const fit = lm("y ~ g", { y: [2.1, 3.9, 6.2, 7.8, 10.1, 11.8], g: ["a", "a", "b", "b", "c", "c"] });
 * fit.coefNames;    // ["(Intercept)", "gb", "gc"]
 * fit.coefficients; // [3, 4, 7.95]
 * ```
 */
export declare function lm(formula: string, data: DataFrame, options?: LmFormulaOptions): LmFormulaResult;
/**
 * Fit a linear model by least squares, the predictors given as a matrix. Equivalent to R's `lm(y ~ x)` (or
 * `y ~ x - 1` without intercept, with `weights` for weighted least squares) together with `summary()`. Rows with a
 * missing value in `x`, `y` or the weights are dropped.
 *
 * @param x Predictors: a matrix (array of rows, one column per predictor) or a vector (one predictor).
 * @param y Response.
 *
 * @example
 * ```ts
 * const fit = lm([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]);
 * fit.coefficients; // [intercept, slope]
 * fit.rSquared;
 * ```
 */
export declare function lm(x: MatrixInput | Sample, y: Sample, options?: LmOptions): LmResult;
/** The quantities of a fit that the formula interface and the analyses of variance need besides the result */
export interface LmCore {
    result: LmResult;
    /** The rows of non-zero weight (indices into the rows given) */
    fitRows: number[];
    /** The effects Q'y of the (weighted) fit, one per row of non-zero weight (only for a precise fit) */
    effects: number[];
    /** The weighted residual sum of squares */
    rss: number;
}
/**
 * Least squares on a full model matrix (the column of ones included when `intercept` is true). Rows of weight 0 are
 * left out of the fit and of the counts.
 */
export declare function fitLm(Xall: number[][], Yall: number[], Wall: number[] | undefined, intercept: boolean, precise?: boolean): LmCore;
/** Options for {@link confint}. */
export interface ConfintOptions {
    /** Confidence level. Default `0.95`. */
    level?: number;
}
/**
 * Confidence intervals for the coefficients of a linear model (NaN for aliased columns). Equivalent to R's
 * `confint()` for an `lm` fit.
 */
export declare function confint(fit: LmResult, options?: ConfintOptions): {
    lower: number[];
    upper: number[];
};
/** Options for {@link predict}. */
export interface PredictOptions {
    /** `"none"` (default), `"confidence"` (for the mean response) or `"prediction"` (for a new observation). */
    interval?: "none" | "confidence" | "prediction";
    /** Confidence level of the interval. Default `0.95`. */
    level?: number;
}
/**
 * Predictions of a linear model at new values of the predictors, with standard errors and optionally intervals.
 * Equivalent to R's `predict()` for an `lm` fit (`se.fit = TRUE`). Aliased columns are left out, as R does.
 *
 * @param newdata New predictor values, with the columns of `x` (no column of ones).
 */
export declare function predict(fit: LmResult, newdata: MatrixInput | Sample, options?: PredictOptions): {
    fit: number[];
    seFit: number[];
    lwr?: number[];
    upr?: number[];
};
