import type { DistResult } from "./dist.js";
/** Options for Sammon nonlinear mapping. Equivalent to R's MASS::sammon().
 * @category Multivariate analysis
 */
export interface SammonOptions {
    /** Number of output dimensions. */
    k?: number;
    /** Initial configuration with one row per object and k columns. */
    y?: readonly (readonly number[])[];
    /** Maximum number of update iterations. */
    niter?: number;
    /** Initial step-size multiplier in (0, 0.5]. */
    magic?: number;
    /** Absolute decrease in stress used for stopping after at least 20 iterations. */
    tol?: number;
}
/** A labelled coordinate matrix from Sammon mapping.
 * @category Multivariate analysis
 */
export interface SammonMatrix {
    /** Object labels, or null when unnamed. */
    rows: string[] | null;
    /** Coordinate labels, or null when unnamed. */
    cols: string[] | null;
    /** Object coordinates. */
    values: number[][];
}
/** A labelled square dissimilarity matrix.
 * @category Multivariate analysis
 */
export interface SammonInputTable {
    /** Object labels, or null when unnamed. */
    rows: string[] | null;
    /** Column labels, or null when unnamed. */
    cols: string[] | null;
    /** Symmetric dissimilarity matrix with a zero diagonal and positive off-diagonal entries. */
    values: readonly (readonly number[])[];
}
/** One recorded Sammon stress value.
 * @category Multivariate analysis
 */
export interface SammonTrace {
    /** Completed update iteration. */
    iteration: number;
    /** Normalized Sammon stress at this iteration. */
    stress: number;
    /** Why iteration stopped, present on the final trace entry. */
    reason?: "maxit" | "tol" | "backtracking";
}
/** Result of Sammon nonlinear mapping.
 * @category Multivariate analysis
 */
export interface SammonResult {
    /** Final low-dimensional coordinates. */
    points: SammonMatrix;
    /** Final normalized Sammon stress. */
    stress: number;
    /** Initial, periodic and final stress values with the stopping reason. */
    trace: SammonTrace[];
}
/**
 * Maps dissimilarities into a lower-dimensional configuration by minimizing Sammon stress.
 * Equivalent to R's `MASS::sammon()`.
 * @category Multivariate analysis
 */
export declare function sammon(input: DistResult | SammonInputTable | readonly (readonly number[])[], options?: SammonOptions): SammonResult;
