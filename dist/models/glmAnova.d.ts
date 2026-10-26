import { type GlmResult } from "./glm.js";
/** Tests of {@link glmAnova}. */
export type GlmAnovaTest = "Chisq" | "LRT" | "Rao" | "F" | "Cp";
/** Options for {@link glmAnova}. */
export interface GlmAnovaOptions {
    /**
     * The test: `"Chisq"` (or its synonym `"LRT"`), `"Rao"`, `"F"`, `"Cp"`, or `false` for none. Default, as R since
     * 4.4.0: `"Chisq"` when the dispersion is known (binomial, poisson or `dispersion` given), else `"F"`.
     */
    test?: GlmAnovaTest | false;
    /** Dispersion for the tests instead of the estimate of the largest model. */
    dispersion?: number;
}
/** Result of {@link glmAnova}: R's anova table. */
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
 * Analysis of deviance. Equivalent to R's `anova()` for one `glm` fit (the sequential table, each column of `x`
 * added in order) or for several fits of the same data (`anova(fit1, fit2, ...)`).
 *
 * @param fits One fit, or an array of fits to compare.
 */
export declare function glmAnova(fits: GlmResult | readonly GlmResult[], options?: GlmAnovaOptions): GlmAnovaResult;
