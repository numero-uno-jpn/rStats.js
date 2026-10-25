/** Options for {@link grad}, {@link jacobian} and {@link hessian}. */
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
 * Gradient of a scalar function of a vector. Equivalent to `numDeriv::grad(func, x, method)`.
 *
 * @example
 * ```ts
 * grad((x) => x[0]! ** 2 + Math.sin(x[1]!), [1, 0]); // ≈ [2, 1]
 * ```
 */
export declare function grad(func: (x: number[]) => number, x: readonly number[], options?: DerivOptions): number[];
/**
 * Jacobian of a vector function of a vector: row i holds the derivatives of the i-th value. Equivalent to
 * `numDeriv::jacobian(func, x, method)`.
 */
export declare function jacobian(func: (x: number[]) => readonly number[], x: readonly number[], options?: DerivOptions): number[][];
/**
 * Hessian matrix of a scalar function of a vector, by Richardson extrapolation (Bates and Watts). Equivalent to
 * `numDeriv::hessian(func, x)`.
 *
 * @example
 * ```ts
 * hessian((x) => x[0]! ** 2 * x[1]!, [1, 2]); // ≈ [[4, 2], [2, 0]]
 * ```
 */
export declare function hessian(func: (x: number[]) => number, x: readonly number[], options?: DerivOptions): number[][];
