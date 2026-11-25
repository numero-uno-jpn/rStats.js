import { type LmFormulaResult } from "./lm.js";
import { type GlmFormulaResult } from "./glm.js";
import { type DataFrame } from "./modelFrame.js";
/**
 * A formula fit that the stepwise functions take: the result of {@link lm} or {@link glm} with a formula.
 *
 * @category Model selection
 */
export type StepModel = LmFormulaResult | GlmFormulaResult;
/**
 * Options of {@link extractAIC}.
 *
 * @category Model selection
 */
export interface ExtractAicOptions {
    /** The weight of the equivalent degrees of freedom: 2 (default) for AIC, `Math.log(n)` for BIC. */
    k?: number;
    /** lm only: a known residual variance; when positive the criterion is Mallows' Cp. Default 0. glm ignores it. */
    scale?: number;
}
/**
 * Options of {@link drop1} and {@link add1}.
 *
 * @category Model selection
 */
export interface AddDropOptions extends ExtractAicOptions {
    /**
     * The terms to consider, as a one-sided formula such as `"~ x1 + x2 + f"`. drop1: default the terms that can be
     * dropped respecting marginality; add1: required, the largest model (the terms that can be added respecting
     * marginality are taken from it).
     */
    scope?: string;
    /**
     * A test column: `"F"` (lm; glm with an estimated dispersion), `"Chisq"` or `"LRT"` (the likelihood-ratio test of
     * glm; for lm the change of RSS scaled by the residual variance), or `"none"` (default).
     */
    test?: "none" | "F" | "Chisq" | "LRT";
}
/**
 * Result of {@link drop1} and {@link add1}: R's table, one row for the current model (`"<none>"`) and one per term.
 *
 * @category Model selection
 */
export interface AddDropTable {
    /** `"<none>"` and the terms. */
    term: string[];
    /** Degrees of freedom of each term (the change of rank; NaN for `<none>`). */
    df: number[];
    /** lm: the change of the residual sum of squares (R's `Sum of Sq`; NaN for `<none>`). Absent for glm. */
    sumOfSq?: number[];
    /** lm: the residual sum of squares of each model (R's `RSS`); glm: its deviance (R's `Deviance`). */
    deviance: number[];
    /** The criterion of each model (AIC, or Cp with `scale > 0`). */
    aic: number[];
    /** `"AIC"` or `"Cp"`: the name of the criterion's column in R. */
    criterion: "AIC" | "Cp";
    /** The statistic of the test (R's `F value`, `LRT` or `scaled dev.`; NaN for `<none>`), when a test was asked for. */
    statistic?: number[];
    /** The p-values of the test (R's `Pr(>F)` or `Pr(>Chi)`; NaN for `<none>`). */
    pValue?: number[];
    /** The test, when one was asked for: `"F"` or `"Chisq"`. */
    test?: "F" | "Chisq";
    /** R's name of the statistic's column: `"F value"`, `"LRT"` (binomial, poisson) or `"scaled dev."` (the others). */
    statisticName?: string;
    /** R's warnings, each once. */
    warnings: string[];
}
/**
 * Options of {@link step} and {@link stepAIC}.
 *
 * @category Model selection
 */
export interface StepOptions {
    /**
     * The range of models: a one-sided formula for the largest (`"~ x1 + x2 + f"`), or `{ lower, upper }` (either may be
     * left out: lower default no terms, upper default the start model). Without a scope only terms of the start
     * model can be dropped.
     */
    scope?: string | {
        /** The smallest model, a one-sided formula (default no terms): its terms are never dropped. */
        lower?: string;
        /** The largest model, a one-sided formula (default the start model): terms are added from it. */
        upper?: string;
    };
    /** `"both"` (default), `"backward"` or `"forward"`. */
    direction?: "both" | "backward" | "forward";
    /** The weight of the equivalent degrees of freedom: 2 (default) for AIC, `Math.log(n)` for BIC. */
    k?: number;
    /** lm only: a known residual variance; when positive the criterion is Mallows' Cp. Default 0. */
    scale?: number;
    /** The largest number of moves. Default 1000. */
    steps?: number;
}
/**
 * One model of the search: its formula and criterion, and the table of moves that was examined from it (sorted by the
 * criterion, `"<none>"` the current model, `"- term"` a drop, `"+ term"` an add), as R prints them.
 *
 * @category Model selection
 */
