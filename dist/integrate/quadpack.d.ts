export type Integrand = (x: number) => number;
/** Result of dqagse / dqagie */
export interface QuadResult {
    result: number;
    abserr: number;
    /** Number of integrand evaluations */
    neval: number;
    /**
     * 0 normal termination; 1 maximum number of subdivisions; 2 roundoff error; 3 bad integrand behaviour;
     * 4 roundoff error in the extrapolation table; 5 divergent or slowly convergent; 6 invalid input
     */
    ier: number;
    /** Number of subintervals produced */
    last: number;
}
/**
 * Integral of f over the finite interval [a, b] (QUADPACK dqagse: 21-point Gauss-Kronrod rule, bisection of the
 * interval with the largest error, epsilon-algorithm extrapolation).
 *
 * @param limit - Maximum number of subintervals (R's `subdivisions`).
 */
export declare function dqagse(f: Integrand, a: number, b: number, epsabs: number, epsrel: number, limit: number): QuadResult;
/**
 * Integral of f over an infinite range (QUADPACK dqagie): (bound, inf) for inf = 1, (-inf, bound) for inf = -1,
 * (-inf, inf) for inf = 2, mapped to (0, 1] by x = bound + (1 - t) / t.
 *
 * @param limit - Maximum number of subintervals (R's `subdivisions`).
 */
export declare function dqagie(f: Integrand, bound: number, inf: -1 | 1 | 2, epsabs: number, epsrel: number, limit: number): QuadResult;
