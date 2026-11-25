/** A contingency table with optional row and column labels.
 * @category Multivariate analysis
 */
export interface CaInputTable {
    /** Row labels, or null when the rows are unnamed. */
    rows: string[] | null;
    /** Column labels, or null when the columns are unnamed. */
    cols: string[] | null;
    /** Non-negative cell counts, arranged as rows. */
    values: readonly (readonly number[])[];
}
/** Options for simple correspondence analysis. Equivalent to R's ca::ca().
 * @category Multivariate analysis
 */
export interface CaOptions {
    /** Number of dimensions to retain in the returned coordinates. */
    nd?: number;
    /** One-based indices of supplementary rows, excluded from the active analysis. */
    suprow?: number | readonly number[];
    /** One-based indices of supplementary columns, excluded from the active analysis. */
    supcol?: number | readonly number[];
}
/** A labelled numeric matrix returned by correspondence analysis.
 * @category Multivariate analysis
 */
export interface CaMatrix {
    /** Row labels, or null when unnamed. */
    rows: string[] | null;
    /** Column labels, or null when unnamed. */
    cols: string[] | null;
    /** Matrix values in row-major order. */
    values: number[][];
}
/** Result of simple correspondence analysis.
 * @category Multivariate analysis
 */
export interface CaFit {
    /** Singular values of the standardized residual matrix. */
    sv: number[];
    /** Number of retained dimensions, or "NA" when not specified. */
    nd: number | "NA";
    /** Original row labels. */
    rownames: string[] | null;
    /** Row masses in the active table. */
    rowmass: number[];
    /** Chi-square distances of rows from the column profile centroid. */
    rowdist: number[];
    /** Row contributions to total inertia. */
    rowinertia: number[];
    /** Standard row coordinates, including supplementary rows. */
    rowcoord: CaMatrix;
    /** One-based indices of supplementary rows. */
    rowsup: number[];
    /** Original column labels. */
    colnames: string[] | null;
    /** Column masses in the active table. */
    colmass: number[];
    /** Chi-square distances of columns from the row profile centroid. */
    coldist: number[];
    /** Column contributions to total inertia. */
    colinertia: number[];
    /** Standard column coordinates, including supplementary columns. */
    colcoord: CaMatrix;
    /** One-based indices of supplementary columns. */
    colsup: number[];
    /** Active contingency table after supplementary rows and columns are removed. */
    N: CaMatrix;
}
/** Summary tables for eigenvalues, rows and columns.
 * @category Multivariate analysis
 */
export interface CaSummary {
    /** Eigenvalues, percentages of inertia and cumulative percentages. */
    scree: CaMatrix;
    /** Row mass, quality, inertia and axis contributions. */
    rows: CaMatrix;
    /** Column mass, quality, inertia and axis contributions. */
    columns: CaMatrix;
}
/** Options for constructing a correspondence-analysis map.
 * @category Multivariate analysis
 */
export interface CaCoordOptions {
    /** Coordinate scaling convention for the row and column maps. */
    type?: "standard" | "principal" | "symmetric" | "rowprincipal" | "colprincipal" | "symbiplot" | "rowgab" | "colgab" | "rowgreen" | "colgreen";
    /** One-based dimensions to include. */
    dim?: readonly number[];
    /** Whether to return only row coordinates. */
    rows?: boolean;
    /** Whether to return only column coordinates. */
    cols?: boolean;
}
/**
 * Computes simple correspondence analysis of a contingency table.
 * Equivalent to R's `ca::ca()`.
 * @category Multivariate analysis
 */
export declare function ca(input: readonly (readonly number[])[] | CaInputTable, options?: CaOptions): CaFit;
/**
 * Summarizes eigenvalues and row and column contributions from correspondence analysis.
 * Equivalent to R's `summary.ca()`.
 * @category Multivariate analysis
 */
export declare function caSummary(result: CaFit): CaSummary;
/**
 * The row and column coordinates of a correspondence-analysis map, returned by `caCoord` when both are requested.
 * @category Multivariate analysis
 */
export interface CaCoordMaps {
    /** Row coordinates (one row per active and supplementary row, one column per dimension). */
    rows: CaMatrix;
    /** Column coordinates (one row per active and supplementary column, one column per dimension). */
    columns: CaMatrix;
}
/**
 * Computes row and column coordinates for a correspondence-analysis map.
 * Equivalent to R's `ca::cacoord()`.
 * @category Multivariate analysis
 */
export declare function caCoord(result: CaFit, options?: CaCoordOptions): CaMatrix | CaCoordMaps;
