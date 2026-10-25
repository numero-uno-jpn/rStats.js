/** Options for {@link besselI} and {@link besselK}. */
export interface BesselOptions {
    /** If `true`, return `exp(-x) I(x, nu)` (for `besselI`) or `exp(x) K(x, nu)` (for `besselK`). Default `false`. */
    exponScaled?: boolean;
}
/**
 * Modified Bessel function of the first kind. Equivalent to R's
 * `besselI(x, nu, expon.scaled = FALSE)` for single numbers.
 *
 * @param x - Argument, `x >= 0` (`NaN` for negative `x`).
 * @param nu - Order, any real number. For `nu < 0`, `I(x, -nu) = I(x, nu) + 2/pi sin(pi nu) K(x, nu)`
 *   (A&S 9.6.2, as in R).
 * @param options - `exponScaled` (see {@link BesselOptions}).
 * @returns I_nu(x), or `exp(-x) I_nu(x)` when `exponScaled`.
 *
 * @example
 * ```ts
 * besselI(1, 0);                             // 1.2660658777520086
 * besselI(1000, 2, { exponScaled: true });   // 0.012592018595377398
 * ```
 */
export declare function besselI(x: number, nu: number, options?: BesselOptions): number;
/**
 * Modified Bessel function of the second kind. Equivalent to R's
 * `besselK(x, nu, expon.scaled = FALSE)` for single numbers.
 *
 * @param x - Argument, `x >= 0` (`NaN` for negative `x`).
 * @param nu - Order, any real number (`K(x, -nu) = K(x, nu)`).
 * @param options - `exponScaled` (see {@link BesselOptions}).
 * @returns K_nu(x), or `exp(x) K_nu(x)` when `exponScaled`.
 *
 * @example
 * ```ts
 * besselK(1, 0);                              // 0.4210244382407083
 * besselK(1000, 2, { exponScaled: true });    // 0.03970761786238014
 * ```
 */
export declare function besselK(x: number, nu: number, options?: BesselOptions): number;
