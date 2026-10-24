/**
 * Error function, erf(x) = 2 / sqrt(pi) * integral from 0 to x of exp(-t^2) dt. Not part of R (where it is written
 * `2 * pnorm(x * sqrt(2)) - 1`, which loses the relative accuracy of small x).
 *
 * @param x - Argument.
 * @returns erf(x).
 *
 * @example
 * ```ts
 * erf(0.5);    // 0.5204998778130465
 * erf(1e-10);  // 1.1283791670955126e-10
 * ```
 */
export declare function erf(x: number): number;
/**
 * Complementary error function, erfc(x) = 1 - erf(x), accurate in the upper tail (down to the subnormal range near
 * x = 27). Not part of R (where it is written `2 * pnorm(x * sqrt(2), lower.tail = FALSE)`).
 *
 * @param a - Argument.
 * @returns erfc(a).
 *
 * @example
 * ```ts
 * erfc(5);  // 1.537459794428035e-12
 * ```
 *
 * Changes from xsf: exp(-x^2) is formed from x^2 = hi + lo exact (the rounding of x^2 is 33 ε relative at x = 5.7),
 * and below the normal range exp(-700) is applied last so that subnormal results (x up to 27.2) are not flushed to 0.
 */
export declare function erfc(a: number): number;
/**
 * Scaled complementary error function erfcx(x) = exp(x^2) erfc(x) (x >= 0).
 * Negative x is handled by the caller (this library uses only x >= 0 internally).
 */
export declare function erfcxNonNegative(x: number): number;
