import type { Sample } from "../htest/types.js";
/** A data frame: an object of columns of equal length. `null` (and `NaN` in a numeric column) is a missing value. */
export type DataFrame = Record<string, readonly (number | string | boolean | null)[] | Float64Array>;
/** A variable of a model frame: numeric values, or a factor (level index per row). */
export type FrameVariable = {
    kind: "numeric";
    values: number[];
} | {
    kind: "factor";
    levels: string[];
    codes: number[];
};
/** Result of {@link modelFrame}. */
export interface ModelFrame {
    /** 0-based indices of the rows of the data that were kept. */
    rows: number[];
    /** One entry per variable (in the order given), restricted to the rows kept. */
    variables: FrameVariable[];
    /** The weights of the rows kept (absent without weights). */
    weights?: number[];
}
/** Options for {@link modelFrame}. */
export interface ModelFrameOptions {
    /** The order of the levels of factors (`factor(x, levels = ...)`); values not among them are missing. */
    levels?: Record<string, readonly string[]>;
    /** Weights: an array parallel to the rows of the data, or the name of a numeric column. */
    weights?: Sample | string;
    /** Drop levels that have no row left. */
    dropUnusedLevels?: boolean;
}
/** Comparison of strings by code point (not by UTF-16 code unit) */
export declare function compareCodePoints(a: string, b: string): number;
/**
 * The model frame of the given variables: each variable taken from the data, the rows with a missing value in any
 * of them (or in the weights) dropped.
 *
 * Errors as R: `object 'Q' not found` for a variable that is not a column, `variable lengths differ (found for 'x')`
 * for columns of different lengths.
 */
export declare function modelFrame(data: DataFrame, names: readonly string[], options?: ModelFrameOptions): ModelFrame;
