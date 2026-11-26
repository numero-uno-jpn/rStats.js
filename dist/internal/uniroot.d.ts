export interface UnirootOptions {
    /** Tolerance (interval width). Default is .Machine$double.eps^0.25, as in R's uniroot */
    tol?: number;
    maxIter?: number;
    /** Pass the endpoint values if known (saves calls to f) */
    fLower?: number;
    fUpper?: number;
}
export declare const UNIROOT_TOL: number;
/** f(lower) and f(upper) must differ in sign. Returns one root */
export declare function uniroot(f: (x: number) => number, lower: number, upper: number, opts?: UnirootOptions): number;
/**
 * Root in psi > 0 of a function monotone in psi (an odds ratio), given whether it lies below 1: solved in u = log psi
 * to the precision of the doubles, from a bracket widened from u = 0 by doubling. 0 or Infinity when f does not change
 * sign within the doubles. (R's fisher.test solves on psi in [0, 1] or 1/psi in [eps, 1] with the absolute tolerance
 * eps^0.25, which leaves its estimates 1e-6 off and its limits up to several percent, or at the end 1/eps)
 */
export declare function logScaleRoot(f: (psi: number) => number, belowOne: boolean): number;
