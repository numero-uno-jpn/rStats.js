import { type GlmResult } from "./glm.js";
/**
 * Tests of {@link glmAnova}.
 *
 * @category Generalized linear models
 */
export type GlmAnovaTest = "Chisq" | "LRT" | "Rao" | "F" | "Cp";
/**
 * Options for {@link glmAnova}.
 *
 * @category Generalized linear models
 */
export interface GlmAnovaOptions {
    /**
     * The test: `"Chisq"` (or its synonym `"LRT"`), `"Rao"`, `"F"`, `"Cp"`, or `false` for none. Default, as R since
     * 4.4.0: `"Chisq"` when the dispersion is known (binomial, poisson or `dispersion` given), else `"F"`.
     */
    test?: GlmAnovaTest | false;
    /** Dispersion for the tests instead of the estimate of the largest model. */
    dispersion?: number;
}
/**
 * Result of {@link glmAnova}: R's anova table.
 *
 * @category Generalized linear models
 */
export interface GlmAnovaResult {
    /** Column names, such as `"Df"`, `"Deviance"`, `"Resid. Df"`, `"Resid. Dev"`, `"Pr(>Chi)"`. */
    colNames: string[];
    /** Row names: `"NULL"`, `"x1"`, ... for one fit; `"1"`, `"2"`, ... for a comparison. */
    rowNames: string[];
    /** One array per row; NaN where R leaves the cell empty (NA). */
    table: number[][];
    /** R's warnings (from the refits and the F test of binomial or poisson families). */
    warnings: string[];
}
/**
 * Analysis of deviance, for one `glm` fit (the sequential table, each column of `x` added in order) or for several
 * fits of the same data (`anova(fit1, fit2, ...)`). Equivalent to R's `anova()`.
 *
 * @param fits One fit, or an array of fits to compare.
 *
 * @example
 * ```ts
 * const y = [0, 0, 1, 0, 1, 1];
 * const fit0 = glm([[], [], [], [], [], []], y, { family: "binomial" });
 * const fit1 = glm([1, 2, 3, 4, 5, 6], y, { family: "binomial" });
 * const a = glmAnova(fit1);
 * a.colNames; // ["Df", "Deviance", "Resid. Df", "Resid. Dev", "Pr(>Chi)"]
 * a.table[1];  // [1, 3.3618, 4, 4.956, 0.066725]
 * glmAnova([fit0, fit1], { test: "LRT" }).table[1]; // [4, 4.956, 1, 3.3618, 0.066725]
 * ```
 *
 * @category Generalized linear models
 */
export declare function glmAnova(fits: GlmResult | readonly GlmResult[], options?: GlmAnovaOptions): GlmAnovaResult;
