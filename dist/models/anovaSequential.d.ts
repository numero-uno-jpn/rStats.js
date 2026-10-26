import type { AovStrataFit, AovStratum } from "./aovStrata.js";
import type { LmFormulaResult } from "./lm.js";
/** An analysis of variance table, in the form of R's printed table. */
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
/** Sequential sums of squares of the terms (intercept row included when the model has one) and the residuals */
export declare function sequentialTerms(fit: LmFormulaResult): {
    terms: {
        term: number;
        df: number;
        ss: number;
    }[];
    rdf: number;
    rss: number;
};
/**
 * Analysis of variance of linear models fitted from a formula. With one fit, the table of sequential (type I) sums
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
 */
export declare function anova(fit: LmFormulaResult, ...fits: LmFormulaResult[]): AnovaTable;
/** Result of {@link aovSummary} for a fit with error strata. */
export interface AovStrataSummary {
    /** The table of each stratum, in order, without the intercept stratum. */
    strata: AovStratum[];
    warnings: string[];
}
/**
 * The table of R's `summary(aov(formula, data))` for a fit without `Error()`: the rows of {@link anova}'s
 * sequential table, except that without residual degrees of freedom there is no `Residuals` row and no `F value` and
 * `Pr(>F)` columns. For a fit with an `Error()` term, the tables of the strata (`{ strata: [{ stratum: "Error: id",
 * colNames, rowNames, table }, ...] }`), without the intercept stratum.
 *
 * @param fit A fit from {@link aov} (or {@link lm}) with a formula.
 */
export declare function aovSummary(fit: AovStrataFit): AovStrataSummary;
export declare function aovSummary(fit: LmFormulaResult): AnovaTable;
export declare function aovSummary(fit: LmFormulaResult | AovStrataFit): AnovaTable | AovStrataSummary;
