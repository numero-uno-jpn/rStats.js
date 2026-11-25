import type { DistResult } from "./dist.js";
/** @category Multivariate analysis */
export type HclustMethod = "ward.D" | "ward.D2" | "single" | "complete" | "average" | "mcquitty" | "median" | "centroid";
/** @category Multivariate analysis */
export interface HclustOptions {
    /** Linkage method; a unique prefix and the alias ward are accepted. */
    method?: HclustMethod | string;
    /** Initial cluster sizes for the objects represented by the dissimilarities. */
    members?: readonly number[];
}
/** @category Multivariate analysis */
export interface HclustFit {
    /** (n - 1) by 2 merge matrix using negative observation and positive merge-row indices. */
    merge: number[][];
    /** Dissimilarity at each successive merge. */
    height: number[];
    /** Observation indices in left-to-right dendrogram order (1-based). */
    order: number[];
    /** Observation labels, or null when the input had no labels. */
    labels: string[] | null;
    /** Canonical linkage method used to construct the tree. */
    method: HclustMethod;
    /** Distance method attribute inherited from the input, or null. */
    distMethod: string | null;
    /** Informational messages produced while resolving the method. */
    warnings: string[];
}
/** @category Multivariate analysis */
export interface CutreeOptions {
    /** Requested number of clusters; a vector requests one partition per element. */
    k?: number | readonly number[];
    /** Merge-height cutoff; a vector requests one partition per element. */
    h?: number | readonly number[];
}
/** @category Multivariate analysis */
export interface CutreeResult {
    /** Cluster labels by observation, or a matrix with one column per requested cutoff. */
    values: number[] | number[][];
    /** Observation names for a single partition, or null when names are unavailable. */
    names: string[] | null;
    /** Observation names for the rows of a multi-cutoff result. */
    rows?: string[] | null;
    /** String labels for the requested k or h columns of a multi-cutoff result. */
    columns?: string[];
}
/**
 * Hierarchical agglomerative clustering of a dissimilarity structure by one of eight linkage methods.
 * Equivalent to R's `hclust()`.
 * @category Multivariate analysis
 */
export declare function hclust(d: DistResult, options?: HclustOptions): HclustFit;
/** Cut a hierarchical clustering tree by cluster count or merge height. */
/**
 * Cuts a hierarchical clustering tree into groups, by number of groups or by height.
 * Equivalent to R's `cutree()`.
 * @category Multivariate analysis
 */
export declare function cutree(tree: HclustFit, options?: CutreeOptions): CutreeResult;
