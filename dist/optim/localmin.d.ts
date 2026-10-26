/** Default tolerance .Machine$double.eps^0.25, as in R's optimize */
export declare const LOCALMIN_TOL: number;
export interface LocalMinResult {
    /** Location of the minimum */
    x: number;
    /** f at x (the last value computed there) */
    fx: number;
    /** Number of evaluations of f */
    evaluations: number;
}
/**
 * A local minimum of f in [lower, upper], to within about 3 tol + 2 sqrt(eps) |x| (Brent's localmin).
 *
 * @param tol - Tolerance (default .Machine$double.eps^0.25).
 */
export declare function localMin(f: (x: number) => number, lower: number, upper: number, tol?: number): LocalMinResult;
