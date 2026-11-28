import { type RmaResult } from "../models/metaAnalysis.js";
import { type MetaCommonOptions, type MetaResult } from "./metagen.js";
/**
 * The result of {@link metaSubgroup}.
 *
 * @category Meta-analysis
 */
export interface MetaSubgroupResult {
    levels: string[];
    "TE.common.w": number[];
    "seTE.common.w": number[];
    "TE.random.w": number[];
    "seTE.random.w": number[];
    "tau2.w": number[];
    "Q.w": number[];
    "k.w": number[];
    "Q.w.common": number;
    /** With `tauCommon`: equal to Q.w.common (as meta); otherwise absent. */
    "Q.w.random"?: number;
    "Q.b.common": number;
    "Q.b.random": number;
    "df.Q.b": number;
    "df.Q.w": number;
    "pval.Q.b.common": number;
    "pval.Q.b.random": number;
    /** The overall tau2 and random effect (of `overall`). */
    tau2: number;
    "TE.random": number;
    "seTE.random": number;
}
/**
 * Subgroup analysis (meta's `subgroup` argument): `refit(rows)` fits the same meta-analysis to the given study rows
 * (for example `(r) => metabin(pick(e1, r), ...)`). Within each subgroup the common and random effects; Q.b = Q of the
 * subgroup estimates with weights 1/se^2 (common and random), Q.w = the within-subgroup Q. With `tauCommon`, one tau2
 * for all subgroups: that of the meta-regression on the subgroup (rma with the subgroup as a factor); the overall
 * estimates stay those of `overall`.
 * Not an R function. R: the `subgroup` argument of meta's functions.
 *
 * @category Meta-analysis
 */
export declare function metaSubgroup(overall: MetaResult, subgroup: readonly (string | number)[], refit: (rows: number[]) => MetaResult, options?: MetaCommonOptions & {
    tauCommon?: boolean;
}): MetaSubgroupResult;
/**
 * A test for funnel plot asymmetry from {@link metabias}.
 *
 * @category Meta-analysis
 */
export interface MetabiasResult {
    statistic: number;
    df: number | null;
    pValue: number;
    estimate: [number, number];
    method: string;
}
/**
 * Tests for funnel plot asymmetry (meta's `metabias()`): "Egger" (default for continuous outcomes: the intercept of
 * TE/seTE on 1/seTE, t on k - 2), "Begg" (Kendall's S of the standardised deviations against the variances, no
 * continuity correction), "Thompson" (Thompson-Sharp: the REML meta-regression on seTE, its z with t(k - 2) p),
 * "Harbord" (binary: lm(Z/sqrt(V) ~ sqrt(V)) with Z = O - E and V the hypergeometric variance) and "Peters" (binary:
 * lm(TE ~ 1/N) with weights 1/(1/(a + c) + 1/(b + d))). Harbord and Peters need the 2 x 2 counts (`counts`).
 * Equivalent to `meta::metabias()` in R.
 *
 * @category Meta-analysis
 */
export declare function metabias(m: MetaResult, options?: {
    method?: "Egger" | "Begg" | "Thompson" | "Harbord" | "Peters";
    counts?: {
        e1: readonly number[];
        n1: readonly number[];
        e2: readonly number[];
        n2: readonly number[];
    };
}): MetabiasResult;
/**
 * Meta-regression (meta's `metareg()`): rma(TE, seTE^2, mods, method = the meta-analysis's tau2 method) on the studies
 * with finite values. `mods` has one row per study (all studies, as given to the meta function).
 * Equivalent to `meta::metareg()` in R.
 *
 * @category Meta-analysis
 */
export declare function metareg(m: MetaResult, mods: readonly (readonly number[])[]): RmaResult;
/**
 * Leave-one-out or cumulative estimates of {@link metainf} / {@link metacum}.
 *
 * @category Meta-analysis
 */
export interface MetaInfluenceResult {
    TE: number[];
    seTE: number[];
    lower: number[];
    upper: number[];
    pval: number[];
    tau2: number[];
    I2: number[];
}
/**
 * Leave-one-out meta-analysis (meta's `metainf()`): the pooled estimate without each study in turn; `pooled` "common"
 * (default) or "random".
 * Equivalent to `meta::metainf()` in R.
 *
 * @category Meta-analysis
 */
export declare function metainf(m: MetaResult, options?: MetaCommonOptions & {
    pooled?: "common" | "random";
}): MetaInfluenceResult;
/**
 * Cumulative meta-analysis (meta's `metacum()`): the pooled estimate of the first 1, 2, ... studies; `pooled` "common"
 * (default) or "random".
 * Equivalent to `meta::metacum()` in R.
 *
 * @category Meta-analysis
 */
export declare function metacum(m: MetaResult, options?: MetaCommonOptions & {
    pooled?: "common" | "random";
}): MetaInfluenceResult;
/**
 * The coordinates of Baujat's plot (meta's `baujat()`): x = each study's contribution to Q, w (TE - TE.common)^2;
 * y = its influence on the common estimate, (TE.common - TE.common without it)^2 / seTE.common without it^2.
 * Equivalent to `meta::baujat()` in R.
 *
 * @category Meta-analysis
 */
export declare function baujat(m: MetaResult): {
    x: number[];
    y: number[];
};
/**
 * The result of {@link trimfill}.
 *
 * @category Meta-analysis
 */
export interface TrimfillResult {
    k0: number;
    side: "left" | "right";
    TE: number[];
    seTE: number[];
    filled: boolean[];
    meta: MetaResult;
}
/**
 * Duval and Tweedie's trim-and-fill (meta's `trimfill()`): the L0 estimator on the common-effect model, iterated
 * (trim the k0 most extreme studies on one side, re-estimate, re-rank), the side opposite to the asymmetry (the sign of
 * the Egger-type regression of TE on seTE); the k0 mirrored studies 2 theta - TE added, then the meta-analysis of the
 * augmented data (random effect with the given tau2 method, default REML).
 * Equivalent to `meta::trimfill()` in R.
 *
 * @category Meta-analysis
 */
export declare function trimfill(m: MetaResult, options?: MetaCommonOptions & {
    side?: "left" | "right";
    maxiter?: number;
}): TrimfillResult;
