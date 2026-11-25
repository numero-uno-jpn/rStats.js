/** A categorical data frame for multiple correspondence analysis.
 * @category Multivariate analysis
 */
export interface MjcaInputTable {
    /** Row labels, or null to use one-based row numbers. */
    rows: string[] | null;
    /** Names of the categorical variables. */
    cols: string[];
    /** Categorical values; null and non-string entries are omitted as incomplete rows. */
    values: readonly (readonly (string | number | null)[])[];
}
/** Options for multiple correspondence analysis. Equivalent to R's ca::mjca().
 * @category Multivariate analysis
 */
export interface MjcaOptions {
    /** Analysis variant: adjusted (default), indicator or Burt; JCA is explicitly unsupported. */
    lambda?: "adjusted" | "indicator" | "Burt" | "JCA";
    /** Number of dimensions requested in the result. */
    nd?: number;
    /** One-based variable indices treated as supplementary. */
    supcol?: number | readonly number[];
    /** One-based category indices in variable/level order to include in the active analysis. */
    subsetcat?: number | readonly number[];
    /** Whether to include the indicator matrix in the result. */
    reti?: boolean;
    /** Separator used when constructing category labels. */
    ps?: string;
}
/** A labelled matrix returned by multiple correspondence analysis.
 * @category Multivariate analysis
 */
export interface MjcaMatrix {
    /** Row labels, or null when unnamed. */
    rows: string[] | null;
    /** Column labels, or null when unnamed. */
    cols: string[] | null;
    /** Matrix values. */
    values: (number | string)[][];
}
/** Variable names and observed category counts.
 * @category Multivariate analysis
 */
export interface MjcaLevelsN {
    /** Names of the categorical variables. */
    names: string[];
    /** Number of observed levels for each variable. */
    values: number[];
}
/** Result of multiple correspondence analysis.
 * @category Multivariate analysis
 */
export interface MjcaFit {
    /** Singular values or adjusted eigenvalue roots, according to lambda. */
    sv: number[];
    /** Analysis variant used. */
    lambda: "adjusted" | "indicator" | "Burt";
    /** Percentage contributions to total inertia for the retained axes. */
    inertiaE: number[];
    /** Total inertia for the selected analysis variant. */
    inertiaT: number;
    /** Inertia adjustment metadata, or "NA" when not applicable. */
    inertiaEt: number | "NA";
    /** Category labels in analysis order. */
    levelnames: string[];
    /** Factor and level names for the complete category set. */
    factors: MjcaMatrix;
    /** Variable names and observed level counts. */
    levelsN: MjcaLevelsN;
    /** Number of dimensions requested. */
    nd: number;
    /** Maximum available number of dimensions. */
    ndMax: number;
    /** Names of the categorical variables. */
    colnames: string[];
    /** Category masses. */
    colmass: number[];
    /** Chi-square distances of categories from the centroid. */
    coldist: number[];
    /** Category contributions to inertia. */
    colinertia: number[];
    /** Standard category coordinates. */
    colcoord: MjcaMatrix;
    /** Principal category coordinates. */
    colpcoord: MjcaMatrix;
    /** Category contributions by axis. */
    colctr: MjcaMatrix;
    /** Squared correlations of categories with axes. */
    colcor: MjcaMatrix;
    /** One-based indices of supplementary categories, or "NA". */
    colsup: number[] | "NA";
    /** One-based selected category indices, or "NA" for the full set. */
    subsetcol: number[] | "NA";
    /** Burt cross-product table. */
    Burt: MjcaMatrix;
    /** Updated Burt table, or "NA" when not returned. */
    BurtUpd: number[][] | "NA";
    /** Within-variable sub-inertia table. */
    subinertia: MjcaMatrix;
    /** Row labels when row results are available. */
    rownames?: string[] | null;
    /** Row masses when row results are available. */
    rowmass?: number[];
    /** Row chi-square distances when row results are available. */
    rowdist?: number[];
    /** Row contributions to inertia when row results are available. */
    rowinertia?: number[];
    /** Standard row coordinates when available. */
    rowcoord?: MjcaMatrix;
    /** Principal row coordinates when available. */
    rowpcoord?: MjcaMatrix;
    /** Row contributions by axis, or "NA" for unsupported variants. */
    rowctr?: MjcaMatrix | "NA";
    /** Squared row correlations by axis, or "NA" for unsupported variants. */
    rowcor?: MjcaMatrix | "NA";
    /** Indicator matrix when reti is true, or "NA" otherwise. */
    indmat?: MjcaMatrix | "NA";
    /** Number of incomplete rows omitted from the analysis. */
    omitted: number;
}
/**
 * Computes multiple correspondence analysis for categorical columns.
 * Equivalent to R's `ca::mjca()`.
 * @category Multivariate analysis
 */
export declare function mjca(input: MjcaInputTable, options?: MjcaOptions): MjcaFit;
