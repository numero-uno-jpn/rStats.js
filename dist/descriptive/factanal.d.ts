/** Rotations of {@link factanal} */
export type FactanalRotation = "varimax" | "promax" | "none";
/** Options of {@link factanal} */
export interface FactanalOptions {
    /** A covariance (or correlation) matrix to analyse instead of the data `x` (pass `null` as `x`). */
    covmat?: readonly (readonly number[])[];
    /** The number of observations behind `covmat` (for the test statistic). Default: unknown. */
    nObs?: number;
    /** Default `"varimax"`. */
    rotation?: FactanalRotation;
    control?: {
        /** Lower bound of the uniquenesses. Default 0.005. */
        lower?: number;
        /** Starting uniquenesses. Default `(1 - factors / (2p)) / diag(solve(S))`. */
        start?: readonly number[];
    };
}
/** Result of {@link factanal} */
export interface FactanalResult {
    uniquenesses: number[];
    /** The (rotated) loadings, p rows by `factors` columns, columns sorted by decreasing sum of squares, each column's sum positive */
    loadings: number[][];
    /** The rotation matrix (absent for `rotation: "none"` and for one factor) */
    rotmat?: number[][];
    /** The likelihood-ratio statistic (NaN without n.obs or with no degrees of freedom) */
    STATISTIC: number;
    dof: number;
    /** Its upper chi-squared tail probability (NaN as STATISTIC) */
    PVAL: number;
    converged: boolean;
    /** The minimised criterion */
    objective: number;
    /** optim's counts of function and gradient evaluations */
    counts: [number, number];
}
/** Sum rounded once (R's long double accumulation, here double-double); also used by omega */
export declare function sumOnce(xs: readonly number[]): number;
/** Varimax rotation (normalised, eps 1e-5, at most 1000 iterations); also used by omega */
export declare function varimax(L: readonly (readonly number[])[]): {
    loadings: number[][];
    rotmat: number[][];
};
/**
 * Maximum-likelihood factor analysis of a data matrix (rows are observations) or, with `options.covmat`, of a
 * covariance matrix. Equivalent to R's `factanal()` with `rotation` `"varimax"`, `"promax"` or `"none"`.
 *
 * @param x The data matrix (array of rows), or `null` with `options.covmat`.
 * @param factors The number of factors.
 *
 * @example
 * ```ts
 * const fa = factanal(x, 2); // x: an n x 6 data matrix
 * fa.uniquenesses; fa.loadings; fa.PVAL;
 * ```
 */
export declare function factanal(x: readonly (readonly number[])[] | null, factors: number, options?: FactanalOptions): FactanalResult;
