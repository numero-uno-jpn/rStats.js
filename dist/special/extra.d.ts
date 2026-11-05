/**
 * Result of {@link gammainc}.
 *
 * @category Special functions
 */
export interface GammaincResult {
    /** Lower incomplete gamma function gamma(a, x) = integral from 0 to x of t^(a-1) e^-t dt. */
    lower: number;
    /** Upper incomplete gamma function Gamma(a, x) = integral from x to Inf of t^(a-1) e^-t dt. */
    upper: number;
    /** log of `lower` (finite where `lower` overflows). */
    logLower: number;
    /** log of `upper`. */
    logUpper: number;
}
/**
 * The non-regularized incomplete gamma functions gamma(a, x) and Gamma(a, x) and their logs.
 * Equivalent to `pracma::gammainc()` in R. `pracma::gammainc(x, a)` returns them as `lowinc` and `uppinc`;
 * in base R they are `pgamma(x, a) * gamma(a)` and `pgamma(x, a, lower.tail = FALSE) * gamma(a)`.
 *
 * @example
 * ```ts
 * gammainc(2, 3).lower; // 0.6466471676338731 (2 - 10 e^-2)
 * ```
 *
 * @category Special functions
 */
export declare function gammainc(x: number, a: number): GammaincResult;
/**
 * Inverse of the complementary error function: the x with erfc(x) = z, for 0 <= z <= 2 (NaN outside).
 * Equivalent to `pracma::erfcinv()` in R.
 *
 * @example
 * ```ts
 * erfcinv(0.5);    // 0.4769362762044699
 * erfcinv(1e-20);  // 6.601580622355143
 * ```
 *
 * @category Special functions
 */
export declare function erfcinv(z: number): number;
/**
 * Inverse of the error function: the x with erf(x) = y, for -1 <= y <= 1 (NaN outside).
 * Equivalent to `pracma::erfinv()` in R. Unlike pracma, it is accurate for small |y| (pracma's
 * `qnorm((1 + y) / 2)` loses it: `erfinv(1e-300)` is -0 there).
 *
 * @example
 * ```ts
 * erfinv(0.5); // 0.4769362762044699
 * ```
 *
 * @category Special functions
 */
export declare function erfinv(y: number): number;
/**
 * Number of ordered selections of k items from n: n! / (n - k)!, defined for real n >= 0 as
 * Gamma(n + 1) / Gamma(n - k + 1) (0 for an integer n < k). Negative arguments give NaN.
 * Not an R function. It is jStat's `permutation`; R has only `choose()` (unordered selections).
 *
 * @example
 * ```ts
 * perm(5, 2); // 20
 * ```
 *
 * @category Special functions
 */
export declare function perm(n: number, k: number): number;
