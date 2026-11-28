import { type CoxphOptions, type CoxphResult } from "./coxph.js";
/**
 * Options for {@link survfitCoxph}: those of {@link coxph} for the fit (right-censored data without strata), and of the
 * curves.
 *
 * @category Survival analysis
 */
export interface SurvfitCoxphOptions extends Omit<CoxphOptions, "start" | "id" | "strata" | "cluster"> {
    /** Covariate profiles (rows of the columns of `x`), one curve each. Default: one curve at the means of the fit. */
    newdata?: readonly (readonly number[])[];
    /** Transformation of the pointwise confidence intervals: `"log"` (default), `"log-log"`, `"plain"` or `"none"`. */
    confType?: "log" | "log-log" | "plain" | "none";
    /** Confidence level of the curves. Default 0.95. */
    confInt?: number;
    /** Times at which to read the curves, as R's `summary(fit, times)`. */
    times?: readonly number[];
}
/**
 * Result of {@link survfitCoxph}: the rows of R's `survfit(fit, newdata)` (one column of `surv` per profile).
 *
 * @category Survival analysis
 */
export interface SurvfitCoxphResult {
    /** The Cox fit. */
    fit: CoxphResult;
    /** Distinct observed times, events and censorings. */
    time: number[];
    /** Weighted number at risk just before each time. */
    nRisk: number[];
    /** Weighted number of events at each time. */
    nEvent: number[];
    /** Weighted number censored at each time. */
    nCensor: number[];
    /** Survival per curve and time: `surv[curve][row]` (exp(−cumhaz), R's for a Cox fit). */
    surv: number[][];
    /** Standard error of the cumulative hazard (of −log S), per curve and time (with the fit's variance of the
     * coefficients: the robust one when the fit uses it). */
    stdErr: number[][];
    /** Lower pointwise limits, per curve and time. */
    lower: number[][];
    /** Upper pointwise limits, per curve and time. */
    upper: number[][];
    /** Cumulative hazard, per curve and time. */
    cumhaz: number[][];
    /** Per curve: the median and its lower and upper limits (NaN when not reached), as R's `summary()$table`. */
    median: number[][];
    /** Number of records. */
    records: number;
    /** The weighted number at the start (R's n.max and n.start). */
    nStart: number;
    /** The weighted number of events. */
    events: number;
    /** With `times`: the curves read at those times (R's `summary(fit, times)`). */
    at?: SurvfitCoxphAt;
    /** R's warnings, each once. */
    warnings: string[];
}
/**
 * The curves of {@link survfitCoxph} read at given times (R's `summary(fit, times)`).
 *
 * @category Survival analysis
 */
export interface SurvfitCoxphAt {
    /** The times (those not after the last observed time). */
    time: number[];
    /** Survival per curve and time. */
    surv: number[][];
    /** Standard error of the cumulative hazard per curve and time. */
    stdErr: number[][];
    /** Lower pointwise limits per curve and time. */
    lower: number[][];
    /** Upper pointwise limits per curve and time. */
    upper: number[][];
    /** Weighted number at risk at each time. */
    nRisk: number[];
    /** Weighted number of events since the previous time. */
    nEvent: number[];
}
/**
 * Predicted survival curves of a Cox model for covariate profiles (adjusted survival curves). Equivalent to R's
 * `survival::survfit.coxph()`. The call followed is
 * `survfit(coxph(Surv(time, status) ~ ..., weights, robust = TRUE), newdata)`.
 *
 * The baseline cumulative hazard is Breslow's (with `ties: "breslow"`) or its Efron form for tied events (the default
 * `"efron"`), with case weights; the curve of a profile z is exp(−exp((z − means) b) Λ0(t)). The standard error is
 * that of the cumulative hazard (Tsiatis), with the fit's variance of the coefficients (the robust one when the fit
 * uses it, as R; with non-integer weights coxph uses it by default). Strata and counting-process data are not supported.
 * @category Survival analysis
 * @example
 * ```ts
 * const s = survfitCoxph([5, 3, 8, 1, 9, 4], [1, 1, 0, 1, 0, 1], [[0], [1], [0], [1], [0], [1]], { newdata: [[0], [1]] });
 * s.surv[1]; // [0.7165313106444244, 0.43459820864631604, 0.15987974627276413, 0, 0, 0] (the profile x = 1)
 * ```
 */
export declare function survfitCoxph(time: readonly number[], status: readonly number[], x: readonly (readonly number[])[], options?: SurvfitCoxphOptions): SurvfitCoxphResult;
