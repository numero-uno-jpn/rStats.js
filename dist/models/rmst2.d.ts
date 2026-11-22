/**
 * Options for {@link rmst2}.
 *
 * @category Survival analysis
 */
export interface Rmst2Options {
    /** Restriction time. Defaults to the largest follow-up time allowed by both arms. */
    tau?: number;
    /** Numeric covariates, one row per observation. A vector is treated as one column; rows with missing values are omitted. */
    covariates?: readonly number[] | readonly (readonly number[])[];
    /** Optional names of matrix columns; a vector is named "covariates", an unnamed matrix has empty names. */
    covariateNames?: readonly string[];
    /** Confidence level. Default 0.95. */
    confLevel?: number;
}
/** An estimate, its standard error and a two-sided confidence interval. */
/**
 * An RMST or RMTL estimate with its standard error and confidence interval.
 *
 * @category Survival analysis
 */
export interface RmstEstimate {
    /** Restricted mean or restricted mean time lost. */
    estimate: number;
    /** Greenwood or sandwich standard error. */
    se: number;
    /** Two-sided confidence interval. */
    confInt: [number, number];
}
/** A between-arm difference or ratio with its confidence interval and two-sided p-value. */
/**
 * A between-arm contrast with its confidence interval and p-value.
 *
 * @category Survival analysis
 */
export interface RmstContrast {
    /** Difference (arm 1 minus arm 0) or ratio (arm 1 divided by arm 0). */
    estimate: number;
    /** Two-sided confidence interval. */
    confInt: [number, number];
    /** Two-sided normal-tail p-value. */
    pValue: number;
}
/** Coefficient estimates and robust Wald inference for an adjusted model. */
/**
 * Coefficient estimates and robust Wald inference for an adjusted RMST model.
 *
 * @category Survival analysis
 */
export interface RmstCoefficientTable {
    /** Intercept, treatment indicator and covariate names. */
    names: string[];
    /** Model coefficients (log-scale coefficients for ratio models). */
    estimate: number[];
    se: number[];
    z: number[];
    pValue: number[];
    /** Confidence limits: coefficient scale for the difference model, exponentiated scale for ratio models. */
    confInt: [number[], number[]];
}
/**
 * Result of {@link rmst2}.
 *
 * @category Survival analysis
 */
export interface Rmst2Result {
    /** Restriction time used in the analysis. */
    tau: number;
    /** Whether tau was selected from the follow-up times. */
    tauDefault: boolean;
    /** Confidence level. */
    confLevel: number;
    /** Warnings, each distinct message once. */
    warnings: string[];
    /** Unadjusted per-arm estimates; omitted when covariate adjustment is requested. */
    arm1?: {
        rmst: RmstEstimate;
        rmtl: RmstEstimate;
    };
    arm0?: {
        rmst: RmstEstimate;
        rmtl: RmstEstimate;
    };
    /** Unadjusted between-arm contrasts. */
    difference: RmstContrast;
    ratio: RmstContrast;
    rmtlRatio: RmstContrast;
    /** Covariate-adjusted between-arm contrasts, present when covariates are supplied. */
    adjusted?: {
        difference: RmstContrast;
        ratio: RmstContrast;
        rmtlRatio: RmstContrast;
    };
    /** Coefficient estimates, robust standard errors and Wald tests for the three adjusted models. */
    coefficients?: {
        difference: RmstCoefficientTable;
        ratio: RmstCoefficientTable;
        rmtlRatio: RmstCoefficientTable;
    };
}
/**
 * Restricted mean survival time (RMST), restricted mean time lost (RMTL), and their between-arm contrasts.
 * Implements the unadjusted Kaplan-Meier estimators and Tian, Zhao & Wei's adjusted estimating equations.
 * Equivalent to `survRM2::rmst2()` in R.
 *
 * @param time Follow-up times.
 * @param status Event indicator (1 event, 0 censored; 1/2 coding is also accepted). Invalid values are omitted with a warning.
 * @param arm Treatment indicator (0 or 1; booleans are also accepted).
 * @param options Restriction time, covariates, optional matrix column names and confidence level.
 * @returns Per-arm RMST/RMTL estimates and between-arm contrasts; adjusted contrasts and coefficient tables are added
 * when covariates are supplied.
 *
 * Rows with missing time, status, arm, or covariates are omitted. Negative follow-up times, non-positive tau, tau below
 * the first retained observation, and tau above its default upper bound are errors.
 * @example
 * ```ts
 * const r = rmst2([1,2,3,4,5,6,1.5,2.5,3.5,4.5,7,8],
 *   [1,0,1,1,0,1,1,1,0,1,1,0], [1,1,1,1,1,1,0,0,0,0,0,0]);
 * r.tau; // 8
 * r.arm1?.rmst.estimate; // 4.125
 * r.arm0?.rmst.estimate; // 5
 * r.difference.estimate; // -0.875
 * ```
 * @category Survival analysis
 */
export declare function rmst2(time: readonly number[], status: readonly number[], arm: readonly (number | boolean)[], options?: Rmst2Options): Rmst2Result;
