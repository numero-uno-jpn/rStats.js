/**
 * Options for {@link integrate}.
 *
 * @category Numerical methods
 */
export interface IntegrateOptions {
    /** Maximum number of subintervals. Default `100`. */
    subdivisions?: number;
    /** Relative accuracy requested. Default `eps^0.25` (about 1.2e-4). */
    relTol?: number;
    /** Absolute accuracy requested. Default `relTol`. */
    absTol?: number;
    /** Throw when QUADPACK reports a problem (default `true`); otherwise return the result with its code. */
    stopOnError?: boolean;
}
/**
 * Result of {@link integrate}.
 *
 * @category Numerical methods
 */
export interface IntegrateResult {
    /** The estimate of the integral. */
    value: number;
    /** Estimate of the absolute error. */
    absError: number;
    /** Number of subintervals used. */
    subdivisions: number;
    /** QUADPACK's code: 0 OK, 1 maximum number of subdivisions reached, 2 roundoff error, 3 bad integrand
     *  behaviour, 4 roundoff error in the extrapolation table, 5 probably divergent, 6 invalid input. */
    ier: number;
    /** R's message for `ier`. */
    message: string;
}
/**
 * Integral of a function of one variable over a finite or infinite range. Equivalent to R's `integrate()`.
 *
 * @example
 * ```ts
 * integrate((x) => Math.exp(-x * x / 2), -Infinity, Infinity).value; // 2.506628274115034 (sqrt(2 pi) = 2.5066282746310002)
 * ```
 *
 * @category Numerical methods
 */
export declare function integrate(f: (x: number) => number, lower: number, upper: number, options?: IntegrateOptions): IntegrateResult;
/**
 * Options for {@link optimize}.
 *
 * @category Numerical methods
 */
export interface OptimizeOptions {
    /** Maximise instead of minimise. Default `false`. */
    maximum?: boolean;
    /** Accuracy. Default `eps^0.25`. */
    tol?: number;
}
/**
 * Minimum (or maximum) of a function of one variable on an interval, by Brent's golden-section and parabolic
 * search. Equivalent to R's `optimize()`. `optimum` is the location (R's `minimum`/`maximum`) and `objective` the
 * function there. `lower` and `upper` must be finite and `lower` less than `upper`, as in R.
 *
 * @example
 * ```ts
 * optimize((x) => (x - 1 / 3) ** 2, 0, 1).optimum; // 0.3333333333333333
 * ```
 *
 * @category Numerical methods
 */
export declare function optimize(f: (x: number) => number, lower: number, upper: number, options?: OptimizeOptions): {
    /** Location of the minimum or maximum (R's `minimum` or `maximum`). */
    optimum: number;
    /** Value of the function there. */
    objective: number;
};
/**
 * Options for {@link uniroot}.
 *
 * @category Numerical methods
 */
export interface UnirootOptions {
    /** Accuracy. Default `eps^0.25`. */
    tol?: number;
    /** Maximum number of iterations. Default `1000`. */
    maxiter?: number;
    /**
     * Extend the interval when f has the same sign at both ends: `"yes"` (both ways), `"downX"` (f decreasing),
     * `"upX"` (f increasing) or `"no"` (default).
     */
    extendInt?: "no" | "yes" | "downX" | "upX";
    /** f(lower), when already known. */
    fLower?: number;
    /** f(upper), when already known. */
    fUpper?: number;
}
/**
 * Result of {@link uniroot}.
 *
 * @category Numerical methods
 */
export interface UnirootResult {
    /** The root found. */
    root: number;
    /** f at the root. */
    fRoot: number;
    /** Iterations used (including those extending the interval). */
    iter: number;
    /** Iterations used to extend the interval (NaN when it was not extended). */
    initIt: number;
    /** Brent's estimate of the precision of the root. */
    estimPrec: number;
}
/**
 * A root of a function of one variable in an interval, by Brent's zeroin. Equivalent to R's `uniroot()`.
 *
 * @example
 * ```ts
 * uniroot((x) => x * x - 2, 0, 2, { tol: 1e-12 }).root; // 1.4142135623731364
 * ```
 *
 * @category Numerical methods
 */
export declare function uniroot(f: (x: number) => number, lower: number, upper: number, options?: UnirootOptions): UnirootResult;
