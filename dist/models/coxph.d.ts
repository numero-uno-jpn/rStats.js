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
    /** Case weights (positive). A weight that is not an integer switches the robust variance on (see `robust`). */
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
    /**
     * Whether to use the robust (Lin-Wei sandwich) variance. Default as R: `true` when `cluster` is given or some case
     * weight is not an integer, else `false`. With `false` a `cluster` is ignored (with R's warning).
     */
    robust?: boolean;
    /**
     * Cluster labels, one per observation, for the robust variance (R's `cluster`): the observations of a cluster are
     * treated as correlated. Rows with a missing label (`null` or NaN) are dropped, like rows with a missing stratum.
     * Without it, each observation is its own cluster. At least two clusters are needed.
     */
    cluster?: readonly (GroupLabel | null)[];
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
    /**
     * Variance matrix of the coefficients (array of rows): the robust variance when `usedRobust` (R's `var`), else the
     * model-based one
     */
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
    /**
     * Model-based (naive) standard errors of the coefficients, also when `usedRobust` (R's column `se(coef)`; the robust
     * ones are `robustSe`)
     */
    se: number[];
    /** Wald z statistics (coefficient / `robustSe` when `usedRobust`, else / `se`) */
    z: number[];
    /** Two-sided p-values `Pr(>|z|)` */
    p: number[];
    /** Alias of `se`: the same array. */
    stdError: number[];
    /** Alias of `z`: the same array. */
    zValue: number[];
    /** Alias of `p`: the same array. */
    pValue: number[];
    /** Lower confidence limits of exp(coef) (from `robustSe` when `usedRobust`) */
    lower: number[];
    /** Upper confidence limits of exp(coef) (from `robustSe` when `usedRobust`) */
    upper: number[];
    /** Likelihood ratio test */
    logtest: CoxphTest;
    /** Score (log-rank) test */
    sctest: CoxphTest;
    /** Wald test (with the robust variance when `usedRobust`) */
    waldtest: CoxphTest;
    /** R^2 (1 - exp(-logtest / n)) and its maximum (1 - exp(2 loglik[0] / n)) */
    rsq: {
        /** R^2, 1 - exp(-logtest / n) (R's `rsq`). */
        rsq: number;
        /** Its maximum, 1 - exp(2 loglik[0] / n) (R's `maxrsq`). */
        maxrsq: number;
    };
    /**
     * Whether the robust variance was used (R's `used.robust`). False also when it was asked for but there is nothing to
     * compute it from (no events, or every coefficient NaN), as R.
     */
    usedRobust: boolean;
    /** The model-based variance (R's `naive.var`); only when `usedRobust`. */
    naiveVar?: number[][];
    /** Robust standard errors, the square roots of the diagonal of `var` (R's `robust se`); only when `usedRobust`. */
    robustSe?: number[];
    /** The robust score test statistic at `init` (R's `rscore`); only when `usedRobust`. */
    rscore?: number;
    /** The robust score test (R's `robscore`: `rscore`, the number of non-NaN coefficients); only when `usedRobust`. */
    robscore?: CoxphTest;
    /** R's warnings, each once, in order of first appearance. */
    warnings: string[];
}
/**
 * Cox proportional hazards regression. Equivalent to R's `survival::coxph()`. As
 * `coxph(Surv(time, status) ~ x [+ strata(strata)], weights, ties, init, robust, cluster, control)` for right-censored
 * data, with the values of `summary(fit)`.
 *
 * With `robust` (by default when `cluster` is given or a case weight is not an integer) the variance is the robust
 * (Lin-Wei sandwich) one, summed over the clusters (each observation its own cluster without `cluster`), as R:
 * `var` is the robust variance and `naiveVar` the model-based one; `se` (and `stdError`) stay the model-based standard
 * errors (R's `se(coef)`), while `z`, `p`, the intervals `lower`/`upper`, `wald` and `waldtest` use the robust ones
 * (`robustSe`); `robscore` is the robust score test at `init`. The likelihood ratio and score tests and the R^2 ignore
 * the clustering.
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
 * @throws TypeError if `robust` is not a boolean. RangeError for invalid arguments, among them an infinite weight
 * and a robust variance with fewer than two clusters.
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
/**
 * The fit of {@link coxph}, and with the robust variance also the residuals it was made from (for the tests; not
 * exported from the package): R's `residuals(fit, type = "score")` (unweighted) and `residuals(fit, type =
 * "dfbeta")` (weighted), one row per observation used, in input order.
 *
 * @internal
 */
export declare function fitCoxph(time: readonly number[], status: readonly number[], x: readonly (readonly number[])[], options?: CoxphOptions): {
    result: CoxphResult;
    scoreResiduals?: number[][];
    dfbeta?: number[][];
};
