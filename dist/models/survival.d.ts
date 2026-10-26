import type { GroupLabel } from "../htest/groups.js";
/**
 * Options for {@link survdiff}.
 *
 * @category Survival analysis
 */
export interface SurvdiffOptions {
    /** Exponent of the weights S(t-)^rho (pooled Kaplan-Meier estimate just before each event time). Default 0. */
    rho?: number;
}
/**
 * Result of {@link survdiff}.
 *
 * @category Survival analysis
 */
export interface SurvdiffResult {
    /** Number of observations per group */
    n: number[];
    /** R's names of the groups, `"group=<label>"`, in the order of the sorted labels */
    groups: string[];
    /** Weighted observed number of events per group */
    obs: number[];
    /** Weighted expected number of events per group */
    exp: number[];
    /** Variance matrix of obs - exp (array of rows) */
    var: number[][];
    /** Chi-squared statistic */
    chisq: number;
    /** Upper chi-squared tail on (number of groups with a positive expected count) - 1 degrees of freedom */
    pvalue: number;
}
/**
 * Confidence interval type of {@link survfit}.
 *
 * @category Survival analysis
 */
export type SurvfitConfType = "log" | "plain" | "log-log";
/**
 * Options for {@link survfit}.
 *
 * @category Survival analysis
 */
export interface SurvfitOptions {
    /** Group labels, one per observation: one curve per group. Omitted: a single curve. */
    group?: readonly GroupLabel[];
    /** Transformation of the pointwise confidence intervals. Default `"log"`. */
    confType?: SurvfitConfType;
    /** Confidence level. Default 0.95. */
    confInt?: number;
}
/**
 * Result of {@link survfit}: the rows of R's `summary(fit, censored = TRUE)` and the medians.
 *
 * @category Survival analysis
 */
export interface SurvfitResult {
    /** Stratum of each row (`"group=<label>"`, or `"all"` for a single curve) */
    strata: string[];
    /** Time of each row (the distinct times of the stratum, censored ones included) */
    time: number[];
    /** Number at risk just before the time (R's `n.risk`) */
    nRisk: number[];
    /** Number of events at the time (R's `n.event`) */
    nEvent: number[];
    /** Number censored at the time (R's `n.censor`) */
    nCensor: number[];
    /** Kaplan-Meier estimate S(t) */
    surv: number[];
    /** Standard error of S(t) (S times the standard error of log S) */
    stdErr: number[];
    /** Lower limit of the pointwise confidence interval of S(t) */
    lower: number[];
    /** Upper limit of the pointwise confidence interval of S(t) */
    upper: number[];
    /** Per stratum, [median, lower limit, upper limit] (NaN for R's NA) */
    median: number[][];
    /** The strata of `median` */
    medianRows: string[];
}
/**
 * Test of the difference between survival curves: the G-rho family of Harrington and Fleming, the log-rank test for
 * `rho = 0`. Equivalent to R's `survival::survdiff()`. As `survdiff(Surv(time, status) ~ group, rho = rho)`.
 *
 * Rows with a missing time, status or group are dropped.
 *
 * @param time Follow-up times.
 * @param status 1 for an event, 0 for a censored time.
 * @param group Group labels, one per observation.
 * @param options See {@link SurvdiffOptions}.
 *
 * @example
 * ```ts
 * const r = survdiff([1, 2, 3, 4, 5, 6], [1, 1, 0, 1, 1, 1], ["a", "b", "a", "b", "a", "b"]);
 * r.chisq;  // 0.073903
 * r.pvalue; // 0.78574
 * ```
 *
 * @category Survival analysis
 */
export declare function survdiff(time: readonly number[], status: readonly number[], group: readonly (GroupLabel | null)[], options?: SurvdiffOptions): SurvdiffResult;
/**
 * Kaplan-Meier estimate of the survival function with Greenwood's standard error and pointwise confidence intervals.
 * Equivalent to R's `survival::survfit()`. As `summary(survfit(Surv(time, status) ~ group, conf.type, conf.int),
 * censored = TRUE)`, with the medians and their confidence limits of `summary(fit)$table`.
 *
 * Rows with a missing time, status or group are dropped.
 *
 * @param time Follow-up times.
 * @param status 1 for an event, 0 for a censored time.
 * @param options See {@link SurvfitOptions}.
 *
 * @example
 * ```ts
 * survfit([1, 2, 2, 3, 4], [1, 1, 0, 1, 0]).surv; // [0.8, 0.6, 0.3, 0.3]
 * ```
 *
 * @category Survival analysis
 */
export declare function survfit(time: readonly number[], status: readonly number[], options?: SurvfitOptions): SurvfitResult;
