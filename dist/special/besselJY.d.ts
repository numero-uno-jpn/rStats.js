/**
 * Bessel function of the first kind. Equivalent to R's `besselJ(x, nu)` for single numbers.
 *
 * @param x - Argument, `x >= 0` (`NaN` for negative `x`).
 * @param nu - Order, any real number. For `nu < 0`, `J(x, -nu) = cos(pi nu) J(x, nu) - sin(pi nu) Y(x, nu)`
 *   (A&S 9.1.2, as in R).
 * @returns J_nu(x).
 *
 * For `x` much larger than `nu` but below the range of the asymptotic expansion (`x < nu / 0.011`), the time grows
 * with `x` (a continued fraction of about `x` terms): about 15 ms at `x = 5e4`, `nu = 1000`.
 *
 * @example
 * ```ts
 * besselJ(1, 0);     // 0.7651976865579666
 * besselJ(10, 2.5);  // 0.1966584835818184
 * ```
 */
export declare function besselJ(x: number, nu: number): number;
/**
 * Bessel function of the second kind. Equivalent to R's `besselY(x, nu)` for single numbers.
 *
 * @param x - Argument, `x >= 0` (`NaN` for negative `x`; `-Infinity` at 0).
 * @param nu - Order, any real number. For `nu < 0`, `Y(x, -nu) = sin(pi nu) J(x, nu) + cos(pi nu) Y(x, nu)`
 *   (A&S 9.1.2, as in R).
 * @returns Y_nu(x).
 *
 * @example
 * ```ts
 * besselY(1, 0);  // 0.08825696421567694
 * ```
 */
export declare function besselY(x: number, nu: number): number;
