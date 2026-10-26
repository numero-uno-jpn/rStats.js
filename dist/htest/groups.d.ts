import type { Sample } from "./types.js";
/** Group label: a number or a string. */
export type GroupLabel = number | string;
/** Groups with their labels: the sorted labels (x, g form) or the 1-based positions in the list (list form) */
export interface LabelledGroups {
    labels: string[];
    groups: number[][];
}
/**
 * Normalise the two input forms to groups with NaN removed, each with its label. In the x, g form a label whose
 * values are all missing has no group (as R drops an unused factor level). In the list form a group left empty is
 * dropped, or rejected with R's message when `emptyGroups` is `"error"` (kruskal.test, fligner.test).
 */
export declare function labelledGroups(x: Sample | readonly Sample[], g?: readonly GroupLabel[], emptyGroups?: "drop" | "error"): LabelledGroups;
/** Normalise the two input forms to an array of non-empty groups with NaN removed (see {@link labelledGroups}) */
export declare function toGroups(x: Sample | readonly Sample[], g?: readonly GroupLabel[], emptyGroups?: "drop" | "error"): number[][];
/** Median (the mean of the two middle values for an even count) */
export declare function median(x: readonly number[]): number;
/** Rows of a blocks x treatments table with any NaN dropped (R's complete.cases) */
export declare function completeRows(y: readonly (readonly number[])[]): number[][];
