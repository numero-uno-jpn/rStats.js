import type { FormulaNode, ParsedFormula } from "./formula.js";
import type { LmFormulaOptions } from "./lm.js";
import type { DataFrame } from "./modelFrame.js";
/**
 * The table of one error stratum, as `summary(aov(...))` prints it.
 *
 * @category Linear models and ANOVA
 */
export interface AovStratum {
    /** `"Error: id"`, `"Error: id:W"`, `"Error: Within"`. */
    stratum: string;
    /** R's column names: `"Df"`, `"Sum Sq"`, `"Mean Sq"`, and `"F value"`, `"Pr(>F)"` when there are residuals. */
    colNames: string[];
    /** Row names: the labels of the terms in the stratum, then `"Residuals"` when its df is positive. */
    rowNames: string[];
    /** One array per row; NaN where R prints nothing. */
    table: number[][];
}
/**
 * Result of {@link aov} with an `Error()` term.
 *
 * @category Linear models and ANOVA
 */
export interface AovStrataFit {
    /** The formula. */
    formula: string;
    /** Always true: the fit has error strata (pass it to {@link aovSummary}). */
    multistratum: true;
    /** The tables of the strata, in order (the intercept stratum included when the model has one). */
    strata: AovStratum[];
    /** 0-based indices of the rows of `data` used. */
    rows: number[];
    /** R's warnings, such as `Error() model is singular`. */
    warnings: string[];
}
/**
 * The multistratum fit of `y ~ treatment + Error(e)`.
 *
 * @param treatment The right-hand side without the Error() term.
 * @param errorRhs The argument of Error().
 */
export declare function aovStrataFit(formula: string, parsed: ParsedFormula, treatment: FormulaNode | undefined, errorRhs: FormulaNode, data: DataFrame, options: LmFormulaOptions): AovStrataFit;
