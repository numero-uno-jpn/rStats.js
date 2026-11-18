import { type GroupLabel } from "../htest/groups.js";
/** A cumulative-incidence curve, represented by its step-function corners.
 * @category Survival analysis
 */
export interface CumincCurve {
    name: string;
    group: string;
    cause: string;
    time: number[];
    est: number[];
    var: number[];
}
/** One cause's Gray test across the groups.
 * @category Survival analysis
 */
export interface CumincTest {
    cause: string;
    stat: number;
    df: number;
    pValue: number;
}
/** Options for {@link cuminc}.
 * @category Survival analysis
 */
export interface CumincOptions {
    /** Group labels, one per observation. Omitted: one group. */
    group?: readonly (GroupLabel | null)[];
    /** Stratification labels for Gray's test; curves remain group-specific. */
    strata?: readonly (GroupLabel | null)[];
    /** Power of the Gray test's weight, G(t-)^rho. Default 0. */
    rho?: number;
    /** Censoring code. Default 0. */
    cencode?: GroupLabel;
}
/** Result of {@link cuminc}.
 * @category Survival analysis
 */
export interface CumincResult {
    curves: CumincCurve[];
    tests?: CumincTest[];
    warnings: string[];
}
/** Result of {@link timepoints}.
 * @category Survival analysis
 */
export interface TimepointsResult {
    curveNames: string[];
    times: number[];
    est: number[][];
    var: number[][];
}
/**
 * Cumulative incidence functions and Gray's tests for competing risks. Equivalent to `cmprsk::cuminc()` in R.
 * Uses the Aalen-Johansen cumulative-incidence estimator and Gray's weighted test; tied-time
 * variance applies the target-cause and competing-cause finite-sample corrections.
 *
 * @param time Follow-up times (finite and non-negative).
 * @param status Event codes; every code other than `cencode` is a competing event cause.
 * @param options See {@link CumincOptions}.
 * @returns One step-function curve for each group and cause, optional Gray tests, and warnings.
 *
 * @example
 * ```ts
 * const fit = cuminc([1, 2, 3, 4], [1, 0, 2, 1]);
 * fit.curves[0]!.est;
 * ```
 *
 * @category Survival analysis
 */
export declare function cuminc(time: readonly number[], status: readonly GroupLabel[], options?: CumincOptions): CumincResult;
/**
 * Evaluate cumulative-incidence curves at requested times. Equivalent to `cmprsk::timepoints()` in R.
 * At a requested time the last corner at or before it is used; values before zero or after a
 * group's final follow-up are NaN.
 *
 * @param fit Result of {@link cuminc}.
 * @param times Evaluation times.
 * @returns Matrices with one row per curve and one column per sorted unique requested time.
 *
 * @example
 * ```ts
 * const fit = cuminc([1, 2, 3], [1, 0, 1]);
 * timepoints(fit, [1, 2]).est;
 * ```
 *
 * @category Survival analysis
 */
export declare function timepoints(fit: CumincResult, times: readonly number[]): TimepointsResult;
/** Time-dependent covariate transformation for {@link crr}.
 * @category Survival analysis
 */
export type CrrTimeFunction = (times: readonly number[]) => readonly (readonly number[])[];
/** Options for {@link crr}.
 * @category Survival analysis
 */
export interface CrrOptions {
    /** Time-dependent covariate matrix, one row per observation. */
    cov2?: readonly (readonly number[])[];
    /** Transform the unique failure times to a matrix with one row per time. Required with cov2. */
    tf?: CrrTimeFunction;
    /** Cause whose subdistribution hazard is modelled. Default 1. */
    failcode?: GroupLabel;
    /** Censoring code. Default 0. */
    cencode?: GroupLabel;
    /** Convergence tolerance. Default 1e-6. */
    gtol?: number;
    /** Maximum Newton iterations. Default 10. */
    maxiter?: number;
    /** Initial coefficient vector. Default all zero. */
    init?: readonly number[];
    /** Whether to compute the sandwich variance and residuals. Default true. */
    variance?: boolean;
    /** Confidence level for exponentiated coefficient intervals. Default 0.95. */
    confLevel?: number;
    /** Coefficient names, in the order of cov1 then cov2 interactions. */
    names?: readonly string[];
}
/** Fine-Gray regression fit.
 * @category Survival analysis
 */
export interface CrrResult {
    coefficients: number[];
    names: string[];
    var: number[][];
    se?: number[];
    z?: number[];
    pValue?: number[];
    lower?: number[];
    upper?: number[];
    expCoef?: number[];
    loglik: number;
    loglikNull: number;
    logtest: {
        statistic: number;
        df: number;
    };
    score: number[];
    inf: number[][];
    invinf: number[][];
    converged: boolean;
    iterations: number;
    n: number;
    nMissing: number;
    uftime: number[];
    bfitj: number[];
    res: number[][] | null;
    tfs: number[][];
    warnings: string[];
    /** Number of baseline and time-varying covariates. */
    covariateDimensions: [number, number];
}
/**
 * Fine-Gray proportional subdistribution hazards regression. Equivalent to `cmprsk::crr()` in R.
 * The censoring distribution is estimated by the verified {@link survfit}; Newton-Raphson
 * solves the weighted estimating equations and the variance is the subject-level sandwich.
 *
 * @param time Follow-up times (finite; negative values are allowed).
 * @param status Event codes.
 * @param cov1 Baseline covariate matrix (rows are observations); pass undefined when using only cov2.
 * @param options See {@link CrrOptions}.
 * @returns Coefficients, information, sandwich variance, baseline subdistribution hazard and diagnostics.
 *
 * @example
 * ```ts
 * const fit = crr([1, 2, 3, 4, 5, 6], [1, 0, 1, 2, 0, 1], [[0], [1], [2], [1], [0], [2]]);
 * fit.coefficients;
 * ```
 *
 * @category Survival analysis
 */
export declare function crr(time: readonly number[], status: readonly GroupLabel[], cov1: readonly (readonly number[])[] | undefined, options?: CrrOptions): CrrResult;
/**
 * Predict cumulative incidence from a Fine-Gray fit. Equivalent to `cmprsk::predict.crr()` in R.
 *
 * @param fit Result of {@link crr}.
 * @param cov1 New baseline covariate matrix.
 * @param cov2 New time-varying covariate matrix, when the fit used cov2.
 * @returns A matrix whose first column is failure time and remaining columns are predicted incidences.
 *
 * @example
 * ```ts
 * const fit = crr([1, 2, 3, 4, 5, 6], [1, 0, 1, 2, 0, 1], [[0], [1], [2], [1], [0], [2]]);
 * predictCrr(fit, [[0], [1]]);
 * ```
 *
 * @category Survival analysis
 */
export declare function predictCrr(fit: CrrResult, cov1: readonly (readonly number[])[] | undefined, cov2?: readonly (readonly number[])[]): number[][];
