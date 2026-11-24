import type { CoxphResult } from "./coxph.js";
/** Transform names and custom functions accepted by coxZph.
 * @category Survival analysis
 */
export type CoxZphTransform = "km" | "rank" | "identity" | "log" | ((times: readonly number[]) => readonly number[]);
/** Term grouping accepted by coxZph; use `collapseTerms: false` to retain individual columns within groups.
 * @category Survival analysis
 */
export type CoxZphTerms = readonly (readonly number[])[] | false;
/**
 * Options for Schoenfeld-residual tests of proportional hazards.
 *
 * @category Survival analysis
 */
export interface CoxZphOptions {
    /** Transform of the merged stop times. Default `"km"`; a function receives all used rows in input order. */
    transform?: CoxZphTransform;
    /** Zero-based column groups defining formula terms; false makes each column its own term. A multi-column group is collapsed by default. */
    terms?: CoxZphTerms;
    /** Keep grouped columns separate in y, var and the test table. Default true. */
    collapseTerms?: boolean;
    /** Include the global test row. Default true. */
    global?: boolean;
}
/**
 * Result of the proportional-hazards test.
 *
 * @category Survival analysis
 */
export interface CoxZphResult {
    /** Names of the tested terms, with GLOBAL last when requested. */
    rowNames: string[];
    /** Chi-squared statistics, with GLOBAL last when requested. */
    chisq: number[];
    /** Degrees of freedom. */
    df: number[];
    /** Upper chi-squared probabilities. */
    p: number[];
    /** Alias of p. */
    pValue: number[];
    /** Transformed times at the event rows. */
    x: number[];
    /** Event times in the fit's merged time scale. */
    time: number[];
    /** Stratum labels at event rows, only when the fit had strata. */
    strata?: string[];
    /** Scaled Schoenfeld residuals, one row per event. */
    y: number[][];
    /** Variance matrix for y. */
    var: number[][];
    /** Transform used. */
    transform: CoxZphTransform;
    /** Warnings of the fit and this call. */
    warnings: string[];
}
/**
 * Tests the proportional-hazards assumption using the score test of Grambsch and Therneau (1994).
 * Equivalent to R's `survival::cox.zph()`. The fit retains its processed rows privately, so no refit is performed; robust and clustered
 * variances of the fit are not used.
 *
 * @param fit A result returned by `coxph`.
 * @param options See {@link CoxZphOptions}.
 * @throws Error for no events, fewer than two distinct event times, a constant transform, or singular information.
 *
 * @category Survival analysis
 */
export declare function coxZph(fit: CoxphResult, options?: CoxZphOptions): CoxZphResult;
