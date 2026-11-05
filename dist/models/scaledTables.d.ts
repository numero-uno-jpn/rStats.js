/** A table with the columns of the returned one, its sums of squares in the units of the fit */
export interface ScaledTable {
    colNames: string[];
    rowNames: string[];
    table: number[][];
}
/** The scaled table of anova(), aovSummary() and aovEz() results; the scaled strata of aov() with Error() and its summary */
export declare const scaledTables: WeakMap<object, ScaledTable[] | ScaledTable>;
