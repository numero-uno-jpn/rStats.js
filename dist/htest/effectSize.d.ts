import { type AnovaTable, type AovStrataSummary } from "../models/anovaSequential.js";
import type { AovEzResult } from "../models/aovEz.js";
import type { AovStrataFit } from "../models/aovStrata.js";
import type { LmFormulaResult } from "../models/lm.js";
import type { Alternative, Sample } from "./types.js";
/**
 * Options for {@link cohensD} and {@link hedgesG}.
 *
 * @category Effect sizes and power
 */
export interface CohensDOptions {
    /** Two samples: standardize by the pooled standard deviation (default `true`) or by `sqrt((s1² + s2²)/2)`. */
    pooledSd?: boolean;
    /** The difference (or mean) under the null hypothesis. Default `0`. */
    mu?: number;
    /** Paired samples: the effect size of the differences `x - y`. Default `false`. */
    paired?: boolean;
    /** Confidence level of the interval, or `null` for no interval. Default `0.95`. */
    ci?: number | null;
    /** `"two.sided"` (default), `"less"` or `"greater"`: a one-sided interval is open on the other side. */
    alternative?: Alternative | (string & {});
    /** {@link cohensD} only: apply Hedges' small-sample correction (the result is Hedges' g). Default `false`. */
    adjust?: boolean;
}
/**
 * Result of {@link cohensD} and {@link hedgesG}.
 *
 * @category Effect sizes and power
 */
export interface CohensDResult {
    /** `"Cohens_d"` or `"Hedges_g"`. */
    name: "Cohens_d" | "Hedges_g";
    /** The effect size. */
    value: number;
    /** Confidence level (absent without an interval). */
    ci?: number;
    /** Lower confidence limit (R's `CI_low`; `-Infinity` for `"less"`). */
    ciLow?: number;
    /** Upper confidence limit (R's `CI_high`; `Infinity` for `"greater"`). */
    ciHigh?: number;
    /** effectsize's warnings. */
    warnings: string[];
}
/**
 * Cohen's d: the standardized difference of means of two samples (pooled or averaged standard deviation), of paired
 * samples, or of one sample against `mu`, with a confidence interval from the noncentral t distribution.
 * Equivalent to `effectsize::cohens_d()` in R.
 *
 * @example
 * ```ts
 * cohensD([5.1, 4.9, 6.2, 5.8], [4.1, 4.5, 3.9, 5.0]).value; // 2.049693834034246
 * ```
 *
 * @category Effect sizes and power
 */
export declare function cohensD(x: Sample, y?: Sample, options?: CohensDOptions): CohensDResult;
/**
 * Hedges' g: Cohen's d and its interval multiplied by the small-sample correction J(df). Equivalent to
 * `effectsize::hedges_g()` in R.
 *
 * @example
 * ```ts
 * hedgesG([5.1, 4.9, 6.2, 5.8], [4.1, 4.5, 3.9, 5.0]).value; // 1.7804187661174387
 * ```
 *
 * @category Effect sizes and power
 */
export declare function hedgesG(x: Sample, y?: Sample, options?: Omit<CohensDOptions, "adjust">): CohensDResult;
/**
 * Options for {@link etaSquared}, {@link omegaSquared} and {@link epsilonSquared}.
 *
 * @category Effect sizes and power
 */
export interface AnovaEffectSizeOptions {
    /**
     * Partial effect sizes (default `true`). A table with a single term always gives the non-partial one (not so for
     * models with error strata).
     */
    partial?: boolean;
    /** Confidence level of the interval, or `null` for no interval. Default `0.95`. */
    ci?: number | null;
    /** `"greater"` (default: the interval is [lower, 1]), `"two.sided"` or `"less"` ([0, upper]). */
    alternative?: Alternative | (string & {});
}
/**
 * Options for {@link etaSquared}.
 *
 * @category Effect sizes and power
 */
export interface EtaSquaredOptions extends AnovaEffectSizeOptions {
    /**
     * Generalized eta squared: `true` (all factors manipulated) or the names of the observed factors. Default
     * `false`.
     */
    generalized?: boolean | readonly string[];
}
/**
 * Result of the ANOVA effect sizes: one row per term.
 *
 * @category Effect sizes and power
 */
