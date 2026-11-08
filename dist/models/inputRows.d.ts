import type { DataFrame } from "./modelFrame.js";
/** Records the number of input rows of a fit and returns the fit */
export declare function setInputRowCount<T extends object>(fit: T, n: number | undefined): T;
/**
 * The number of input rows of a fit: as recorded, or else one more than the last row used (a fit copied from the
 * result, whose trailing rows dropped for a missing value cannot be known)
 */
export declare function inputRowCount(fit: object, rows: readonly number[]): number;
/** The number of rows of a data frame: the length of a column of the formula's variables, else of its first column */
export declare function dataRowCount(data: DataFrame, variables: readonly string[]): number | undefined;
