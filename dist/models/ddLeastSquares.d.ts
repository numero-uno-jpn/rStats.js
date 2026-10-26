import { type DD } from "../special/dd.js";
export declare function ddSqrt(a: DD): DD;
/** Square roots of the weights in double-double (1 without weights) */
export declare function ddSqrtWeights(w: readonly number[] | undefined, n: number): DD[];
/** Result of {@link ddLeastSquares}. */
export interface DDLeastSquares {
    /** Q'y, one element per row: the effects of the columns, then the residual coordinates. */
    qty: DD[];
    /** Coefficients of the columns, in the order given. */
    coef: DD[];
}
/**
 * Least squares of y on the given columns (all assumed linearly independent; rows already scaled by the square roots
 * of the weights).
 *
 * @param cols The columns (each with one entry per row).
 * @param y The response.
 */
export declare function ddLeastSquares(cols: readonly (readonly DD[])[], y: readonly DD[]): DDLeastSquares;
/**
 * {@link ddLeastSquares}, and Q'v for more vectors (with the same decomposition of the columns).
 *
 * @param vectors More vectors (each with one entry per row) to transform by Q'.
 */
export declare function ddLeastSquaresMulti(cols: readonly (readonly DD[])[], y: readonly DD[], vectors: readonly (readonly DD[])[]): {
    fit: DDLeastSquares;
    qtv: DD[][];
};
/** Sum of squares of the elements from..to-1 */
export declare function ddSumSquares(v: readonly DD[], from?: number, to?: number): DD;