export interface StepVisit {
    /** The model's formula. */
    formula: string;
    /** The labels of its terms. */
    termLabels: string[];
    /** Its criterion (R's `extractAIC`). */
    aic: number;
    /** The table examined from it; absent when an aliased term was removed without a table, or the steps ran out. */
    table?: {
        /** `"<none>"`, `"- term"` and `"+ term"`, sorted by the criterion. */
        move: string[];
        /** Degrees of freedom of each move (NaN for `<none>`). */
        df: number[];
        /** lm: the change of the residual sum of squares (NaN for `<none>`). Absent for glm. */
        sumOfSq?: number[];
        /** lm: residual sum of squares; glm: deviance (of the model after the move). */
        deviance: number[];
        /** The criterion after the move. */
        aic: number[];
    };
}
/**
 * Result of {@link step} and {@link stepAIC}.
 *
 * @category Model selection
 */
export interface StepResult<F extends StepModel = StepModel> {
    /** The selected model: the result of `lm` or `glm` with its formula. */
    fit: F;
    /**
     * The path (R's `$anova`): one row for the start (step `""`, df and deviance NaN) and one per move. `df` is the change
     * of the residual degrees of freedom (step: −1 for an added term) or its size (stepAIC: positive); `deviance` the
     * change of the residual deviance (positive); `residDf` = nobs − edf; `aic` the criterion.
     */
    anova: {
        /** `""` for the start, `"- term"` or `"+ term"` for each move. */
        step: string[];
        /** The change of the residual degrees of freedom (step) or its size (stepAIC); NaN for the start. */
        df: number[];
        /** The change of the residual deviance (positive); NaN for the start. */
        deviance: number[];
        /** nobs − edf of each model. */
        residDf: number[];
        /** The residual deviance of each model (lm: the RSS). */
        residDeviance: number[];
        /** The criterion of each model (R's `AIC` or `Cp` column). */
        aic: number[];
    };
    /** `"AIC"` or `"Cp"`: the name of the criterion's column in R. */
    criterion: "AIC" | "Cp";
    /** Each model visited, the start first, with the table examined from it (R's printed trace). */
    visits: StepVisit[];
    /** R's warnings, each once (those of the refits, of add1's combined fit, of a perfect fit). */
    warnings: string[];
}
/**
 * The criterion of a fit for model selection: `[edf, criterion]`. Equivalent to R's `extractAIC()`. lm: n log(RSS / n) + k edf, or with `scale > 0`
 * Mallows' Cp = RSS / scale − n + k edf; glm: AIC + (k − 2) edf. n counts the rows used (weight-0 rows included) and
 * edf = n − the residual degrees of freedom, so that with weight-0 rows edf exceeds the rank by their number, as in R.
 *
 * @param fit A fit of {@link lm} or {@link glm} with a formula.
 *
 * @example
 * ```ts
 * const data = { y: [1.2, 2.3, 2.9, 4.1, 5.2, 5.8], x: [1, 2, 3, 4, 5, 6] };
 * extractAIC(lm("y ~ x", data)); // [2, -19.211]
 * ```
 *
 * @category Model selection
 */
export declare function extractAIC(fit: StepModel, options?: ExtractAicOptions): [number, number];
/**
 * The models with one term dropped, for lm and glm. Equivalent to R's `drop1()`. With the change of the residual sum of squares or
 * the deviance, the criterion of {@link extractAIC} (edf the rank) and optionally a test. As in R, each model is the
 * fit's model matrix without the columns of the term, on the rows of `fit` (not a refit of a formula). By default
 * only the terms not contained in another term of the model are dropped (marginality).
 *
 * @param fit A fit of {@link lm} or {@link glm} with a formula.
 * @param data The data frame the fit was made from.
 *
 * @example
 * ```ts
 * const data = { y: [1.2, 2.3, 2.9, 4.1, 5.2, 5.8, 7.1, 7.9], x: [1, 2, 3, 4, 5, 6, 7, 8], z: [5, 3, 8, 1, 9, 2, 7, 4] };
 * drop1(lm("y ~ x + z", data), data, { test: "F" }).term; // ["<none>", "x", "z"]
 * ```
 *
 * @category Model selection
 */
