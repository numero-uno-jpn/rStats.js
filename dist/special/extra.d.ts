/** Result of {@link gammainc}. */
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
 * The non-regularized incomplete gamma functions gamma(a, x) and Gamma(a, x) and their logs. As
 * `pracma::gammainc(x, a)` (`lowinc`, `uppinc`), or R's `pgamma(x, a) * gamma(a)` and
 * `pgamma(x, a, lower.tail = FALSE) * gamma(a)`.
 *
 * @example
 * ```ts
 * gammainc(2, 3).lower; // 0.6466471676338731 = 2 - 10 e^-2
 * ```
 */
export declare function gammainc(x: number, a: number): GammaincResult;
/**
 * Inverse of the complementary error function: the x with erfc(x) = z, for 0 <= z <= 2 (NaN outside). As
 * `pracma::erfcinv`.
 */
export declare function erfcinv(z: number): number;
/**
 * Inverse of the error function: the x with erf(x) = y, for -1 <= y <= 1 (NaN outside). As `pracma::erfinv`, but
 * accurate for small |y| (pracma's `qnorm((1 + y) / 2)` loses it: `erfinv(1e-300)` is -0 there).
 *
 * @example
 * ```ts
 * erfinv(0.5); // 0.4769362762044699
 * ```
 */
export declare function erfinv(y: number): number;
/**
 * Number of ordered selections of k items from n: n! / (n - k)!, defined for real n >= 0 as
 * Gamma(n + 1) / Gamma(n - k + 1) (0 for an integer n < k). jStat's `permutation`. Negative arguments give NaN.
 *
 * @example
 * ```ts
 * perm(5, 2); // 20
 * ```
 */
export declare function perm(n: number, k: number): number;
