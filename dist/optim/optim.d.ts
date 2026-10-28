/**
 * Methods of {@link optim}
 *
 * @category Numerical methods
 */
export type OptimMethod = "Nelder-Mead" | "BFGS" | "CG" | "L-BFGS-B" | "SANN" | "Brent";
/**
 * Control parameters of {@link optim} (R's `control`, in camelCase)
 *
 * @category Numerical methods
 */
export interface OptimControl {
    /** Maximum number of iterations. Default 500 for Nelder-Mead, 10000 for SANN, 100 otherwise. */
    maxit?: number;
    /** Relative convergence tolerance. Default `sqrt(eps)`. */
    reltol?: number;
    /** Absolute convergence tolerance (stop when the value falls to it). Default `-Infinity`. */
    abstol?: number;
    /** Scaling of the parameters: the optimisation is on `par / parscale`. Default 1. */
    parscale?: number | readonly number[];
    /** Scaling of the objective: `fn / fnscale` is minimised (negative to maximise). Default 1. */
    fnscale?: number;
    /** Steps of the finite-difference gradient, in the scaled parameters. Default 1e-3. */
    ndeps?: number | readonly number[];
    /** Nelder-Mead reflection factor. Default 1. */
    alpha?: number;
    /** Nelder-Mead contraction factor. Default 0.5. */
    beta?: number;
    /** Nelder-Mead expansion factor. Default 2. */
    gamma?: number;
    /** CG update: 1 Fletcher-Reeves (default), 2 Polak-Ribière, 3 Beale-Sorenson. */
    type?: number;
    /** L-BFGS-B: number of corrections kept. Default 5. */
    lmm?: number;
    /** L-BFGS-B: relative reduction tolerance in units of the machine epsilon. Default 1e7. */
    factr?: number;
    /** L-BFGS-B: tolerance on the projected gradient. Default 0. */
    pgtol?: number;
    /** SANN: starting temperature. Default 10. */
    temp?: number;
    /** SANN: evaluations per temperature. Default 10. */
    tmax?: number;
}
/**
 * Options of {@link optim}
 *
 * @category Numerical methods
 */
export interface OptimOptions {
    /** Gradient of fn (numerical by central differences when omitted) */
    gr?: (par: number[]) => number[];
    /** Default `"Nelder-Mead"` */
    method?: OptimMethod;
    /** Lower bounds (L-BFGS-B and Brent), recycled. Default `-Infinity`. */
    lower?: number | readonly number[];
    /** Upper bounds (L-BFGS-B and Brent), recycled. Default `Infinity`. */
    upper?: number | readonly number[];
    /** Also return the numerically differentiated Hessian at the solution. Default `false`. */
    hessian?: boolean;
    /** Control parameters (R's `control`). See {@link OptimControl}. */
    control?: OptimControl;
}
/**
 * Result of {@link optim}
 *
 * @category Numerical methods
 */
export interface OptimResult {
    /** The best parameters found. */
    par: number[];
    /** fn at `par`. */
    value: number;
    /** Evaluations of fn and gr (NaN where R has NA) */
    counts: [number, number];
    /** 0 success, 1 iteration limit reached, 10 Nelder-Mead simplex degenerate, 51 / 52 L-BFGS-B warning / error */
    convergence: number;
    /** L-BFGS-B's final message; null for the other methods */
    message: string | null;
    /** The numerically differentiated Hessian at `par`, when `hessian` is true (array of rows). */
    hessian?: number[][];
    /** R's warnings */
    warnings: string[];
}
/**
 * Numerically differentiated Hessian of fn at par, from central differences of the gradient (gr, or the numerical
 * gradient of fn). Equivalent to R's `optimHess()`. `control` uses `fnscale`, `parscale` and `ndeps`.
 *
 * @example
 * ```ts
 * optimHess([1, 2], (x) => x[0] ** 2 + 3 * x[0] * x[1] + x[1] ** 2); // [[2, 3], [3, 2]]
 * ```
 *
 * @category Numerical methods
 */
export declare function optimHess(par: readonly number[], fn: (par: number[]) => number, gr?: (par: number[]) => number[], control?: OptimControl): number[][];
/**
 * General-purpose minimisation of `fn` from the starting point `par`. Equivalent to R's `optim()`. The same methods
 * with the same iterations, so the same results and counts.
 *
 * @example
 * ```ts
 * const rosen = (x: number[]) => 100 * (x[1] - x[0] ** 2) ** 2 + (1 - x[0]) ** 2;
 * optim([-1.2, 1], rosen).par; // [1.0002601387256695, 1.000505999303765]
 * optim([-1.2, 1], rosen, { method: "BFGS" }).counts; // [118, 38]
 * ```
 *
 * @category Numerical methods
 */
export declare function optim(par: readonly number[], fn: (par: number[]) => number, options?: OptimOptions): OptimResult;
