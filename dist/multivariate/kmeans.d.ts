/** @category Multivariate analysis */
export interface KmeansOptions {
    /** Clustering algorithm; a unique prefix is accepted. */
    algorithm?: "Hartigan-Wong" | "Lloyd" | "Forgy" | "MacQueen" | string;
    /** Maximum number of algorithm iterations (R's iter.max). */
    iterMax?: number;
    /** Number of random initial starts when centers is a count. */
    nstart?: number;
}
/** @category Multivariate analysis */
export interface KmeansInputTable {
    /** Optional observation names, one per row. */
    rows: string[] | null;
    /** Optional variable names, one per column. */
    cols: string[] | null;
    /** Numeric observations arranged by row. */
    values: readonly (readonly number[])[];
}
/** @category Multivariate analysis */
export interface KmeansTable {
    /** Cluster labels corresponding to the rows of the center matrix. */
    rows: string[];
    /** Variable names, or null when the input had no column names. */
    cols: string[] | null;
    /** Cluster centers arranged by row. */
    values: number[][];
}
/** @category Multivariate analysis */
export interface KmeansFit {
    /** 1-based cluster assignment for each observation. */
    cluster: number[];
    /** Observation names, present when the input supplied row names. */
    names?: string[];
    /** Matrix of final cluster centers. */
    centers: KmeansTable;
    /** Total sum of squares around the overall sample mean. */
    totss: number;
    /** Within-cluster sums of squares, one per cluster. */
    withinss: number[];
    /** Sum of all within-cluster sums of squares. */
    totWithinss: number;
    /** Between-cluster sum of squares (totss minus totWithinss). */
    betweenss: number;
    /** Number of observations assigned to each cluster. */
    size: number[];
    /** Number of iterations reported by the selected algorithm. */
    iter: number;
    /** Hartigan-Wong fault code, or null for algorithms without one. */
    ifault: number | null;
    /** Warnings produced during clustering. */
    warnings: string[];
}
/**
 * K-means clustering by the Hartigan-Wong, Lloyd, Forgy or MacQueen algorithm.
 * Equivalent to R's `kmeans()`.
 * @category Multivariate analysis
 */
export declare function kmeans(x: readonly unknown[] | readonly (readonly unknown[])[] | Record<string, ArrayLike<unknown>> | KmeansInputTable, centersInput: number | readonly number[] | readonly (readonly number[])[], options?: KmeansOptions): KmeansFit;
