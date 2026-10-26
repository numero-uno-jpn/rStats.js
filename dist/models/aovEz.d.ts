import { type DataFrame } from "./modelFrame.js";
/**
 * An effect size of {@link aovEz}: generalized (`"ges"`) or partial (`"pes"`) eta squared.
 *
 * @category Linear models and ANOVA
 */
export type AovEzEffectSize = "ges" | "pes";
/**
 * Options for {@link aovEz}.
 *
 * @category Linear models and ANOVA
 */
export interface AovEzOptions {
    /** Column of the subject identifiers. */
    id: string;
    /** Column of the response. */
    dv: string;
    /** Between-subjects factors (columns). */
    between?: readonly string[] | string;
    /** Within-subjects factors (columns). */
    within?: readonly string[] | string;
    /** Type of the sums of squares: 3 (default) or 2. */
    type?: 2 | 3;
    /** Sphericity correction of the anova table: `"GG"` (default), `"HF"` or `"none"`. */
    correction?: "GG" | "HF" | "none";
    /** Effect sizes: `"ges"` (default), `"pes"`, or both. */
    es?: AovEzEffectSize | readonly AovEzEffectSize[];
    /** Observed (not manipulated) factors, for the generalized eta squared. */
    observed?: readonly string[] | string;
}
/**
 * A table of {@link aovEz}.
 *
 * @category Linear models and ANOVA
 */
export interface AovEzTable {
    /** Column names, such as afex's `"num Df"`, `"den Df"`, `"MSE"`, `"F"`, `"ges"`, `"Pr(>F)"`. */
    colNames: string[];
    /** Row names: the terms (and `"(Intercept)"` in car's tables). */
    rowNames: string[];
    /** One array per row, one value per column. */
    table: number[][];
}
/**
 * Result of {@link aovEz}.
 *
 * @category Linear models and ANOVA
 */
export interface AovEzResult {
    /** afex's anova table (without the intercept). */
    anova: AovEzTable;
    /** car's univariate tests (intercept included); without within-subject factors, car's Anova table. */
    univariate: AovEzTable;
    /** Greenhouse-Geisser and Huynh-Feldt corrections of the rows with more than one within-subject df. */
    corrections?: AovEzTable;
    /** Mauchly's tests of the same rows. */
    sphericity?: AovEzTable;
    /** The within-subject factors (columns), as given. */
    within: string[];
    /** afex's and car's warnings (averaged cells, removed subjects, `HF eps > 1 treated as 1`, ...). */
    warnings: string[];
}
/**
 * Repeated-measures (within-subjects), between-subjects and mixed analysis of variance from long data. Equivalent to
 * `afex::aov_ez()` in R. As afex's
 * `aov_ez(id, dv, data, between, within, type, observed, anova_table = list(correction, es))`, it returns afex's
 * anova table and car's univariate tests, sphericity corrections (Greenhouse-Geisser, Huynh-Feldt) and Mauchly tests.
 *
 * Between-subjects factors use `contr.sum` and sorted levels; the levels of within-subjects factors are taken in order
 * of first appearance. Several rows for a subject and a cell are averaged (with afex's warning); subjects that miss
 * a cell are removed (with a warning).
 *
 * @param data Long data: one row per observation.
 *
 * @example
 * ```ts
 * const data = {
 *   id: ["s1", "s1", "s2", "s2", "s3", "s3", "s4", "s4"],
 *   W: ["a", "b", "a", "b", "a", "b", "a", "b"],
 *   y: [4.1, 5.0, 3.8, 4.9, 4.4, 5.6, 4.0, 4.7],
 * };
 * aovEz(data, { id: "id", dv: "y", within: "W" }).anova.rowNames; // ["W"]
 * ```
 *
 * @category Linear models and ANOVA
 */
export declare function aovEz(data: DataFrame, options: AovEzOptions): AovEzResult;
