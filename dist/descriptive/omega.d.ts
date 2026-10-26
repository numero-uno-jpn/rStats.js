/**
 * Options of {@link omega}
 *
 * @category Agreement, reliability and factor analysis
 */
export interface OmegaOptions {
    /** The number of first-order (group) factors. Default 3. */
    nfactors?: number;
    /** A correlation (or covariance) matrix to analyse instead of the data `x` (pass `null` as `x`). */
    covmat?: readonly (readonly number[])[];
}
/**
 * Result of {@link omega}
 *
 * @category Agreement, reliability and factor analysis
 */
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
    /** The warnings R would give (e.g. an ultra-Heywood case, or one factor), each once. */
    warnings: string[];
    /** The messages R would print (e.g. for two factors), each once. */
    messages: string[];
}
/**
 * McDonald's omega (hierarchical, asymptotic and total) from a Schmid-Leiman transformation of an oblique minres
 * factor solution. Equivalent to `psych::omega()` in R. With its defaults (`fm = "minres"`, `rotate = "oblimin"`,
 * `option = "equal"`, `flip = TRUE`).
 *
 * @param x The data matrix (array of rows, NaN for missing values: correlations of pairwise complete observations),
 *   or `null` with `options.covmat`.
 * @param options See {@link OmegaOptions}.
 *
 * @example
 * ```ts
 * // 6 items: general loadings 0.6, three pairs with group loadings 0.4
 * const R = [
 *   [1, 0.52, 0.36, 0.36, 0.36, 0.36],
 *   [0.52, 1, 0.36, 0.36, 0.36, 0.36],
 *   [0.36, 0.36, 1, 0.52, 0.36, 0.36],
 *   [0.36, 0.36, 0.52, 1, 0.36, 0.36],
 *   [0.36, 0.36, 0.36, 0.36, 1, 0.52],
 *   [0.36, 0.36, 0.36, 0.36, 0.52, 1],
 * ];
 * const om = omega(null, { covmat: R });
 * om.omegaH;   // 0.7297
 * om.omegaTot; // 0.8378378378378378
 * ```
 *
 * @category Agreement, reliability and factor analysis
 */
export declare function omega(x: readonly (readonly number[])[] | null, options?: OmegaOptions): OmegaResult;
