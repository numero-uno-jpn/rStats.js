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
    /**
     * Degrees of freedom: (number of groups with a positive expected count) - 1, or the rank of the variance matrix of
     * those groups (all but the first) when it is singular
     */
    df: number;
    /** Upper chi-squared tail on `df` degrees of freedom (NaN for df = 0: the data carry no information on the groups) */
    pvalue: number;
    /** Alias of `pvalue`: the same value. */
    pValue: number;
    /** R's warnings, each once, in R's order (an empty array when there are none). */
    warnings: string[];
}
/**
 * Confidence interval type of {@link survfit}. The unambiguous prefixes "p", "a", "n", "log-", and "logi" are accepted.
 *
 * @category Survival analysis
 */
export type SurvfitConfType = "log" | "plain" | "log-log" | "logit" | "arcsin" | "none" | "p" | "a" | "n" | "log-" | "logi";
/**
 * Options for {@link survfit}.
 *
 * @category Survival analysis
 */
export interface SurvfitOptions {
    /** Group labels, one per observation: one curve per group. Omitted: a single curve. */
    group?: readonly GroupLabel[];
    /** Start times for counting-process data; `time` contains the stop times. */
    start?: readonly number[];
    /** Subject identifiers for counting-process data; requires `start`; adjacent split rows are not censorings. */
    id?: readonly (GroupLabel | null)[];
    /** Case weights. Non-negative safe-integer counts are required. */
    weights?: readonly number[];
    /** Cumulative hazard estimator: 1 Nelson-Aalen, 2 Fleming-Harrington. Default 1. */
    ctype?: 1 | 2;
    /** Survival estimator: 1 Kaplan-Meier, 2 exponential of cumulative hazard. Default 1. */
    stype?: 1 | 2;
    /** Use the infinitesimal-jackknife variance. Default false; non-integer weights are rejected. */
    robust?: boolean;
    /** Restricted-mean upper limit: "common" (default), "individual", "none", or a finite number. */
    rmean?: "none" | "common" | "individual" | number;
    /** Transformation of the pointwise confidence intervals. Default "log". */
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
    /** Stratum label for every time row. */
    strata: string[];
    /** Distinct observed times, including censoring times. */
    time: number[];
    /** Weighted number at risk just before each time. */
    nRisk: number[];
    /** Weighted number of events at each time. */
    nEvent: number[];
    /** Weighted number censored at each time. */
    nCensor: number[];
    /** Survival estimate: Kaplan-Meier (`stype: 1`) or exp(-cumhaz) (`stype: 2`). */
    surv: number[];
    /** Standard error of the survival estimate (the summary standard error). */
    stdErr: number[];
    /** Alias of `stdErr`. */
    stdError: number[];
    /** Lower and upper pointwise confidence limits. */
    lower: number[];
    upper: number[];
    /** Cumulative hazard and its standard error. */
    cumhaz: number[];
    stdChaz: number[];
    /** Whether the standard error is on the log-survival scale. */
    logse: boolean;
    /** Number of retained records per stratum. */
    n: number[];
    /** Unweighted risk/event/censor counts, present when case weights were supplied. */
    counts?: {
        nRisk: number[];
        nEvent: number[];
        nCensor: number[];
    };
    /** Summary-table record count, maximum risk set, starting risk set and weighted event total. */
    records: number[];
    nMax: number[];
    nStart: number[];
    events: number[];
    /** Restricted mean survival time and its standard error per stratum (NaN when rmean is "none"). */
    rmean: number[];
    seRmean: number[];
    /** Per stratum: median, lower median limit, upper median limit. */
    median: number[][];
    medianRows: string[];
    /** R-style summary table, with column and row names. */
    table: {
        colNames: string[];
        rowNames: string[];
        table: number[][];
    };
    /** Warnings produced by the fit. */
    warnings: string[];
}
/**
 * Test of the difference between survival curves: the G-rho family of Harrington and Fleming, the log-rank test for
 * `rho = 0`. Equivalent to R's `survival::survdiff()`. As `survdiff(Surv(time, status) ~ group, rho = rho)`.
 *
 * Rows with a missing time, status or group are dropped.
 *
 * @param time Follow-up times, or stop times when `options.start` is supplied.
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
 * Kaplan-Meier or exponential cumulative-hazard estimate with pointwise confidence intervals, medians and restricted means.
 * Equivalent to R's `survival::survfit()`. Supports right-censored and counting-process data, Nelson-Aalen and Fleming-Harrington cumulative hazards,
 * integer case weights, infinitesimal-jackknife standard errors and all six confidence transformations.
 *
 * Rows with a missing time, status, group, id or weight are dropped. With `start`, the risk set at t is
 * `start < t <= time`; without `id`, each split row ending without an event is a censoring. With `id`, a row
 * followed by another row for the same subject at the same boundary is not a censoring.
 *
 * @param time Follow-up times, or stop times when `options.start` is supplied.
 * @param status 1 for an event, 0 for a censored time.
 * @param options See {@link SurvfitOptions}.
 * @returns Time-row estimates, pointwise limits, per-stratum medians and restricted-mean summaries.
 *
 * @example
 * ```ts
 * survfit([1, 2, 2, 3, 4], [1, 1, 0, 1, 0]).surv; // [0.8, 0.6, 0.3, 0.3]
 * ```
 *
 * @category Survival analysis
 */
export declare function survfit(time: readonly number[], status: readonly number[], options?: SurvfitOptions): SurvfitResult;
