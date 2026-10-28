/**
 * Options for {@link grad}, {@link jacobian} and {@link hessian}.
 *
 * @category Numerical methods
 */
export interface DerivOptions {
    /** `"Richardson"` (default) or `"simple"` (forward difference; not for `hessian`). */
    method?: "Richardson" | "simple";
    /** Step for "simple", and for coordinates near 0 in "Richardson". Default `1e-4`. */
    eps?: number;
    /** Relative initial step of "Richardson". Default `1e-4` (`0.1` for `hessian`). */
    d?: number;
    /** Coordinates with |x| below this get the step `eps`. Default `sqrt(2.220446e-16 / 7e-7)`. */
    zeroTol?: number;
    /** Number of halvings of the step (Richardson iterations). Default `4`. */
    r?: number;
}
/**
 * Gradient of a scalar function of a vector. Equivalent to `numDeriv::grad(func, x, method)` in R.
 *
 * @example
 * ```ts
 * grad((x) => x[0]! ** 2 + Math.sin(x[1]!), [1, 0]); // [2, 1]
 * ```
 *
 * @category Numerical methods
 */
export declare function grad(func: (x: number[]) => number, x: readonly number[], options?: DerivOptions): number[];
/**
 * Jacobian of a vector function of a vector: row i holds the derivatives of the i-th value. Equivalent to
 * `numDeriv::jacobian(func, x, method)` in R.
 *
 * @example
 * ```ts
 * jacobian((x) => [x[0]! * x[1]!, x[0]! + 2 * x[1]!], [2, 3]); // [[3, 2], [1, 2]]
 * ```
 *
 * @category Numerical methods
 */
export declare function jacobian(func: (x: number[]) => readonly number[], x: readonly number[], options?: DerivOptions): number[][];
/**
 * Hessian matrix of a scalar function of a vector, by Richardson extrapolation (Bates and Watts). Equivalent to
 * `numDeriv::hessian(func, x)` in R.
 *
 * @example
 * ```ts
 * hessian((x) => x[0]! ** 2 * x[1]! ** 2, [1, 2]); // [[8, 8], [8, 2]]
 * ```
 *
 * @category Numerical methods
 */
export declare function hessian(func: (x: number[]) => number, x: readonly number[], options?: DerivOptions): number[][];
