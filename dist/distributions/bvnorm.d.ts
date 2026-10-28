/**
 * Probability that a standard bivariate normal pair (X, Y) with correlation `rho` lies in the rectangle
 * `lower ≤ (X, Y) ≤ upper`. Equivalent to `mvtnorm::pmvnorm()` in R. The same as
 * `pmvnorm(lower, upper, corr = matrix(c(1, rho, rho, 1), 2))`.
 * Bounds may be infinite. Accurate to about 1e-15 absolute.
 *
 * @param lower - Lower bounds `[a1, a2]`.
 * @param upper - Upper bounds `[b1, b2]`.
 * @param rho - Correlation, in [−1, 1].
 *
 * @example
 * ```ts
 * pbvnorm([-Infinity, -Infinity], [0, 0], 0.5); // 0.3333333333333333
 * ```
 *
 * @category Distributions
 */
export declare function pbvnorm(lower: readonly [number, number] | readonly number[], upper: readonly [number, number] | readonly number[], rho: number): number;
