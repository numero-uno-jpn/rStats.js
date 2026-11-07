/** Result of {@link lbfgsb} */
export interface LbfgsbResult {
    /** The final point */
    x: number[];
    /** f at x */
    f: number;
    /** The final task string ('CONVERGENCE: ...', 'NEW_X' when stopped by newX, 'ABNORMAL_TERMINATION_IN_LNSRCH', 'ERROR: ...') */
    task: string;
    /** Number of evaluations of f and g */
    nfgv: number;
}
/**
 * Minimises f subject to the bounds (mainlb of L-BFGS-B 2.1). `nbd[i]` is 0 (unbounded), 1 (lower bound only), 2
 * (both) or 3 (upper bound only); `m` is the number of corrections kept. `evaluate` returns f and its gradient at x;
 * `newX` is called after each iteration and returns true to stop there.
 */
export declare function lbfgsb(n: number, m: number, x0: readonly number[], lower: readonly number[], upper: readonly number[], nbd0: readonly number[], factr: number, pgtol: number, evaluate: (x: number[]) => {
    f: number;
    g: number[];
}, newX: () => boolean): LbfgsbResult;
