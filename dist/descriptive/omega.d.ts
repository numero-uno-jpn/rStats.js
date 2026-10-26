/** Options of {@link omega} */
export interface OmegaOptions {
    /** The number of first-order (group) factors. Default 3. */
    nfactors?: number;
    /** A correlation (or covariance) matrix to analyse instead of the data `x` (pass `null` as `x`). */
    covmat?: readonly (readonly number[])[];
}
/** Result of {@link omega} */
export interface OmegaResult {
    /** Omega hierarchical: the share of the total variance due to the general factor */
    omegaH: number;
    /** Omega asymptotic: the general factor's share of the common variance */
    omegaLim: number;
    /** Cronbach's alpha (standardised: of the correlations) */
    alpha: number;
    /** Omega total */
    omegaTot: number;
    /** Guttman's lambda 6 */
    G6: number;
    /** Explained common variance of the general factor */
    ECV: number;
    /** The Schmid-Leiman matrix, p rows; columns as `slNames` */
    sl: number[][];
    /** `["g", "F1*", ..., "h2", "u2", "p2", "com"]` */
    slNames: string[];
    /** The varimax loadings of the first-order minres solution */
    orthog: number[][];
    /** The oblimin pattern (the varimax loadings for one factor) */
    oblique: number[][];
    /** The factor correlations (absent for one factor) */
    phi?: number[][];
    /** The loadings of the first-order factors on the general factor */
    gloading: number[];
    /** The item signs (-1 for a flipped item) */
    key: number[];
    /** Rows g, F1*, ...; columns total, general, group (NaN for a group with no items) */
    omegaGroup: number[][];
    warnings: string[];
    messages: string[];
}
/**
 * McDonald's omega (hierarchical, asymptotic and total) from a Schmid-Leiman transformation of an oblique minres
 * factor solution. Equivalent to R's `psych::omega(x, nfactors)` with its defaults (`fm = "minres"`, `rotate =
 * "oblimin"`, `option = "equal"`, `flip = TRUE`).
 *
 * @param x The data matrix (array of rows, NaN for missing values: correlations of pairwise complete observations),
 *   or `null` with `options.covmat`.
 * @param options See {@link OmegaOptions}.
 *
 * @example
 * ```ts
 * const om = omega(x); // x: an n x 12 data matrix
 * om.omegaH; om.omegaTot; om.sl;
 * ```
 */
export declare function omega(x: readonly (readonly number[])[] | null, options?: OmegaOptions): OmegaResult;
