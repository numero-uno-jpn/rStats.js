import { type DD } from "./dd.js";
/**
 * Beta function B(a, b). Equivalent to R's `beta()`. Takes single numbers.
 *
 * @param a - First argument.
 * @param b - Second argument.
 * @returns B(a, b).
 *
 * @example
 * ```ts
 * beta(2, 3);  // 0.08333333333333333
 * ```
 *
 * @category Special functions
 */
export declare function beta(a: number, b: number): number;
/**
 * Natural logarithm of the absolute value of the beta function, log|B(a, b)|.
 * Equivalent to R's `lbeta()`. Takes single numbers.
 *
 * For a, b > 0 with the larger argument above 15, it is computed as
 * lgamma(small) - [lgamma(large + small) - lgamma(large)] with the bracketed difference
 * evaluated without cancellation, so accuracy is kept for large arguments.
 *
 * @param a - First argument.
 * @param b - Second argument.
 * @returns log|B(a, b)|.
 *
 * @example
 * ```ts
 * lbeta(1000, 1000);  // -1388.4826016359023
 * ```
 *
 * @category Special functions
 */
export declare function lbeta(a: number, b: number): number;
/**
 * log B(a, b) in double-double (a, b > 0).
 * Adding and subtracting three instances of lgamma(z) = (z - 1/2) log z - z + log sqrt(2 pi) + stirlerr(z) gives
 *   log B = (a - 1/2) log a + (b - 1/2) log b - (a + b - 1/2) log(a + b) + log sqrt(2 pi)
 *           + stirlerr(a) + stirlerr(b) - stirlerr(a + b)
 * The log terms are computed in double-double (avoids subtracting large values such as lgamma(170) ≈ 701).
 */
export declare function lbetaDD(a: number, b: number): DD;
