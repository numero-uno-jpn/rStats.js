import { type MetaCommonOptions, type MetaResult } from "./metagen.js";
/**
 * Meta-analysis of continuous outcomes (meta's `metacont()`): sm "MD" (default), "SMD" (Hedges' g with the exact J;
 * variance 1/n1 + 1/n2 + (1 - (N - 4) / ((N - 2) J^2)) g^2, log 69) or "ROM" (log ratio of means).
 * Equivalent to `meta::metacont()` in R.
 *
 * @category Meta-analysis
 */
export declare function metacont(n1: readonly number[], m1: readonly number[], sd1: readonly number[], n2: readonly number[], m2: readonly number[], sd2: readonly number[], options?: MetaCommonOptions & {
    sm?: "MD" | "SMD" | "ROM";
}): MetaResult;
/**
 * Meta-analysis of incidence rates (meta's `metainc()`): events e1 / e2 in person-times t1 / t2; sm "IRR" (default) or
 * "IRD"; method "MH" (default; Greenland and Robins 1985, no increments) or "Inverse". Studies with a zero get 0.5 added
 * to the events for the study values (log 67).
 * Equivalent to `meta::metainc()` in R.
 *
 * @category Meta-analysis
 */
export declare function metainc(e1: readonly number[], t1: readonly number[], e2: readonly number[], t2: readonly number[], options?: MetaCommonOptions & {
    sm?: "IRR" | "IRD";
    method?: "MH" | "Inverse";
    incr?: number;
}): MetaResult;
/**
 * Meta-analysis of correlations (meta's `metacor()`): sm "ZCOR" (Fisher's z, variance 1/(n - 3), default) or "COR"
 * (variance (1 - r^2)^2 / (n - 1)).
 * Equivalent to `meta::metacor()` in R.
 *
 * @category Meta-analysis
 */
export declare function metacor(cor: readonly number[], n: readonly number[], options?: MetaCommonOptions & {
    sm?: "ZCOR" | "COR";
}): MetaResult;
/**
 * Meta-analysis of single means (meta's `metamean()`): sm "MRAW" (default; variance sd^2/n) or "MLN" (log mean,
 * variance sd^2 / (n mean^2)).
 * Equivalent to `meta::metamean()` in R.
 *
 * @category Meta-analysis
 */
export declare function metamean(n: readonly number[], mean: readonly number[], sd: readonly number[], options?: MetaCommonOptions & {
    sm?: "MRAW" | "MLN";
}): MetaResult;
/**
 * Meta-analysis of single incidence rates (meta's `metarate()`): sm "IRLN" (log rate, default), "IR", "IRS" (square
 * root) or "IRFT" (Freeman-Tukey); 0.5 added to zero counts for IR and IRLN.
 * Equivalent to `meta::metarate()` in R.
 *
 * @category Meta-analysis
 */
export declare function metarate(event: readonly number[], time: readonly number[], options?: MetaCommonOptions & {
    sm?: "IRLN" | "IR" | "IRS" | "IRFT";
    incr?: number;
}): MetaResult;
/**
 * Meta-analysis of single proportions by the inverse variance (meta's `metaprop(method = "Inverse")`): sm "PLOGIT"
 * (default; (x + 0.5)/(n + 1) for 0 or n events), "PFT" (Freeman-Tukey), "PAS" (arcsine), "PRAW" or "PLN"
 * (log((x + 0.5)/(n + 0.5)) for 0; for n events the variance 1/x - 1/(n + 0.5)). The default method of meta, the GLMM, is {@link metapropGlmm}.
 * Equivalent to `meta::metaprop()` in R.
 *
 * @category Meta-analysis
 */
export declare function metaprop(event: readonly number[], n: readonly number[], options?: MetaCommonOptions & {
    sm?: "PLOGIT" | "PFT" | "PAS" | "PRAW" | "PLN";
    incr?: number;
}): MetaResult;
/**
 * The result of {@link metapropGlmm}: as {@link MetaResult}, with Q, df.Q and pval.Q as [Wald, LRT].
 *
 * @category Meta-analysis
 */
export type MetapropGlmmResult = Omit<MetaResult, "Q" | "df.Q" | "pval.Q"> & {
    Q: [number, number];
    "df.Q": [number, number];
    "pval.Q": [number, number];
};
/**
 * Meta-analysis of single proportions by a random intercept logistic model (meta's `metaprop()` default, method
 * "GLMM"; log 75-76): glmer(x/n ~ 1 + (1 | study), binomial, weights n, nAGQ = 7) for the random effect and tau2,
 * glm(x/n ~ 1) for the common effect; Q = [Wald, LRT]: the Wald test of equal study effects in glm(x/n ~ study) and the
 * common glm's deviance; H and I2 from the Wald Q. Study values are the PLOGIT ones.
 * Equivalent to `meta::metaprop()` in R.
 *
 * @category Meta-analysis
 */
export declare function metapropGlmm(event: readonly number[], n: readonly number[], options?: Omit<MetaCommonOptions, "methodTau" | "methodTauCi">): MetapropGlmmResult;
