import { type Mat, type MatrixInput } from "./matrix.js";
/** Options for {@link svd}. */
export interface SvdOptions {
    /** Number of left singular vectors to compute. Default: `min(nrow, ncol)`. Values above the number of rows are reduced to it. */
    nu?: number;
    /** Number of right singular vectors to compute. Default: `min(nrow, ncol)`. Values above the number of columns are reduced to it. */
    nv?: number;
}
/** Result of {@link svd}: `x = u %*% diag(d) %*% t(v)`. */
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
 */
export declare function svd(x: MatrixInput, options?: SvdOptions): SvdResult;
/** Singular values only (decreasing) */
export declare function svdValues(a: Mat): Float64Array;
