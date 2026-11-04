import type { GroupLabel } from "../htest/groups.js";
/**
 * Control of the Newton-Raphson iterations of {@link coxph} (R's `coxph.control`).
 *
 * @category Survival analysis
 */
export interface CoxphControl {
    /** Convergence tolerance on the relative change of the log partial likelihood. Default 1e-9. */
    eps?: number;
    /** Maximum number of iterations. Default 20. */
    iterMax?: number;
    /** Tolerance of the pivots of the Cholesky factorisation. Default 2^-39 (eps^0.75 for the machine eps 2^-52). */
    tolerChol?: number;
    /** Tolerance of the check for infinite coefficients. Default sqrt(`eps`). */
    tolerInf?: number;
}
/**
 * Options for {@link coxph}.
 *
 * @category Survival analysis
 */
export interface CoxphOptions {
    /** Handling of tied event times. Default `"efron"`. */
    ties?: "efron" | "breslow";
    /** Case weights (positive integers; other weights make R use a robust variance, which is not supported yet). */
    weights?: readonly number[];
    /** Stratum labels, one per observation: a separate baseline hazard per stratum. */
    strata?: readonly (GroupLabel | null)[];
    /** Starting coefficients. Default 0. */
    init?: readonly number[];
    /** See {@link CoxphControl}. */
    control?: CoxphControl;
    /** Covariates whose values all lie in this set are neither centred nor scaled. Default `[-1, 0, 1]`. */
    nocenter?: readonly number[];
    /** Confidence level of the intervals of exp(coef). Default 0.95. */
    confLevel?: number;
}
/**
 * A test statistic with its degrees of freedom and upper chi-squared tail.
 *
 * @category Survival analysis
 */
export interface CoxphTest {
    /** The chi-squared statistic (R's `test`). */
    statistic: number;
    /** Degrees of freedom (R's `df`). */
    df: number;
    /** Upper chi-squared tail (R's `pvalue`). */
    pValue: number;
}
/**
 * Result of {@link coxph}.
 *
 * @category Survival analysis
 */
export interface CoxphResult {
    /** Coefficients (NaN for R's NA: an aliased column or one whose information fell below the tolerance) */
    coefficients: number[];
    /** Variance matrix of the coefficients (array of rows) */
    var: number[][];
    /** Log partial likelihood at the starting values and at the end */
    loglik: [number, number];
    /** The score test statistic at the starting values */
    score: number;
    /** The Wald statistic of the non-NA coefficients (against `init` when given) */
    wald: number;
    /** Number of iterations (`iterMax + 1` when they ran out) */
    iter: number;
    /** The means used to centre the covariates (0 for the columns not centred) */
    means: number[];
    /** Number of observations used */
    n: number;
    /** Number of events */
    nevent: number;
    /** Linear predictors (centred by the means), one per observation used, in input order */
    linearPredictors: number[];
    /** Standard errors of the coefficients */
    se: number[];
    /** Wald z statistics */
    z: number[];
    /** Two-sided p-values `Pr(>|z|)` */
    p: number[];
    /** Lower confidence limits of exp(coef) */
    lower: number[];
    /** Upper confidence limits of exp(coef) */
    upper: number[];
    /** Likelihood ratio test */
    logtest: CoxphTest;
    /** Score (log-rank) test */
    sctest: CoxphTest;
    /** Wald test */
    waldtest: CoxphTest;
    /** R^2 (1 - exp(-logtest / n)) and its maximum (1 - exp(2 loglik[0] / n)) */
    rsq: {
        /** R^2, 1 - exp(-logtest / n) (R's `rsq`). */
        rsq: number;
        /** Its maximum, 1 - exp(2 loglik[0] / n) (R's `maxrsq`). */
        maxrsq: number;
    };
    /** R's warnings, each once, in order of first appearance. */
    warnings: string[];
}
/**
 * Cox proportional hazards regression. Equivalent to R's `survival::coxph()`. As
 * `coxph(Surv(time, status) ~ x [+ strata(strata)], weights, ties, init, control)` for right-censored data, with the
 * values of `summary(fit)`.
 *
 * Rows with a missing time, status, covariate, weight or stratum are dropped. Times within sqrt(eps) of each other are
 * treated as tied. Covariates whose values all lie in `nocenter` are not centred; the others are centred by their
 * weighted means, which only shifts the linear predictors. R's warnings (non-convergence, possibly infinite
 * coefficients) are returned in `warnings`.
 *
 * @param time Follow-up times.
 * @param status 1 for an event, 0 for a censored time.
 * @param x The covariate matrix, one row per observation (at least one column).
 * @param options See {@link CoxphOptions}.
 *
 * @example
 * ```ts
 * const fit = coxph([5, 3, 8, 1, 9, 4], [1, 1, 0, 1, 0, 1], [[1.2], [0.3], [-0.5], [2], [0.7], [0.1]]);
 * fit.coefficients;   // [1.0324]
 * fit.logtest.pValue; // 0.18817
 * ```
 *
 * @category Survival analysis
 */
export declare function coxph(time: readonly number[], status: readonly number[], x: readonly (readonly number[])[], options?: CoxphOptions): CoxphResult;
