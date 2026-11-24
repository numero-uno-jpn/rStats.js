/**
 * A matrix given as an array of rows. Each row may be a plain array or a `Float64Array`;
 * all rows must have the same length. A matrix with zero rows is treated as 0 x 0.
 *
 * @category Linear algebra
 */
export type MatrixInput = readonly (readonly number[] | Float64Array)[];
/**
 * A vector or a matrix (array of rows). Used for arguments that accept either, such as the
 * right-hand side of `backsolve`; a vector is treated as a one-column matrix, as in R.
 *
 * @category Linear algebra
 */
export type VectorOrMatrix = readonly number[] | Float64Array | MatrixInput;
/** Column-major matrix. Element (i, j) is data[i + j * nrow] */
export interface Mat {
    nrow: number;
    ncol: number;
    data: Float64Array;
}
export declare function newMat(nrow: number, ncol: number): Mat;
export declare function isMatrixInput(x: VectorOrMatrix): x is MatrixInput;
/** Convert an array of rows to a column-major matrix. Error if the rows differ in length */
export declare function toMat(x: MatrixInput): Mat;
/** A vector becomes a one-column matrix (as R's as.matrix) */
export declare function toMatOrColumn(x: VectorOrMatrix): Mat;
/** Convert a column-major matrix back to an array of rows */
export declare function fromMat(m: Mat): number[][];
/** Return column j as an array */
export declare function column(m: Mat, j: number): number[];
export declare function transpose(m: Mat): Mat;
export declare function hasNonFinite(m: Mat): boolean;
export declare function requireSquare(m: Mat, what?: string): void;
/**
 * 0 when the largest absolute value is within [2^-256, 2^256] (or all are 0); otherwise its binary exponent, the
 * power of 2 to divide by to bring the values near 1
 */
export declare function rangeExponent(data: ArrayLike<number>): number;
/**
 * The power of 2 to divide a matrix by before a decomposition (eigen, schur, svd, and the condition estimates of
 * rcond, solve and kappa): 0 within [2^-256, 2^256]; a smaller matrix is brought up near 1, a larger one only down to
 * [2^256, 2^257), the top of the range used as given (#127, #131, #132). Bringing it down to 1 put every entry below
 * 2 of a matrix near 1e308 into the subnormal range: svd(diag(1e308, 1e-15)) gave 8.9e-16 and ginv's 1/d overflowed.
 * Division by a power of 2 is exact, so a matrix whose result was finite and correct gives the same bits. eigen passes
 * top = 459, LAPACK's dgeev bound (see eigen)
 */
export declare function decompositionExponent(data: ArrayLike<number>, top?: number): number;
