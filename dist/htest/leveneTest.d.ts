import { type GroupLabel } from "./groups.js";
import type { Sample } from "./types.js";
/** Options for {@link leveneTest}. */
export interface LeveneTestOptions {
    /** The centre of each group: `"median"` (default) or `"mean"`. */
    center?: "median" | "mean" | (string & {});
}
/** Result of {@link leveneTest}: car's table. */
export interface LeveneTestResult {
    /** `["Df", "F value", "Pr(>F)"]`. */
    colNames: string[];
    /** `["group", ""]` (the second row is the residuals). */
    rowNames: string[];
    /** One array per row; NaN where car prints nothing. */
    table: number[][];
}
/**
 * Levene's test for homogeneity of variance across groups. Equivalent to car's `leveneTest(y ~ g, center =
 * median)` (or `mean`). Pairs with a missing value are dropped; groups are ordered by their sorted labels.
 *
 * @param y The values.
 * @param g Group labels, parallel to `y`.
 *
 * @example
 * ```ts
 * const g = ["a", "a", "a", "b", "b", "b", "c", "c", "c"];
 * leveneTest([4.2, 5.1, 6.3, 5.8, 7.9, 8.4, 6.6, 7.0, 5.5], g).table[0]; // [2, 0.15936952714535912, 0.8561748951935417]
 * ```
 */
export declare function leveneTest(y: Sample, g: readonly GroupLabel[], options?: LeveneTestOptions): LeveneTestResult;
