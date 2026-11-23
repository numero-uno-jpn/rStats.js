import { type VectorOrMatrix } from "../linalg/matrix.js";
/** Options for canonical correlation.
 * @category Multivariate analysis
 */
export interface CancorOptions {
    /** Center the columns of x by their means, leave them uncentered, or supply explicit centers. Default true. */
    xcenter?: boolean | readonly number[];
    /** Center the columns of y by their means, leave them uncentered, or supply explicit centers. Default true. */
    ycenter?: boolean | readonly number[];
    /** Numerical tolerance used to determine the ranks of x and y. Default 1e-7. */
    tol?: number;
    /** Names for the columns of x. */
    xNames?: readonly string[];
    /** Names for the columns of y. */
    yNames?: readonly string[];
}
/** Result of canonical correlation.
 * @category Multivariate analysis
 */
export interface CancorResult {
    /** Canonical correlations, ordered from largest to smallest. */
    cor: number[];
    /** Canonical coefficients for x, with original variable names in rows. */
    xcoef: {
        /** Names of the x variables (`null` without names), as R's row names. */
        rows: string[] | null;
        /** Always `null`: R gives the columns (the canonical variates) no names. */
        cols: null;
        /** The coefficients: one row per x variable, one column per canonical variate. */
        values: number[][];
    };
    /** Canonical coefficients for y, with original variable names in rows. */
    ycoef: {
        /** Names of the y variables (`null` without names), as R's row names. */
        rows: string[] | null;
        /** Always `null`: R gives the columns (the canonical variates) no names. */
        cols: null;
        /** The coefficients: one row per y variable, one column per canonical variate. */
        values: number[][];
    };
    /** Centers applied to the columns of x. */
    xcenter: number[];
    /** Centers applied to the columns of y. */
    ycenter: number[];
}
/**
 * Canonical correlation analysis. Equivalent to R's `stats::cancor()`. Coefficients use the unscaled cross-products, with deterministic paired signs.
 *
 * @param x First data matrix or vector.
 * @param y Second data matrix or vector.
 * @param options Column centering, rank tolerance, and optional column names.
 *
 * @category Multivariate analysis
 */
export declare function cancor(x: VectorOrMatrix, y: VectorOrMatrix, options?: CancorOptions): CancorResult;
