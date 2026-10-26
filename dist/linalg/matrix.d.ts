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
