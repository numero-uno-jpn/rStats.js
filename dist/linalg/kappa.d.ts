import { type Mat, type MatrixInput } from "./matrix.js";
import { type NormType } from "./norm.js";
/**
 * Options for {@link kappa}.
 *
 * @category Linear algebra
 */
export interface KappaOptions {
    /** Compute the condition number exactly instead of estimating it. Default: `false`. */
    exact?: boolean;
    /**
     * The norm. Default: `"2"` when `exact` is `true`, otherwise `"1"`. With `exact: true`, `"2"` uses the singular
     * values and other norms use `norm(z) * norm(solve(z))`. With `exact: false`, as in R: the estimates through a
     * triangular factor (`method: "qr"`, or `"direct"` with `triangular: true`) use the infinity norm only for `"I"`
     * written exactly so and the 1-norm for any other norm (R warns for norms other than `"1"`, `"O"` and `"I"`, and
     * for `"2"`); `method: "direct"` without `triangular` accepts `"1"`, `"O"` and `"I"` in either case and throws for
     * any other.
     */
    norm?: NormType;
    /**
     * Estimation method when `exact` is `false`: `"qr"` applies LINPACK's `dtrco` estimate to the `R` factor of
     * the QR decomposition (of the transpose if `z` is wide); `"direct"` uses `1 / rcond(z)`. Default: `"qr"`.
     */
    method?: "qr" | "direct";
    /** Treat `z` as triangular and use only its triangle given by `uplo`. Default: `false`. Has an effect only with `method: "direct"` (as in R). */
    triangular?: boolean;
    /** With `triangular: true`, use the upper (`"U"`) or lower (`"L"`) triangle. Default: `"U"`. */
    uplo?: "U" | "L";
}
/**
 * Condition number of a matrix, estimated or exact. Equivalent to R's `kappa()`.
 *
 * By default (as in R) this is the LINPACK estimate of the one-norm condition number, computed on the
 * triangular factor `R` of the QR decomposition. With `exact: true` and the default `norm: "2"`, it is the ratio
 * of the largest to the smallest singular value (computed with {@link svd}); `Infinity` if the matrix is singular.
 *
 * @param z A matrix (array of rows).
 * @param options See {@link KappaOptions}.
 * @returns The (estimated) condition number.
 *
 * @example
 * ```ts
 * kappa([[1, 2], [3, 4]]);                  // 17.85 (LINPACK estimate)
 * kappa([[1, 2], [3, 4]], { exact: true }); // 14.933034373659272
 * ```
 *
 * @category Linear algebra
 */
export declare function kappa(z: MatrixInput, options?: KappaOptions): number;
/**
 * Estimate of the reciprocal condition number (1-norm) of a triangular matrix (LINPACK's dtrco). Uses the upper triangle if upper, else the lower.
 * If the matrix is not square, the upper-left min(rows, cols) part is used
 */
export declare function trco(T: Mat, upper: boolean): number;
/**
 * Moore-Penrose generalized inverse. Equivalent to `MASS::ginv()` in R.
 *
 * Computed from the singular value decomposition; singular values not greater than `tol` times the largest
 * singular value are treated as zero.
 *
 * @param x A matrix (array of rows).
 * @param options `tol`: relative tolerance for treating singular values as zero. Default: `sqrt(Number.EPSILON)`.
 * @returns The generalized inverse (`ncol` x `nrow`) as an array of rows.
 *
 * @example
 * ```ts
 * ginv([[1, 2], [3, 4]]); // [[-2, 1], [1.5, -0.5]]
 * ginv([[1, 1], [1, 1]]); // [[0.25, 0.25], [0.25, 0.25]]
 * ```
 *
 * @category Linear algebra
 */
export declare function ginv(x: MatrixInput, options?: {
    tol?: number;
}): number[][];
