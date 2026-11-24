import type { DataFrame } from "../models/modelFrame.js";
/** Name of a multivariate test statistic.
 * @category Multivariate analysis
 */
export type ManovaTestName = "Pillai" | "Wilks" | "Hotelling-Lawley" | "Roy";
/** Numerical options for MANOVA.
 * @category Multivariate analysis
 */
export interface ManovaOptions {
    /** Numerical tolerance used to determine matrix and residual ranks. Default 1e-7. */
    tol?: number;
}
/** Options for MANOVA summary tables.
 * @category Multivariate analysis
 */
export interface ManovaSummaryOptions {
    /** Numerical tolerance used when recomputing the generalized roots. Default 1e-7. */
    tol?: number;
    /** Include the sequential intercept row when the fitted model has one. Default false. */
    intercept?: boolean;
}
/** A labelled matrix table.
 * @category Multivariate analysis
 */
export interface MatrixTable {
    /** Row labels; a scalar string is used for a one-row table. */
    rows: string[];
    /** Column labels, or null for a matrix without named columns. */
    cols: string[] | null;
    /** Numeric table entries in row-major order. */
    values: number[][];
}
/** A fitted sequential MANOVA model.
 * @category Multivariate analysis
 */
export interface ManovaFit {
    /** Formula used to fit the model. */
    formula: string;
    /** Names or expressions of the response variables in formula order. */
    responseNames: string[];
    /** Sequential model terms in formula order. */
    termNames: string[];
    /** Degrees of freedom contributed by each sequential term. */
    termDf: number[];
    /** Residual degrees of freedom. */
    residualDf: number;
    /** Residual sum-of-squares-and-cross-products matrix on the original response scales. */
    residualSSP: number[][];
    /** Sum-of-squares-and-cross-products matrix for each fitted term, keyed by term name. */
    termSSP: Record<string, number[][]>;
    /** Generalized roots for each fitted term, keyed by term name. */
    termRoots: Record<string, number[]>;
    /** Regression coefficient matrix, with terms in rows and responses in columns. */
    coefficients: number[][];
    /** Names of the coefficient rows. */
    coefficientNames: string[];
    /** Power-of-two scale factors used internally for each response. */
    responseScales: number[];
    /** Warnings produced while fitting the model. */
    warnings: string[];
    /** @internal Scaled residual SSP retained for numerically stable summary calculations. */
    _residualSSPScaled: number[][];
    /** @internal Scaled term SSP matrices retained for numerically stable summary calculations. */
    _termSSPScaled: Record<string, number[][]>;
}
/** Four multivariate test tables and associated matrices.
 * @category Multivariate analysis
 */
export interface ManovaSummary {
    /** Pillai's trace test table. */
    Pillai: MatrixTable;
    /** Wilks' lambda test table. */
    Wilks: MatrixTable;
    /** Hotelling-Lawley trace test table. */
    "Hotelling-Lawley": MatrixTable;
    /** Roy's largest-root test table. */
    Roy: MatrixTable;
    /** Sum-of-squares-and-cross-products matrices, keyed by model term and residuals. */
    SS: Record<string, MatrixTable>;
    /** Generalized roots for each displayed model term. */
    Eigenvalues: MatrixTable;
    /** Regression coefficient matrix with labelled rows and response columns. */
    coef: MatrixTable;
    /** Roy largest-root F approximation is an upper bound. */
    royFIsUpperBound: true;
}
/**
 * Fit a multivariate analysis of variance model with sequential (Type I) terms. Equivalent to R's `stats::manova()`.
 * The response is `cbind(y1, y2, ...)`; all four classical MANOVA statistics are available in {@link manovaSummary}.
 *
 * @param formula Multivariate formula, e.g. `"cbind(y1, y2, y3) ~ group + covariate"`.
 * @param data Data frame.
 * @param options Numerical rank tolerance.
 *
 * @category Multivariate analysis
 */
export declare function manova(formula: string, data: DataFrame, options?: ManovaOptions): ManovaFit;
/**
 * Summary tables for all four MANOVA statistics, with optional sequential intercept row. Equivalent to R's `summary.manova()`.
 *
 * @param fit A result of {@link manova}.
 * @param options Select a statistic or request the intercept row.
 *
 * @category Multivariate analysis
 */
export declare function manovaSummary(fit: ManovaFit, options?: ManovaSummaryOptions): ManovaSummary;
