import type { RCompatibleOptions } from "./rCompatible.js";
/**
 * Digamma function, the derivative of `lgamma`. Equivalent to R's `digamma()`. Takes a single number.
 *
 * @param x - Argument.
 * @returns psi(x) (`NaN` at zero and the negative integers).
 *
 * @example
 * ```ts
 * digamma(1);  // -0.5772156649015329 (minus Euler's constant)
 * ```
 *
 * @category Special functions
 */
export declare function digamma(x: number): number;
/**
 * Trigamma function, the second derivative of `lgamma`. Equivalent to R's `trigamma()`. Takes a single number.
 *
 * `trigamma(-Infinity)` is `Infinity` as in R (`NaN` with `rCompatible: false`).
 *
 * @param x - Argument.
 * @param options - `rCompatible` (default `true`).
 * @returns psi'(x) (`Infinity` at zero and the negative integers).
 *
 * @example
 * ```ts
 * trigamma(1);  // 1.6449340668482264 (pi^2 / 6)
 * ```
 *
 * @category Special functions
 */
export declare function trigamma(x: number, options?: RCompatibleOptions): number;
/**
 * Polygamma function, the derivative of order `deriv` of `digamma`. Equivalent to R's
 * `psigamma()`. Takes a single number.
 *
 * `psigamma(-Infinity, deriv)` is `Infinity` for odd `deriv` as in R, which treats it like the poles
 * (`NaN` with `rCompatible: false`). Unlike R, which returns `NaN` for `x < 0` with `deriv >= 6` and
 * where the result overflows, the value is computed there.
 *
 * @param x - Argument.
 * @param deriv - Order of the derivative, an integer from 0 to 100 (rounded half to even; default 0, digamma).
 * @param options - `rCompatible` (default `true`).
 * @returns psi^(deriv)(x). At zero and the negative integers, `Infinity` for odd `deriv` and `NaN` for even.
 *   `NaN` if `deriv` is outside 0 to 100.
 *
 * @example
 * ```ts
 * psigamma(2, 2);  // -0.40411380631918853 (-2 (zeta(3) - 1))
 * ```
 *
 * @category Special functions
 */
export declare function psigamma(x: number, deriv?: number, options?: RCompatibleOptions): number;
