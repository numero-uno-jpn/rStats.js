/**
 * The between-study variance estimators of meta (`method.tau`).
 *
 * @category Meta-analysis
 */
export type MetaTauMethod = "REML" | "DL" | "PM" | "ML" | "SJ" | "HE" | "EB" | "HS";
/**
 * Options shared by the meta functions.
 *
 * @category Meta-analysis
 */
export interface MetaCommonOptions {
    /** The between-study variance estimator (default "REML"). */
    methodTau?: MetaTauMethod;
    /** "classic" (normal, default) or "HK" (Hartung-Knapp, t on k - 1). */
    methodRandomCi?: "classic" | "HK";
    /** The tau2 interval: "QP" (Q-profile), "J" (Jackson) or "BJ" (Biggerstaff-Jackson); default "J" for DL, else "QP". */
    methodTauCi?: "QP" | "J" | "BJ";
    /** Confidence level of the study intervals (default 0.95). As in meta, it does not change the pooled intervals. */
    level?: number;
    /** Confidence level of the pooled intervals (default 0.95, whatever `level` is: meta's level.ma). */
    levelMa?: number;
    /** Level of the prediction interval (default 0.95, whatever `level` is: meta's level.predict). */
    levelPredict?: number;
}
/**
 * The result of {@link metagen} (R's element names).
 *
 * @category Meta-analysis
 */
export interface MetaResult {
    TE: number[];
    seTE: number[];
    k: number;
    "TE.common": number;
    "seTE.common": number;
    "lower.common": number;
    "upper.common": number;
    "statistic.common": number;
    "pval.common": number;
    "TE.random": number;
    "seTE.random": number;
    "lower.random": number;
    "upper.random": number;
    "statistic.random": number;
    "pval.random": number;
    /** Degrees of freedom of the random interval (k - 1 with Hartung-Knapp, else null). */
    "df.random": number | null;
    "seTE.predict": number;
    "lower.predict": number;
    "upper.predict": number;
    "df.predict": number;
    Q: number;
    "df.Q": number;
    "pval.Q": number;
    tau2: number;
    "lower.tau2": number;
    "upper.tau2": number;
    tau: number;
    "lower.tau": number;
    "upper.tau": number;
    H: number;
    "lower.H": number;
    "upper.H": number;
    I2: number;
    "lower.I2": number;
    "upper.I2": number;
    "w.common": number[];
    "w.random": number[];
    methodTau: MetaTauMethod;
    methodRandomCi: "classic" | "HK";
    methodTauCi: "QP" | "J" | "BJ";
}
/**
 * P(sum_j lambda_j chi2_1 <= q) for lambda_j >= 0: Ruben's (1962) series sum_k c_k P(chi2_{r + 2k} <= q / beta) with
 * beta = 2 lmin lmax / (lmin + lmax), or Imhof's (1961) integral when the series would be long.
 * Not an R function.
 *
 * @category Meta-analysis
 */
export declare function pWeightedChisq(q0: number, lambda0: readonly number[]): number;
/**
 * The generalised Q interval for tau2 (Jackson 2013) with study weights a: Q_a = sum a (y - mu_a)^2 follows
 * sum lambda chi2_1 with lambda the eigenvalues of S^(1/2) (A - a a' / sum a) S^(1/2), S = diag(v + tau2); the bounds
 * solve P(Q_a <= q_obs) = 1 - alpha/2 and alpha/2 (0 when not reached).
 * Not an R function.
 *
 * @category Meta-analysis
 */
export declare function genqInterval(y: readonly number[], v: readonly number[], a: readonly number[], level: number): [number, number];
/**
 * H and I2 with Higgins and Thompson's (2002) intervals (H at least 1, as meta). Not an R function.
 *
 * @category Meta-analysis
 */
export declare function heterogeneityIntervals(Q: number, k: number, level: number): {
    H: number;
    lH: number;
    uH: number;
    I2: number;
    lI2: number;
    uI2: number;
};
/** The pooled estimates and heterogeneity of study estimates TE with standard errors seTE (inverse variance). */
/**
 * Internal: a tau2 and a Q fixed by the caller (metabin's Q about the MH estimate with DL, log 64).
 *
 * @category Meta-analysis
 */
export interface MetaCoreInternal {
    fixedTau2?: number;
    fixedQ?: number;
}
export declare function metaCore(TE: readonly number[], seTE: readonly number[], options?: MetaCommonOptions & MetaCoreInternal): MetaResult;
/**
 * Generic inverse-variance meta-analysis (meta's `metagen()`): study estimates TE with standard errors seTE; the
 * common effect, the random effect with tau2 by `methodTau` (default REML) and a classic or Hartung-Knapp interval,
 * the prediction interval (t on k - 1), Q, tau2's interval (QP, or J for DL), H and I2 with Higgins and Thompson's
 * intervals.
 * Equivalent to `meta::metagen()` in R.
 *
 * @category Meta-analysis
 */
export declare function metagen(TE: readonly number[], seTE: readonly number[], options?: MetaCommonOptions): MetaResult;
