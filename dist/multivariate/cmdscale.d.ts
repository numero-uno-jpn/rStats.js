import type { DistResult } from "./dist.js";
/** @category Multivariate analysis */
export interface CmdscaleOptions {
    /** Number of coordinate dimensions to retain. */
    k?: number;
    /** Whether to add the Cailliez constant to make the dissimilarities Euclidean. */
    add?: boolean;
    /** Whether to return the double-centered squared-distance matrix. */
    xRet?: boolean;
}
/** @category Multivariate analysis */
export interface CmdscaleInputTable {
    /** Observation labels, or null when labels are unavailable. */
    rows: string[] | null;
    /** Coordinate labels, or null for an unlabeled coordinate matrix. */
    cols: string[] | null;
    /** Numeric matrix values arranged by row. */
    values: number[][];
}
/** @category Multivariate analysis */
export interface CmdscaleResult {
    /** Principal coordinate matrix for the retained positive eigenvalues. */
    points: CmdscaleInputTable;
    /** All eigenvalues of the double-centered Gram matrix, including negative values. */
    eig: number[];
    /** Double-centered squared-distance matrix when xRet is true; otherwise null. */
    x: CmdscaleInputTable | null;
    /** Cailliez additive constant, or zero when add is false. */
    ac: number;
    /** Goodness of fit relative to the absolute-eigenvalue sum and positive-eigenvalue sum. */
    GOF: [number, number];
    /** Warnings such as a request for more positive dimensions than are available. */
    warnings: string[];
}
/**
 * Classical (metric) multidimensional scaling of a dissimilarity structure.
 * Equivalent to R's `cmdscale()`.
 * @category Multivariate analysis
 */
export declare function cmdscale(input: DistResult | readonly (readonly number[])[] | CmdscaleInputTable, options?: CmdscaleOptions): CmdscaleResult;
