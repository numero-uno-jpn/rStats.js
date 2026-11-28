/** Distance metric used by {@link dist}.
 * @category Multivariate analysis
 */
export type DistMethod = "euclidean" | "maximum" | "manhattan" | "canberra" | "binary" | "minkowski";
/** A condensed dissimilarity object, in lower-triangle column order.
 * @category Multivariate analysis
 */
export interface DistResult {
    /** Pairwise dissimilarities in lower-triangle column order. */
    values: number[];
    /** Number of observations represented by the dissimilarities. */
    size: number;
    /** Observation labels, or null when no labels were supplied. */
    labels: string[] | null;
    /** Distance method used, or null for a matrix converted by asDist. */
    method: DistMethod | null;
    /** Whether diagonal display was requested. */
    diag: boolean;
    /** Whether upper-triangle display was requested. */
    upper: boolean;
    /** Messages generated while coercing or processing the input. */
    warnings: string[];
}
/** Options for pairwise dissimilarities.
 * @category Multivariate analysis
 */
export interface DistOptions {
    /** Distance metric; a unique prefix is accepted. */
    method?: DistMethod | string;
    /** Minkowski power, required to be finite and positive when method is minkowski. */
    p?: number;
    /** Store the diagonal display flag in the result. */
    diag?: boolean;
    /** Store the upper-triangle display flag in the result. */
    upper?: boolean;
    /** Labels for the observations (one per row). */
    labels?: readonly string[];
}
/** Options for converting a square matrix to condensed dissimilarities.
 * @category Multivariate analysis
 */
export interface AsDistOptions {
    /** Labels for the rows and columns of the square matrix. */
    labels?: readonly string[];
    /** Store the diagonal display flag in the result. */
    diag?: boolean;
    /** Store the upper-triangle display flag in the result. */
    upper?: boolean;
}
/**
 * Compute pairwise dissimilarities in lower-triangle column order. Equivalent to R's `dist()`.
 *
 * @param x Numeric vector, matrix (rows are observations), or data-frame-like object of columns.
 * @param options Distance method and display metadata.
 * @category Multivariate analysis
 */
export declare function dist(x: readonly unknown[] | readonly (readonly unknown[])[] | Record<string, ArrayLike<unknown>>, options?: DistOptions): DistResult;
/**
 * Convert a square matrix using only its lower triangle. Equivalent to R's `as.dist()`.
 * An existing DistResult is returned unchanged.
 * @category Multivariate analysis
 */
export declare function asDist(x: DistResult | readonly (readonly number[])[], options?: AsDistOptions): DistResult;
