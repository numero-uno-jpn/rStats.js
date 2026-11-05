import type { AovStrataFit, AovStratum } from "./aovStrata.js";
import type { LmFormulaResult } from "./lm.js";
/**
 * An analysis of variance table, in the form of R's printed table.
 *
 * @category Linear models and ANOVA
 */
export interface AnovaTable {
    /** R's column names, such as `"Df"`, `"Sum Sq"`, `"Mean Sq"`, `"F value"`, `"Pr(>F)"`. */
    colNames: string[];
    /** Row names (term labels and `"Residuals"`, or `"1"`, `"2"`, ... for a comparison). */
    rowNames: string[];
    /** One array per row; NaN where R prints nothing or NA. */
    table: number[][];
    /** R's warnings. */
    warnings: string[];
}
/**
 * The exponent k that brings the responses of the fits (fitted values and residuals) into [1, 2). Rows of weight 0
 * are not in the fit and are left out (#350: a residual of 1e308 there made the sums of squares of the other rows
 * underflow)
 */
export declare function responseScale(fits: readonly LmFormulaResult[]): number;
/**
 * Residual sums of squares of fits in the scale of the response divided by 2^k (see src/internal/summary.ts): rss /
 * 2^2k when rss is in range, otherwise from the residuals scaled by 2^-k
 */
export declare function scaledRss(fits: readonly LmFormulaResult[], k: number): number[];
/** The weights and responses scaled by 2^-k of the rows of positive weight (rows of weight 0 are not in the fit) */
export declare function weightedResponse(fit: LmFormulaResult, k: number): (readonly [number, number])[];
/**
 * Where a sum over the weights overflows (the total of the weights of 1e308, #347), the weights are divided by an even
 * power of 2 2^kw, this one: the sums of squares are then in units of 2^(2k + kw)
 */
export declare function evenWeightExponent(wy: readonly (readonly [number, number])[]): number;
/**
 * Whether a residual sum of squares rss (of the response scaled by 2^-k, wy from {@link weightedResponse}) is 0
 * within rounding error: below 1e-24 times the weighted, uncentred sum of squares of the response, residuals below
 * 1e-12 of the response's size (the level of aovEz's dataSS). The sum takes the weights divided by 2^kw first, and
 * by the even power of 2 of {@link evenWeightExponent} where it overflows. Also true for a NaN rss. Anova (car)
 * throws on it, the sequential table of anova and aovSummary takes the sums of squares as 0
 */
export declare function rssWithinRounding(wy: readonly (readonly [number, number])[], rss: number, kw?: number): boolean;
/**
 * Sequential sums of squares of the terms (intercept row included when the model has one) and the residuals, of the
 * response scaled by 2^-k (k returned): F and p-values come from these, the sums of squares are scaled back by 2^2k
 */
export declare function sequentialTerms(fit: LmFormulaResult): {
    terms: {
        term: number;
        df: number;
        ss: number;
    }[];
    rdf: number;
    rss: number;
    k: number;
};
/**
 * Analysis of variance of linear models fitted from a formula. Equivalent to R's `anova()`. With one fit, the table of sequential (type I) sums
 * of squares, equivalent to R's `anova(fit)`: one row per term (the intercept left out), in the order of the model,
 * and `Residuals`. With several fits, the comparison of the models in the order given, equivalent to R's
 * `anova(fit1, fit2, ...)`: columns `Res.Df`, `RSS`, `Df`, `Sum of Sq`, `F`, `Pr(>F)`, the F tests scaled by the
 * residual mean square of the model with the fewest residual degrees of freedom.
 *
 * @param fit A fit from {@link lm} (or {@link aov} without `Error()`) with a formula.
 * @param fits More fits to compare with the first.
 *
 * @example
 * ```ts
 * const data = { y: [4.2, 5.1, 6.3, 5.8, 7.9, 8.4], g: ["a", "a", "b", "b", "c", "c"] };
 * const t = anova(lm("y ~ g", data));
 * t.rowNames; // ["g", "Residuals"]
 * ```
 *
 * @category Linear models and ANOVA
 */
export declare function anova(fit: LmFormulaResult, ...fits: LmFormulaResult[]): AnovaTable;
/**
 * Result of {@link aovSummary} for a fit with error strata.
 *
 * @category Linear models and ANOVA
 */
export interface AovStrataSummary {
    /** The table of each stratum, in order, without the intercept stratum. */
    strata: AovStratum[];
    /** The fit's warnings (such as "Error() model is singular"), each once; R gives them when fitting. */
    warnings: string[];
}
/**
 * The table of an analysis of variance fitted by {@link aov}. Equivalent to R's `summary()`. As R's
 * `summary(aov(formula, data))` for a fit without `Error()`: the rows of {@link anova}'s
 * sequential table, except that without residual degrees of freedom there is no `Residuals` row and no `F value` and
 * `Pr(>F)` columns. For a fit with an `Error()` term, the tables of the strata (`{ strata: [{ stratum: "Error: id",
 * colNames, rowNames, table }, ...] }`), without the intercept stratum.
 *
 * @param fit A fit from {@link aov} (or {@link lm}) with a formula.
 *
 * @example
 * ```ts
 * const fit = aov("y ~ g", { y: [4.2, 5.1, 6.3, 5.8, 7.9, 8.4], g: ["a", "a", "b", "b", "c", "c"] });
 * const t = aovSummary(fit);
 * t.colNames; // ["Df", "Sum Sq", "Mean Sq", "F value", "Pr(>F)"]
 * t.table[0]; // [2, 12.413, 6.2067, 28.427, 0.011221]
 * ```
 *
 * @category Linear models and ANOVA
 */
export declare function aovSummary(fit: AovStrataFit): AovStrataSummary;
export declare function aovSummary(fit: LmFormulaResult): AnovaTable;
export declare function aovSummary(fit: LmFormulaResult | AovStrataFit): AnovaTable | AovStrataSummary;
