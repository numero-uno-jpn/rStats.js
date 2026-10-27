/**
 * Rotations of {@link factanal}
 *
 * @category Agreement, reliability and factor analysis
 */
export type FactanalRotation = "varimax" | "promax" | "none";
/**
 * Factor scores of {@link factanal}
 *
 * @category Agreement, reliability and factor analysis
 */
export type FactanalScores = "none" | "regression" | "Bartlett";
/**
 * Options of {@link factanal}
 *
 * @category Agreement, reliability and factor analysis
 */
export interface FactanalOptions {
    /** A covariance (or correlation) matrix to analyse instead of the data `x` (pass `null` as `x`). */
    covmat?: readonly (readonly number[])[];
    /** The number of observations behind `covmat` (for the test statistic). Default: unknown. */
    nObs?: number;
    /** Default `"varimax"`. */
    rotation?: FactanalRotation;
    /**
     * Factor scores to compute from the data (R's `scores`): `"none"` (default), `"regression"` (Thomson's,
     * z R^-1 L) or `"Bartlett"` (z W L (L' W L)^-1 with W = diag(1 / uniquenesses)), where z is the data
     * standardised by column (denominator n - 1), R its correlation matrix and L the final loadings. Scores need
     * `x`: with `covmat` they are an error.
     */
    scores?: FactanalScores;
    /** Settings of the optimisation (part of R's `control` list). */
    control?: {
        /** Lower bound of the uniquenesses. Default 0.005. */
        lower?: number;
        /** Starting uniquenesses. Default `(1 - factors / (2p)) / diag(solve(S))`. */
        start?: readonly number[];
    };
}
/**
 * Result of {@link factanal}
 *
 * @category Agreement, reliability and factor analysis
 */
export interface FactanalResult {
    /** The uniquenesses, one per variable: the variance not explained by the factors. */
    uniquenesses: number[];
    /** The (rotated) loadings, p rows by `factors` columns, columns sorted by decreasing sum of squares, each column's sum positive */
    loadings: number[][];
    /** The factor scores (with `scores` other than `"none"`): one row per observation, one column per factor */
    scores?: number[][];
    /** The rotation matrix (absent for `rotation: "none"` and for one factor) */
    rotmat?: number[][];
    /** The likelihood-ratio statistic (NaN without n.obs or with no degrees of freedom) */
    STATISTIC: number;
    /** Degrees of freedom of the statistic, ((p - factors)^2 - (p + factors)) / 2. */
    dof: number;
    /** Its upper chi-squared tail probability (NaN as STATISTIC) */
    PVAL: number;
    /** Whether the optimisation converged. */
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
 * covariance matrix. Equivalent to R's `factanal()`. With `rotation` `"varimax"`, `"promax"` or `"none"`.
 *
 * @param x The data matrix (array of rows), or `null` with `options.covmat`.
 * @param factors The number of factors.
 *
 * @example
 * ```ts
 * const R = [[1, 0.72, 0.63], [0.72, 1, 0.56], [0.63, 0.56, 1]];
 * const fa = factanal(null, 1, { covmat: R });
 * fa.uniquenesses; // [0.19, 0.36, 0.51]
 * fa.loadings;     // [[0.9], [0.8], [0.7]]
 * // Factor scores need the data: factanal(x, 1, { scores: "regression" }).scores (one row per row of x)
 * ```
 *
 * @category Agreement, reliability and factor analysis
 */
export declare function factanal(x: readonly (readonly number[])[] | null, factors: number, options?: FactanalOptions): FactanalResult;
