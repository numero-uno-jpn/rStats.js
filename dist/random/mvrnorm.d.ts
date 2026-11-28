import type { MatrixInput } from "../linalg/matrix.js";
/**
 * Options for {@link mvrnorm}.
 *
 * @category Random numbers
 */
export interface MvrnormOptions {
    /** Tolerance, relative to the largest eigenvalue, for a lack of positive definiteness of `Sigma` (default `1e-6`). */
    tol?: number;
}
/**
 * The cyclic Jacobi method for a symmetric matrix: eigenvalues (decreasing) and eigenvectors (columns, array of rows,
 * each with its largest component positive). Rotations are taken while an off-diagonal entry exceeds eps times the
 * geometric mean of its diagonal entries, so that graded matrices keep their small eigenvalues to relative accuracy.
 */
export declare function jacobiEigen(S: readonly (readonly number[])[]): {
    values: number[];
    vectors: number[][];
};
/**
 * The symmetric eigendecomposition with R's (LAPACK's) eigenvector signs where they are known: eigenvalues in
 * decreasing order, eigenvectors as columns (array of rows). 1 x 1 and 2 x 2 as R's; larger by the Jacobi method.
 */
export declare function symmetricEigen(S: readonly (readonly number[])[]): {
    values: number[];
    vectors: number[][];
};
/** V diag(sqrt(max(lambda, 0))) V', the symmetric square root of a covariance matrix (sign-free), by the Jacobi method */
export declare function symmetricSqrt(S: readonly (readonly number[])[]): number[][];
/** Checks a covariance matrix for mvrnorm and the parameter draws (square, finite, symmetric, matching mu) */
export declare function checkCovariance(Sigma: readonly (readonly number[])[], p: number): void;
/**
 * Random vectors from the multivariate normal distribution. Equivalent to R's `MASS::mvrnorm()`.
 *
 * `Sigma` is decomposed as `V diag(lambda) V'` and each draw is `mu + V diag(sqrt(lambda)) z` with `z` taken from
 * `rnorm(n * p)` column by column (all `n` draws of the first component, then the second, ...), as in R. The values
 * depend on the signs of the eigenvectors: for 1 or 2 dimensions they are R's (LAPACK's closed form for 2 x 2), so the
 * draws equal R's under the same {@link setSeed}; for 3 or more dimensions rStats.js's eigenvectors may differ from
 * LAPACK's in sign, and the draws then have R's distribution but not R's values.
 *
 * Unlike R, which returns a vector when `n` is 1, the result always has one row per draw. MASS's `empirical`
 * argument is not offered.
 *
 * @param n Number of draws (fractions are truncated, as in R).
 * @param mu The mean vector (length p).
 * @param Sigma The covariance matrix (p x p, symmetric; only the lower triangle is read for 2 x 2, as R).
 * @param options See {@link MvrnormOptions}.
 * @returns An array of `n` rows of length p.
 * @throws RangeError if the dimensions do not match ("incompatible arguments") or `Sigma` is not positive
 *   semi-definite within `tol` ("'Sigma' is not positive definite").
 *
 * @example
 * ```ts
 * setSeed(42);
 * mvrnorm(2, [0, 0], [[2, 0.6], [0.6, 1]]); // [[-1.7445, -1.1571], [0.99996, -0.12421]] (R: set.seed(42); MASS::mvrnorm(...))
 * ```
 *
 * @category Random numbers
 */
export declare function mvrnorm(n: number, mu: readonly number[], Sigma: MatrixInput, options?: MvrnormOptions): number[][];
