import { type DataFrame } from "../models/modelFrame.js";
/** A grouping variable as a factor: its levels and the 0-based level of each row. */
interface GroupFactor {
    levels: string[];
    codes: number[];
}
/** The data of a two-sample test's formula: one sample (`y ~ 1`), a pair (`Pair(a, b) ~ 1`) or two groups (`y ~ g`) */
export type TwoSampleData = {
    kind: "one";
    x: number[];
} | {
    kind: "paired";
    x: number[];
    y: number[];
} | {
    kind: "two";
    x: number[];
    y: number[];
    levels: [string, string];
};
/**
 * The samples of a two-sample test's formula. `oneSample` allows `y ~ 1` and `Pair(a, b) ~ 1` (t.test and
 * wilcox.test).
 */
export declare function twoSampleData(formula: string, data: DataFrame, oneSample: boolean): TwoSampleData;
/** The two samples of a formula `y ~ g` whose group has two levels (var.test, ansari.test, mood.test, ks.test) */
export declare function twoGroupData(formula: string, data: DataFrame): {
    x: number[];
    y: number[];
};
/** The response and group of a formula `y ~ g` with one variable on the right (kruskal.test, fligner.test, bartlett.test) */
export declare function kSampleData(formula: string, data: DataFrame): {
    values: number[];
    group: GroupFactor;
};
/** The samples of each level, in the order of the levels */
export declare function samplesByLevel(values: readonly number[], group: GroupFactor): number[][];
/**
 * The response and groups of oneway.test's formula `y ~ A` or `y ~ A + B + ...`: with several factors the groups are
 * the combinations present in the data, numbered with the first factor varying fastest (R's interaction()).
 */
export declare function onewayData(formula: string, data: DataFrame): {
    values: number[];
    groups: number[];
};
/**
 * The matrix (one row per block, one column per group, levels in order) of a blocked design's formula `y ~ w | b`
 * (friedman.test, quade.test). Rows with a missing value are dropped first; every combination of group and block must
 * then occur exactly once.
 */
export declare function blockData(formula: string, data: DataFrame): number[][];
/** The two variables of cor.test's one-sided formula `~ x + z` */
export declare function correlationData(formula: string, data: DataFrame): {
    x: number[];
    y: number[];
};
export {};
