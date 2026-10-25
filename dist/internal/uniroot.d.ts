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
