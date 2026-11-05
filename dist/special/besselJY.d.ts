/**
 * Bessel function of the first kind. Equivalent to R's `besselJ(x, nu)`. Takes single numbers.
 *
 * @param x - Argument, `x >= 0` (`NaN` for negative `x`).
 * @param nu - Order, any real number. For `nu < 0`, `J(x, -nu) = cos(pi nu) J(x, nu) - sin(pi nu) Y(x, nu)`
 *   (A&S 9.1.2, as in R).
 * @returns J_nu(x).
 *
 * For `x` much larger than `nu` but below the range of the asymptotic expansion (`x < nu / 0.011`), the time grows
 * with `x` (a continued fraction of about `x - nu` terms): about 15 ms at `x = 5e4`, `nu = 1000`, 1.6 s at `x = 1e7`,
 * `nu = 2e5`. Near the turning point (`x` a little below `nu`) a recurrence takes about `nu` steps. Beyond 2^25 terms
 * of the continued fraction or 2^31 steps of the recurrence (2^28 for a negative non-integer order, which needs Y) a
 * RangeError is thrown before the computation. So it is in the asymptotic expansion (`x` above about `90 nu`) where
 * the phase correction `nu^2 / (2x)` exceeds 2^26, which double precision does not resolve.
 *
 * @example
 * ```ts
 * besselJ(1, 0);     // 0.7651976865579666
 * besselJ(10, 2.5);  // 0.1966584835818184
 * ```
 *
 * @category Special functions
 */
export declare function besselJ(x: number, nu: number): number;
/**
 * Bessel function of the second kind. Equivalent to R's `besselY(x, nu)`. Takes single numbers.
 *
 * @param x - Argument, `x >= 0` (`NaN` for negative `x`; `-Infinity` at 0).
 * @param nu - Order, any real number. For `nu < 0`, `Y(x, -nu) = sin(pi nu) J(x, nu) + cos(pi nu) Y(x, nu)`
 *   (A&S 9.1.2, as in R).
 * @returns Y_nu(x).
 *
 * For orders above 1000, results far out of the range of doubles are returned at once (`Infinity` or 0, decided by
 * bounds on their log); otherwise the time grows with the order (a recurrence of about `nu` steps): about 2.4 s for
 * `besselY(0.9e8, 1e8)`. Beyond 2^28 steps, or 2^25 terms of the continued fraction for `x` above `nu` (as for
 * {@link besselJ}), a RangeError is thrown before the computation, and likewise for a phase correction `nu^2 / (2x)`
 * beyond 2^26 in the asymptotic expansion for large `x`.
 *
 * @example
 * ```ts
 * besselY(1, 0);  // 0.08825696421567694
 * ```
 *
 * @category Special functions
 */
export declare function besselY(x: number, nu: number): number;