export declare function drop1(fit: StepModel, data: DataFrame, options?: AddDropOptions): AddDropTable;
/**
 * The models with one term added, for lm and glm. Equivalent to R's `add1()`. With the change of the residual sum of squares or the
 * deviance, the criterion of {@link extractAIC} (edf the rank) and optionally a test. The terms are those of `scope`
 * that can be added respecting marginality. Every model is refitted on the rows complete in the variables of the
 * model and of all the terms; when these are fewer than the fit's rows the current model is refitted on them too,
 * with R's warning "using the m/n rows from a combined fit".
 *
 * @param fit A fit of {@link lm} or {@link glm} with a formula.
 * @param data The data frame the fit was made from.
 *
 * @example
 * ```ts
 * const data = { y: [1.2, 2.3, 2.9, 4.1, 5.2, 5.8, 7.1, 7.9], x: [1, 2, 3, 4, 5, 6, 7, 8], z: [5, 3, 8, 1, 9, 2, 7, 4] };
 * add1(lm("y ~ 1", data), data, { scope: "~ x + z" }).term; // ["<none>", "x", "z"]
 * ```
 *
 * @category Model selection
 */
export declare function add1(fit: StepModel, data: DataFrame, options?: AddDropOptions): AddDropTable;
/**
 * Stepwise selection of the terms of a linear or generalized linear model by AIC. Equivalent to R's `step()`. From the start model,
 * each step examines the models with one term dropped (respecting marginality, keeping the lower scope) and, with an
 * upper scope, one term added, and moves to the one with the smallest criterion of {@link extractAIC} when it is
 * strictly below the current model's; it stops when no move improves it, or after `steps` moves. `k = Math.log(n)`
 * gives BIC. Terms whose columns are all aliased are removed first. The result holds the selected fit, the path
 * (R's `$anova`) and every table examined (R's printed trace).
 *
 * As in R, the models are refitted on their own rows: when a move changes the number of rows used (a variable with
 * missing values dropped or added) the search stops with an error, and the table of adds is computed on the rows
 * complete in all the candidates' variables (with a warning when those are fewer).
 *
 * @param fit The start model: a fit of {@link lm} or {@link glm} with a formula.
 * @param data The data frame the fit was made from.
 *
 * @example
 * ```ts
 * const data = { y: [1.2, 2.3, 2.9, 4.1, 5.2, 5.8, 7.1, 7.9], x: [1, 2, 3, 4, 5, 6, 7, 8], z: [5, 3, 8, 1, 9, 2, 7, 4] };
 * const s = step(lm("y ~ x + z", data), data);
 * s.fit.formula;  // "y ~ x"
 * s.anova.step;   // ["", "- z"]
 * ```
 *
 * @category Model selection
 */
export declare function step<F extends StepModel>(fit: F, data: DataFrame, options?: StepOptions): StepResult<F>;
/**
 * Stepwise selection by AIC. Equivalent to `MASS::stepAIC()` in R. The same search as {@link step}; the only difference R shows is the
 * path's `df`, which stepAIC gives as the size of the term moved (positive) where step gives the change of the
 * residual degrees of freedom.
 *
 * @param fit The start model: a fit of {@link lm} or {@link glm} with a formula.
 * @param data The data frame the fit was made from.
 *
 * @example
 * ```ts
 * const data = { y: [1.2, 2.3, 2.9, 4.1, 5.2, 5.8, 7.1, 7.9], x: [1, 2, 3, 4, 5, 6, 7, 8], z: [5, 3, 8, 1, 9, 2, 7, 4] };
 * stepAIC(lm("y ~ 1", data), data, { scope: "~ x + z" }).anova.df; // [NaN, 1]
 * ```
 *
 * @category Model selection
 */
export declare function stepAIC<F extends StepModel>(fit: F, data: DataFrame, options?: StepOptions): StepResult<F>;
