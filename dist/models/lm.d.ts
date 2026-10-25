import type { MatrixInput } from "../linalg/matrix.js";
import { type QR } from "../linalg/qr.js";
import type { Sample } from "../htest/types.js";
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
/**
 * Fit a linear model by least squares. Equivalent to R's `lm(y ~ x)` (or `y ~ x - 1` without intercept, with
 * `weights` for weighted least squares) together with `summary()`; the predictors are given as a matrix instead of a
 * formula. Rows with a missing value in `x`, `y` or the weights are dropped.
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