export interface AnovaEffectSizeTable {
    /** effectsize's columns: the effect size (`"Eta2_partial"`, `"Omega2"`, ...), then `"CI"`, `"CI_low"`, `"CI_high"`. */
    colNames: string[];
    /** The terms. */
    rowNames: string[];
    /** One array per term. */
    table: number[][];
    /** For aov with `Error()`: the error stratum of each row (`"id"`, `"id:W"`, `"Within"`). */
    groups?: string[];
    /** effectsize's warnings. */
    warnings: string[];
}
/**
 * A model of the ANOVA effect sizes: a table of `anova()` or `Anova()`, a fit from `lm()` or `aov()` (also with
 * `Error()`), the `aovSummary()` of an `aov()` fit with `Error()`, or a result of `aovEz()`.
 *
 * @category Effect sizes and power
 */
export type AnovaEffectSizeModel = AnovaTable | LmFormulaResult | AovStrataFit | AovStrataSummary | AovEzResult;
/**
 * Eta squared of the terms of an analysis-of-variance table (partial by default, or generalized), with confidence
 * intervals from the noncentral F distribution. Equivalent to `effectsize::eta_squared()` in R. It takes a table of
 * `anova()` or `Anova()`; a fit from `lm()` with a formula is replaced by its `anova()` table.
 *
 * Repeated measures: for a fit of `aov()` with an `Error()` term (or its {@link aovSummary}) each term is measured
 * against the residual of its error stratum, the totals add up all strata, and the result has the stratum of each
 * row in `groups`; for a result of {@link aovEz}, the same from car's univariate tests (rows as afex's table).
 *
 * @example
 * ```ts
 * const data = { y: [2.1, 3.9, 6.2, 7.8, 10.1, 11.8], g: ["a", "a", "b", "b", "c", "c"] };
 * etaSquared(anova(lm("y ~ g", data))).colNames; // ["Eta2", "CI", "CI_low", "CI_high"]
 * const long = {
 *   y: [5, 7, 8, 4, 6, 9, 6, 8, 8, 5, 5, 7],
 *   W: ["a", "b", "c", "a", "b", "c", "a", "b", "c", "a", "b", "c"],
 *   id: ["s1", "s1", "s1", "s2", "s2", "s2", "s3", "s3", "s3", "s4", "s4", "s4"],
 * };
 * etaSquared(aov("y ~ W + Error(id/W)", long)).groups; // ["id:W"]
 * ```
 *
 * @category Effect sizes and power
 */
export declare function etaSquared(model: AnovaEffectSizeModel, options?: EtaSquaredOptions): AnovaEffectSizeTable;
/**
 * Omega squared of the terms of an analysis-of-variance table, also of repeated-measures designs (see
 * {@link etaSquared}). Equivalent to `effectsize::omega_squared()` in R.
 *
 * @example
 * ```ts
 * const data = { y: [2.1, 3.9, 6.2, 7.8, 10.1, 11.8], g: ["a", "a", "b", "b", "c", "c"] };
 * omegaSquared(anova(lm("y ~ g", data))).table; // [[0.8740518865645682, 0.95, 0.0566677410780818, 1]]
 * ```
 *
 * @category Effect sizes and power
 */
export declare function omegaSquared(model: AnovaEffectSizeModel, options?: AnovaEffectSizeOptions): AnovaEffectSizeTable;
/**
 * Epsilon squared of the terms of an analysis-of-variance table, also of repeated-measures designs (see
 * {@link etaSquared}). Equivalent to `effectsize::epsilon_squared()` in R.
 *
 * @example
 * ```ts
 * const data = { y: [2.1, 3.9, 6.2, 7.8, 10.1, 11.8], g: ["a", "a", "b", "b", "c", "c"] };
 * epsilonSquared(anova(lm("y ~ g", data))).table; // [[0.8927928150213428, 0.95, 0.1720126241673212, 1]]
 * ```
 *
 * @category Effect sizes and power
 */
export declare function epsilonSquared(model: AnovaEffectSizeModel, options?: AnovaEffectSizeOptions): AnovaEffectSizeTable;
