import type { DataFrame } from "./modelFrame.js";
/**
 * A contingency table of any number of dimensions: `counts` in R's order (the first index varies fastest), `dim`
 * the number of levels of each dimension, and optionally the names of the dimensions and of their levels.
 * @category Regression
 */
export interface ArrayTable {
    /** The counts, the first index varying fastest. */
    counts: readonly number[];
    /** The number of levels of each dimension. */
    dim: readonly number[];
    /** Names of the dimensions. */
    names?: readonly string[];
    /** Names of the levels of each dimension. */
    levels?: readonly (readonly string[])[];
}
/**
 * A table as nested arrays, the first index outermost (`t[i][j][k]`).
 * @category Regression
 */
export type NestedTable = readonly (number | NestedTable)[];
/**
 * Options for {@link loglin}.
 * @category Regression
 */
export interface LoglinOptions {
    /** Starting table (R's order, default all 1); zeros mark structural zeros, kept zero in the fit. */
    start?: readonly number[];
    /** Convergence bound on the largest absolute difference between observed and fitted margins (default 0.1). */
    eps?: number;
    /** Maximum number of iterations (default 20). */
    iter?: number;
}
/**
 * Result of {@link loglin}.
 * @category Regression
 */
export interface LoglinResult {
    /** Likelihood-ratio and Pearson statistics, and their degrees of freedom (no adjustment for structural zeros). */
    lrt: number;
    /** Pearson's statistic. */
    pearson: number;
    /** Degrees of freedom. */
    df: number;
    /** The margins fitted, with names where the table has them. */
    margin: (string | number)[][];
    /** The fitted table (R's order). */
    fit: number[];
    /**
     * Zero-sum parameters of log(fit): "(Intercept)", one entry per term ("A", "A.B"), each in R's order; all NaN when
     * a fitted value is 0 (as R's NA).
     */
    param: Record<string, number[]>;
    /** The names of `param` in R's order (an object puts names that are numbers first). */
    paramNames: string[];
    /** Iterations (as R prints them). */
    iterations: number;
    /** The deviation of the last iteration (NaN without margins). */
    deviation: number;
    /** Warnings. */
    warnings: string[];
}
/**
 * Fits a hierarchical log-linear model to a contingency table by iterative proportional fitting (Haberman 1972),
 * given the margins to fit (the maximal terms, e.g. `[["A", "B"], ["A", "C"]]` for [AB][AC]). Margins are names of
 * dimensions or 1-based numbers, as in R. Equivalent to R's `loglin()`. It returns the fit and
 * the parameters (R's `fit = TRUE, param = TRUE`).
 *
 * The iterations stop when the largest absolute difference between observed and fitted margins falls below `eps`
 * (0.1 by default, a loose bound, as R) or after `iter` cycles.
 * @example
 * ```ts
 * const t = { counts: [10, 20, 30, 40], dim: [2, 2], names: ["A", "B"] };
 * loglin(t, [["A"], ["B"]]).lrt; // 0.80435 (the independence model)
 * ```
 * @category Regression
 */
export declare function loglin(table: ArrayTable | NestedTable, margin: readonly (readonly (string | number)[] | string | number)[], options?: LoglinOptions): LoglinResult;
/**
 * Options for {@link loglm}.
 * @category Regression
 */
export interface LoglmOptions {
    /** Starting table (R's order of the table), zeros for structural zeros; with a table `data` only. */
    start?: readonly number[];
    /** Convergence bound (default 0.1), passed to {@link loglin}. */
    eps?: number;
    /** Maximum number of iterations (default 40). */
    iter?: number;
    /** The order of the levels of factors of a data frame (default: sorted). */
    levels?: Record<string, readonly string[]>;
}
/**
 * Result of {@link loglm}.
 * @category Regression
 */
export interface LoglmResult extends LoglinResult {
    /** The formula. */
    formula: string;
    /** The likelihood-ratio statistic (the deviance against the saturated model). */
    deviance: number;
    /** The table fitted: counts (R's order), dims, names and levels. */
    frequencies: LoglmFrequencies;
    /** Cells of the table. */
    nobs: number;
}
/**
 * The table of a {@link loglm} fit.
 * @category Regression
 */
export interface LoglmFrequencies {
    /** The counts (R's order). */
    counts: number[];
    /** The number of levels of each dimension. */
    dim: number[];
    /** Names of the dimensions. */
    names: string[];
    /** Names of the levels. */
    levels: string[][];
}
/**
 * Log-linear model given by a formula: a front end to {@link loglin}. The right-hand side gives the margins (its
 * maximal terms; `a:b`, `a*b` and `a/b` are the same margin). `data` is a table with named dimensions (numbers in
 * the formula stand for dimensions), or a data frame with the frequencies on the left of the formula, where cells
 * absent from the data are structural zeros and each takes one degree of freedom off. Equivalent to R's
 * `MASS::loglm()`.
 * @example
 * ```ts
 * const t = { counts: [10, 20, 30, 40, 12, 18, 25, 35], dim: [2, 2, 2], names: ["A", "B", "C"] };
 * loglm("~ A*B + C", t).deviance; // 0.54958
 * ```
 * @category Regression
 */
export declare function loglm(formula: string, data: ArrayTable | NestedTable | DataFrame, options?: LoglmOptions): LoglmResult;
/**
 * Options for {@link loglmResiduals}.
 * @category Regression
 */
export interface LoglmResidualsOptions {
    /** `"deviance"` (default), `"pearson"` or `"response"`. */
    type?: "deviance" | "pearson" | "response";
}
/**
 * Residuals of a {@link loglm} fit, one per cell (R's order). Equivalent to `MASS::residuals.loglm()` in R.
 * @example
 * ```ts
 * const t = { counts: [10, 20, 30, 40], dim: [2, 2], names: ["A", "B"] };
 * loglmResiduals(loglm("~ A + B", t), { type: "pearson" }); // [-0.57735, 0.4714, 0.37796, -0.30861]
 * ```
 * @category Regression
 */
export declare function loglmResiduals(fit: LoglmResult, options?: LoglmResidualsOptions): number[];
/**
 * Result of {@link loglmAnova}: the models in the order given, then the saturated model.
 * @category Regression
 */
export interface LoglmAnovaResult {
    /** "Model 1", ..., "Saturated". */
    rows: string[];
    /** The formulas ("" for the saturated model). */
    formulas: string[];
    /** Deviances. */
    deviance: number[];
    /** Residual degrees of freedom. */
    df: number[];
    /**
     * Changes from the previous row (NaN for the first), and the chi-squared p-values of the changes, computed as R's
     * `1 - pchisq()` (a p-value below about 1e-16 is 0).
     */
    deltaDeviance: number[];
    /** Changes of the degrees of freedom. */
    deltaDf: number[];
    /** p-values. */
    p: number[];
}
/**
 * Likelihood-ratio tests between nested {@link loglm} fits and of the last against the saturated model. Equivalent
 * to `MASS::anova.loglm()` in R.
 * @example
 * ```ts
 * const t = { counts: [10, 20, 30, 40, 12, 18, 25, 35], dim: [2, 2, 2], names: ["A", "B", "C"] };
 * loglmAnova(loglm("~ A + B + C", t), loglm("~ A*B + C", t)).p; // [NaN, 0.46019, 0.90787]
 * ```
 * @category Regression
 */
export declare function loglmAnova(...fits: LoglmResult[]): LoglmAnovaResult;
