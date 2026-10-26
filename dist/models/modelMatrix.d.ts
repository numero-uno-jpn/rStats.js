import { type FormulaNode, type ParsedFormula, type Terms } from "./formula.js";
import { type DataFrame, type ModelFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";
/**
 * A contrast of a factor: R's `contr.treatment`, `contr.sum` or `contr.helmert`.
 *
 * @category Linear models and ANOVA
 */
export type ContrastName = "contr.treatment" | "contr.sum" | "contr.helmert";
/**
 * Options for {@link modelMatrix}.
 *
 * @category Linear models and ANOVA
 */
export interface ModelMatrixOptions {
    /**
     * A contrast per factor (default `"contr.treatment"`); a boolean variable takes it too. A name that is not a
     * variable of the formula gives the warning `variable 'B' is absent, its contrast will be ignored`; a numeric
     * variable (the response too) is an error.
     */
    contrasts?: Record<string, ContrastName>;
    /** The order of the levels of a factor (`{ A: ["c", "a", "b"] }`), as `factor(x, levels = ...)` in R. */
    levels?: Record<string, readonly string[]>;
}
/**
 * Result of {@link modelMatrix}.
 *
 * @category Linear models and ANOVA
 */
export interface ModelMatrixResult {
    /** Column names, such as `"(Intercept)"`, `"Ab"`, `"Ab:Bq"`, `"x"`. */
    colNames: string[];
    /** The term of each column (0 for the intercept, 1 for the first term). */
    assign: number[];
    /** The model matrix (array of rows). */
    x: number[][];
    /** 0-based indices of the rows of the data used (rows with a missing value are dropped). */
    rows: number[];
    /** Labels of the terms (variables joined by `:`). */
    termLabels: string[];
    /** Degree of each term. */
    order: number[];
    /** Whether the model has an intercept. */
    intercept: boolean;
    /** The variables of the formula, the response first. */
    variables: string[];
    /** R's factors attribute: one array per variable, one code per term (0 not in it, 1 contrasts, 2 indicators). */
    factors: number[][];
    /** R's warnings. */
    warnings: string[];
}
/** A contrast matrix (one row per level) and its column names */
export declare function contrastMatrix(levels: readonly string[], contrast: ContrastName | "indicators"): {
    m: number[][];
    names: string[];
};
/** A model matrix with what the fits need. */
export interface Design {
    terms: Terms;
    frame: ModelFrame;
    /** The model matrix (array of rows) */
    x: number[][];
    colNames: string[];
    assign: number[];
    /** The response's values (rows kept), if the formula has one */
    y?: number[];
    warnings: string[];
}
/** Options of {@link design} */
export interface DesignOptions extends ModelMatrixOptions {
    weights?: Sample | string;
    dropUnusedLevels?: boolean;
    /** Contrast used for every factor instead of `contrasts` (the error model of aov) */
    allContrasts?: ContrastName;
    /** The intercept flag to use instead of the formula's (the error model of aov) */
    intercept?: boolean;
    /** More variables whose missing values drop rows (the rest of the formula, for the error model of aov) */
    extraVariables?: readonly string[];
    /**
     * The variables a name of `contrasts` may refer to without the warning that it is absent (default: the variables
     * of the whole formula, the response included; lmer passes those of the fixed-effects part, aov with Error() those
     * of the formula without the Error() term)
     */
    contrastVariables?: readonly string[];
}
/**
 * The model matrix of a parsed formula on the data.
 *
 * @param rhs The right-hand side to use (default: the formula's; aov passes it without the Error() term).
 */
export declare function design(parsed: ParsedFormula, data: DataFrame, options?: DesignOptions, rhs?: FormulaNode | undefined): Design;
/**
 * The model matrix of a formula on a data frame, with the attributes of R's `terms()`. Equivalent to R's
 * `model.matrix(formula, data)`. With `contrasts.arg`, together with `attr(terms(formula), ...)`.
 *
 * Rows with a missing value (`null`, or `NaN` in a numeric column) in any variable of the formula are dropped first.
 * Strings are factors of the values in the rows kept (sorted by code point), unless `levels` gives the levels, which
 * are then all kept even without a row (their columns are 0); booleans are factors with always the two levels FALSE
 * and TRUE; numbers are numeric.
 *
 * @param formula A formula such as `"y ~ A * B"`, `"y ~ x + A - 1"` or `"~ A"`.
 * @param data The data frame: an object of columns.
 *
 * @example
 * ```ts
 * const m = modelMatrix("y ~ A", { y: [1, 2, 3, 4], A: ["a", "b", "a", "b"] });
 * m.colNames; // ["(Intercept)", "Ab"]
 * m.x;        // [[1, 0], [1, 1], [1, 0], [1, 1]]
 * ```
 *
 * @category Linear models and ANOVA
 */
export declare function modelMatrix(formula: string, data: DataFrame, options?: ModelMatrixOptions): ModelMatrixResult;
