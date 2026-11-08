import { type RocDirection, type RocResponseValue, type RocResult } from "./roc.js";
import { type Alternative, type HTest, type Sample } from "./types.js";
/**
 * Options for {@link ciAuc}.
 *
 * @category Hypothesis tests
 */
export interface CiAucOptions {
    /** Confidence level, in [0, 1]. Default `0.95`. */
    confLevel?: number;
    /** `"delong"` (default) or `"bootstrap"`; abbreviations are accepted. */
    method?: "delong" | "bootstrap" | (string & {});
    /** Number of bootstrap replicates. Default `2000`. */
    bootN?: number;
    /** Resample the controls and the cases separately (default `true`), or all observations together. */
    bootStratified?: boolean;
}
/**
 * Result of {@link ciAuc}.
 *
 * @category Hypothesis tests
 */
export interface CiAucResult {
    /** The AUC: DeLong's θ (the mean of the placements), or the curve's AUC for the bootstrap. */
    estimate: number;
    /** The interval `[lower, upper]`. */
    confInt: [number, number];
    /** The confidence level. */
    confLevel: number;
    /** The method, in full. */
    method: "delong" | "bootstrap";
    /** DeLong's variance of the AUC (pROC's `var(roc)`), or the variance of the bootstrap AUCs. */
    variance: number;
    /** R's warnings, each once, in R's order (an empty array when there are none). */
    warnings: string[];
}
/**
 * Confidence interval of the area under a ROC curve, by DeLong's method or the bootstrap. Equivalent to
 * `pROC::ci.auc()` in R.
 *
 * DeLong's interval is θ ∓ z√S (DeLong, DeLong and Clarke-Pearson 1988), clipped to [0, 1]; it needs at least two
 * controls and two cases (pROC: NA). The bootstrap draws R's random stream as pROC does (`setSeed` gives R's values):
 * `bootN` resamples of the controls then the cases (stratified, at least two of each) or of all observations, and
 * the type-7 quantiles α/2 and 1 − α/2 of their AUCs. A non-stratified resample without cases or without controls is
 * dropped with pROC's warning (pROC stops at one without controls).
 *
 * @param curve A curve from {@link roc}.
 * @param options See {@link CiAucOptions}.
 *
 * @example
 * ```ts
 * const r = roc({ controls: [1, 2, 2, 3, 5, 7], cases: [2, 4, 5, 5, 8, 9, 10] });
 * ciAuc(r).confInt; // [0.5272205221855736, 1]
 * ```
 *
 * @category Hypothesis tests
 */
export declare function ciAuc(curve: RocResult, options?: CiAucOptions): CiAucResult;
/**
 * Options for {@link rocTest}.
 *
 * @category Hypothesis tests
 */
export interface RocTestOptions {
    /** `"delong"` (default) or `"bootstrap"`; abbreviations are accepted. */
    method?: "delong" | "bootstrap" | (string & {});
    /** The alternative for the difference AUC₁ − AUC₂. Default `"two.sided"`. */
    alternative?: Alternative | (string & {});
    /**
     * Whether the curves are paired (on the same observations). Default: paired when both come from the same response
     * (as pROC). `true` for curves that are not is an error; `false` for curves that are gives pROC's warning.
     */
    paired?: boolean;
    /** Confidence level of the interval of the paired DeLong test, in [0, 1]. Default `0.95`. */
    confLevel?: number;
    /** Number of bootstrap replicates. Default `2000`. */
    bootN?: number;
    /** Resample the controls and the cases separately (default `true`), or all observations together. */
    bootStratified?: boolean;
    /** With a response and two predictors: the control and case levels (see {@link RocOptions}). */
    levels?: readonly RocResponseValue[];
    /** With a response and two predictors: the direction of both curves (see {@link RocOptions}). */
    direction?: "auto" | RocDirection;
}
/**
 * Result of {@link rocTest}.
 *
 * @category Hypothesis tests
 */
export interface RocTestResult extends HTest {
    /** The AUCs of the two curves. */
    estimate: [number, number];
    /** `"AUC of roc1"` and `"AUC of roc2"`. */
    estimateNames: [string, string];
    /** The first curve compared (when paired, rebuilt on the observations where neither predictor is missing). */
    roc1: RocResult;
    /** The second curve compared (when paired, rebuilt as `roc1`). */
    roc2: RocResult;
    /** For the bootstrap: whether it was stratified. */
    bootStratified?: boolean;
}
/**
 * Tests the difference of the areas under two ROC curves, by DeLong's method or the bootstrap. Equivalent to
 * `pROC::roc.test()` in R.
 *
 * Curves from the same response are paired, as pROC pairs them (identical responses; where a predictor is missing,
 * both curves are rebuilt on the observations where neither is). Paired DeLong: Z = (θ₁ − θ₂)/σ with σ² from the
 * placements' covariances (DeLong, DeLong and Clarke-Pearson 1988), Z = 0 when both are 0, and the interval θ₁ − θ₂ ∓
 * zσ. Unpaired DeLong: D = (θ₁ − θ₂)/√(S₁ + S₂) on pROC's Welch-Satterthwaite degrees of freedom (when both variances
 * are 0, D = 0 with p-value 1 if the AUCs are equal, and the degrees of freedom are NaN). Bootstrap: D = (AUC₁ −
 * AUC₂)/sd of the resampled differences, with R's random stream. DeLong's method needs at least two controls and two
 * cases in each curve, as does the stratified bootstrap. The method is DeLong's unless given (pROC switches to the
 * bootstrap silently for curves of different directions; here DeLong's test gives pROC's warning).
 *
 * @param roc1 The first curve, from {@link roc}.
 * @param roc2 The second curve.
 * @param options See {@link RocTestOptions}.
 *
 * @example
 * ```ts
 * const y = [0, 0, 0, 0, 1, 1, 1, 1];
 * const t = rocTest(roc(y, [1, 2, 3, 5, 4, 6, 7, 8]), roc(y, [2, 1, 5, 4, 3, 7, 6, 8]));
 * t.estimate;   // [0.9375, 0.875]
 * t.statistic;  // 0.7071067811865475
 * ```
 *
 * @category Hypothesis tests
 */
export declare function rocTest(roc1: RocResult, roc2: RocResult, options?: RocTestOptions): RocTestResult;
/**
 * Tests the difference of the areas under the ROC curves of two predictors of the same response (paired);
 * observations with a missing response or predictor are dropped from both.
 *
 * @param response The outcome (see {@link roc}).
 * @param predictor1 The first predictor.
 * @param predictor2 The second predictor.
 * @param options See {@link RocTestOptions}.
 */
export declare function rocTest(response: readonly RocResponseValue[] | Float64Array, predictor1: Sample, predictor2: Sample, options?: RocTestOptions): RocTestResult;
