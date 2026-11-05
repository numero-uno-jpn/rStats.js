import { type Mat, type MatrixInput } from "./matrix.js";
/**
 * Options for {@link svd}.
 *
 * @category Linear algebra
 */
export interface SvdOptions {
    /** Number of left singular vectors to compute. Default: `min(nrow, ncol)`. A fraction is truncated toward zero, and values above the number of rows (`Infinity` included) are reduced to it. Negative values and `NaN` are errors. */
    nu?: number;
    /** Number of right singular vectors to compute. Default: `min(nrow, ncol)`. A fraction is truncated toward zero, and values above the number of columns (`Infinity` included) are reduced to it. Negative values and `NaN` are errors. */
    nv?: number;
}
/**
 * Result of {@link svd}: `x = u %*% diag(d) %*% t(v)`.
 *
 * @category Linear algebra
 */
export interface SvdResult {
    /** The singular values, in decreasing order. */
    d: number[];
    /** The left singular vectors as columns (`nrow` x `nu`, array of rows). Omitted when `nu` is 0. */
    u?: number[][];
    /** The right singular vectors as columns (`ncol` x `nv`, array of rows). Omitted when `nv` is 0. */
    v?: number[][];
}
/**
 * Singular value decomposition. Equivalent to R's `svd()`.
 *
 * Uses the Golub-Reinsch algorithm, while R uses LAPACK's `dgesdd`. Singular values agree with R up to
 * rounding, but the signs of singular vectors may differ from R (both are correct); for repeated singular
 * values the vectors may span the same subspace with a different basis. Singular vectors beyond
 * `min(nrow, ncol)` are a basis of the orthogonal complement and do not match R. Throws on `NaN` or infinite values.
 *
 * @param x A matrix (array of rows).
 * @param options See {@link SvdOptions}.
 * @returns The singular values and vectors. See {@link SvdResult}.
 *
 * @example
 * ```ts
 * svd([[3, 0], [0, 4]]);
 * // { d: [4, 3], u: [[0, 1], [1, 0]], v: [[0, 1], [1, 0]] }  (signs of u and v may differ from R)
 * ```
 *
 * @category Linear algebra
 */
export declare function svd(x: MatrixInput, options?: SvdOptions): SvdResult;
/**
 * The SVD with the singular values of x 2^-s: x = U diag(d 2^s) V'. For ratios and cut-offs of the singular values
 * of a matrix of extreme magnitude, whose values themselves can overflow or underflow (kappa, ginv)
 */
export declare function svdScaled(x: MatrixInput, options?: SvdOptions): SvdResult & {
    s: number;
};
/** Singular values only (decreasing) */
export declare function svdValues(a: Mat): Float64Array;
