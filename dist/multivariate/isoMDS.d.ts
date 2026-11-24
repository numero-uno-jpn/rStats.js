import type { DistResult } from "./dist.js";
/** Options for Kruskal non-metric multidimensional scaling. Equivalent to R's MASS::isoMDS().
 * @category Multivariate analysis
 */
export interface IsoMDSOptions {
    /** Number of output dimensions. */
    k?: number;
    /** Initial configuration with one row per object and k columns. */
    y?: readonly (readonly number[])[];
    /** Maximum number of reported iterations. */
    maxit?: number;
    /** Relative stress-change tolerance for stopping. */
    tol?: number;
    /** Minkowski power used to measure distances between configuration points. */
    p?: number;
}
/** One recorded isoMDS stress value.
 * @category Multivariate analysis
 */
export interface IsoMDSTrace {
    /** Reported iteration number. */
    iteration: number;
    /** Kruskal Stress-1, expressed as a percentage. */
    stress: number;
    /** Whether the stopping condition has been met. */
    converged: boolean;
}
/** A labelled coordinate matrix from isoMDS.
 * @category Multivariate analysis
 */
export interface IsoMDSMatrix {
    /** Object labels, or null when unnamed. */
    rows: string[] | null;
    /** Coordinate labels, or null when unnamed. */
    cols: string[] | null;
    /** Object coordinates. */
    values: number[][];
}
/** Result of non-metric multidimensional scaling.
 * @category Multivariate analysis
 */
export interface IsoMDSResult {
    /** Final low-dimensional coordinates. */
    points: IsoMDSMatrix;
    /** Final Kruskal Stress-1, expressed as a percentage. */
    stress: number;
    /** Initial, periodic and final stress values. */
    trace: IsoMDSTrace[];
}
/**
 * Kruskal's non-metric multidimensional scaling.
 * Equivalent to R's `MASS::isoMDS()`.
 * @category Multivariate analysis
 */
export declare function isoMDS(input: DistResult | readonly (readonly number[])[], options?: IsoMDSOptions): IsoMDSResult;
