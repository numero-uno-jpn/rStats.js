import type { RCompatibleOptions } from "./rCompatible.js";
/**
 * Binomial coefficient. Equivalent to R's `choose(n, k)` for single numbers.
 *
 * `n` may be any real number. `k` is rounded to the nearest integer (as R does, which also warns
 * when `k` is not close to an integer); `choose(n, k)` is 0 for `k < 0` and 1 for `k = 0`.
 * For integer `n` the result is an integer (exact up to 2^53).
 *
 * Edge cases where R differs from the mathematical value, followed by default (`rCompatible: false`
 * returns the mathematical value instead):
 * - `n` within 1e-9 max(1, |n|) of an integer is treated as that integer, so `choose(1e-10, 2)` is 0
 *   (mathematically -5e-11); for `n < 0` and `k >= 30` the tolerance is relative to `k - 1 - n`;
 * - `choose(n, Infinity)` is 0 for `n >= 0` (otherwise `NaN`);
 * - `choose(±Infinity, k)` is `NaN` for `k >= 30` (`±Infinity` below).
 *
 * @param n - Number of items (any real number).
 * @param k - Number chosen (rounded to an integer).
 * @param options - `rCompatible` (default `true`).
 * @returns The binomial coefficient.
 *
 * @example
 * ```ts
 * choose(5, 2);    // 10
 * choose(0.5, 3);  // 0.0625
 * choose(-2, 3);   // -4
 * ```
 */
export declare function choose(n: number, k: number, options?: RCompatibleOptions): number;
/**
 * Logarithm of the absolute value of the binomial coefficient. Equivalent to R's `lchoose(n, k)`
 * for single numbers: `log(abs(choose(n, k)))`, computed without overflow.
 *
 * Edge cases where R differs from the mathematical value, followed by default (`rCompatible: false`
 * returns the mathematical value instead): `n` within 1e-9 max(1, |n|) of an integer is treated as that
 * integer (for `k >= 2`; for `n < 0` the tolerance is relative to `k - 1 - n`); `lchoose(n, Infinity)` is `-Infinity` for `n >= 0` (otherwise `NaN`); `lchoose(±Infinity, k)`
 * is `NaN` for `k >= 2` (`Infinity` for `k = 1`).
 *
 * @param n - Number of items (any real number).
 * @param k - Number chosen (rounded to an integer).
 * @param options - `rCompatible` (default `true`).
 * @returns log|choose(n, k)| (`-Infinity` where `choose(n, k)` is 0).
 *
 * @example
 * ```ts
 * lchoose(1000, 500);  // 689.4672615678512
 * ```
 */
export declare function lchoose(n: number, k: number, options?: RCompatibleOptions): number;
/**
 * Factorial. Equivalent to R's `factorial(x)` for a single number: `gamma(x + 1)`, defined for
 * any real `x` that is not a negative integer.
 *
 * @param x - Argument.
 * @returns x! = Gamma(x + 1) (`NaN` at negative integers, `Infinity` on overflow).
 *
 * @example
 * ```ts
 * factorial(5);    // 120
 * factorial(0.5);  // 0.8862269254527579
 * ```
 */
export declare function factorial(x: number): number;
/**
 * Logarithm of the factorial. Equivalent to R's `lfactorial(x)` for a single number:
 * `lgamma(x + 1)`, computed without forming `x + 1` near 0 so that small `x` keep their accuracy.
 *
 * @param x - Argument.
 * @returns log|x!| = log|Gamma(x + 1)| (`Infinity` at negative integers).
 *
 * @example
 * ```ts
 * lfactorial(100);  // 363.73937555556347
 * ```
 */
export declare function lfactorial(x: number): number;
