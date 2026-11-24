import { type DataFrame } from "../models/modelFrame.js";
import type { Sample } from "./types.js";
/**
 * Direction of a ROC curve: `"<"` when the cases have the higher values (an observation is classified as a case
 * when its value is at least the threshold), `">"` when they have the lower values.
 *
 * @category Hypothesis tests
 */
export type RocDirection = "<" | ">";
/**
 * A value of a response of {@link roc}: a number, a string or a boolean; `null` (or `NaN`) is a missing value.
 *
 * @category Hypothesis tests
 */
export type RocResponseValue = number | string | boolean | null;
/**
 * Options for {@link roc}.
 *
 * @category Hypothesis tests
 */
export interface RocOptions {
    /**
     * The control and the case level of the response, in this order (numbers, strings or booleans, compared as R
     * compares them as strings). Default: the first two of the response's sorted levels (numbers in numerical order,
     * strings by code point, `false` before `true`). Not with the `{ controls, cases }` form.
     */
    levels?: readonly RocResponseValue[];
    /**
     * `"auto"` (default): `"<"` when the median of the controls is at most the median of the cases, else `">"`
     * (pROC's rule: the AUC can then be below 0.5). `"<"`: the cases have the higher values; `">"`: the lower values.
     */
    direction?: "auto" | RocDirection;
    /** Drop the observations with a missing response or predictor (default `true`); `false` makes them an error. */
    naRm?: boolean;
}
/**
 * The two samples of {@link roc}'s `{ controls, cases }` form.
 *
 * @category Hypothesis tests
 */
export interface RocSamples {
    /** The predictor values of the controls (`NaN` for a missing value). */
    controls: Sample;
    /** The predictor values of the cases (`NaN` for a missing value). */
    cases: Sample;
}
/**
 * A ROC curve: the result of {@link roc}, as pROC's `roc` object.
 *
 * @category Hypothesis tests
 */
export interface RocResult {
    /**
     * The thresholds, from `-Infinity` up to `Infinity` for direction `"<"` and down from `Infinity` for `">"`: the
     * midpoints between consecutive distinct values of the predictor.
     */
    thresholds: number[];
    /** The sensitivity at each threshold (from 1 down to 0). */
    sensitivities: number[];
    /** The specificity at each threshold (from 0 up to 1). */
    specificities: number[];
    /** The area under the curve. */
    auc: number;
    /** The direction used (the one chosen by `"auto"`, or the one given). */
    direction: RocDirection;
    /** The control and the case level, as strings (`["0", "1"]` for the `{ controls, cases }` form). */
    levels: [string, string];
    /** The predictor values of the controls, in input order (missing values removed). */
    controls: number[];
    /** The predictor values of the cases, in input order (missing values removed). */
    cases: number[];
    /** R's warnings, each once, in R's order (an empty array when there are none). */
    warnings: string[];
}
/** What a curve keeps of its data besides its fields: the observations, for pairing and the bootstrap */
export interface RocData {
    /** The response as labels (null for a missing one), before any removal; null for the controls/cases form */
    labels: (string | null)[] | null;
    /** The predictor before any removal */
    predictor: number[];
    /** The values of the observations used, in input order (c(controls, cases) for the controls/cases form) */
    values: number[];
    /** Whether each of `values` is a case */
    isCase: boolean[];
    /** The indices of `values` in the original data (response form) */
    kept: number[];
}
/** The data a curve was built from (undefined for an object not made by roc, such as a copy) */
export declare function rocData(r: RocResult): RocData | undefined;
/** The AUC of two samples in a direction: U/(mn) from integer counts, rounded once */
export declare function aucOf(controls: readonly number[], cases: readonly number[], direction: RocDirection): number;
/** Twice the Mann-Whitney U of two samples in a direction (an integer; the AUC is this over 2mn) */
export declare function twiceUOf(controls: readonly number[], cases: readonly number[], direction: RocDirection): number;
/**
 * The rational num/den rounded once to the nearest double (den nonzero): the quotient to at least 55 bits, with a
 * sticky bit for a remainder, converted by Number (which rounds to nearest, ties to even). A quotient in the
 * subnormal range is rounded twice
 */
export declare function ratioToDouble(num: bigint, den: bigint): number;
/** Builds the curve from the classes (checked, without missing values), and records its data */
export declare function buildRoc(controls: number[], cases: number[], direction: "auto" | RocDirection, levels: [string, string], data: RocData, warnings: string[]): RocResult;
/**
 * The curve of a response and a predictor: observations with a missing response or predictor dropped (or an
 * error), the levels, and the classes
 */
export declare function rocFromResponse(response: readonly RocResponseValue[], predictor: readonly number[], options: {
    levels?: readonly RocResponseValue[] | undefined;
    direction?: string | undefined;
    naRm?: boolean | undefined;
}): RocResult;
/**
 * The ROC curve of a numeric predictor of a binary response. Equivalent to `pROC::roc()` in R.
 *
 * The first level of the response is the control, the second the case (with more than two levels the first two are
 * used, with pROC's warning). The thresholds are the midpoints between consecutive distinct values, with `-Infinity`
 * and `Infinity` at the ends, and the points are stored as pROC stores them, by increasing specificity. The AUC is
 * computed from the counts as U/(mn) and rounded once. Infinite predictor values are an error (pROC returns NaN with
 * a warning), as are an empty class and, with `naRm: false`, missing values (pROC returns NA).
 *
 * @param response The outcome: numbers, strings or booleans (`null` or `NaN` for a missing value).
 * @param predictor The predictor, numeric, of the same length (`NaN` for a missing value).
 * @param options See {@link RocOptions}.
 *
 * @example
 * ```ts
 * const r = roc([0, 0, 0, 1, 1, 1], [1, 2, 4, 3, 5, 6]);
 * r.auc;        // 0.8888888888888888
 * r.thresholds; // [-Infinity, 1.5, 2.5, 3.5, 4.5, 5.5, Infinity]
 * ```
 *
 * @category Hypothesis tests
 */
export declare function roc(response: readonly RocResponseValue[] | Float64Array, predictor: Sample, options?: RocOptions): RocResult;
/**
 * The ROC curve from a formula `response ~ predictor` and a data frame; the rows where either is missing are dropped.
 *
 * @param formula `"response ~ predictor"`.
 * @param data The data frame: an object of columns (`null` or `NaN` for a missing value).
 * @param options See {@link RocOptions}.
 */
export declare function roc(formula: string, data: DataFrame, options?: RocOptions): RocResult;
/**
 * The ROC curve from the predictor values of the controls and of the cases (pROC's `roc(controls =, cases =)`).
 *
 * @param samples The two samples.
 * @param options See {@link RocOptions} (without `levels`).
 */
export declare function roc(samples: RocSamples, options?: RocOptions): RocResult;
/**
 * Options for {@link auc}.
 *
 * @category Hypothesis tests
 */
export interface AucOptions {
    /** The limits `[a, b]` (in either order, within [0, 1]) of the specificity or sensitivity: the partial AUC. */
    partialAuc?: readonly number[];
    /** Which axis the limits are on: `"specificity"` (default) or `"sensitivity"`; abbreviations are accepted. */
    focus?: "specificity" | "sensitivity" | (string & {});
    /**
     * Standardise the partial AUC as McClish (1989), so that 0.5 is the diagonal and 1 the perfect curve. Default
     * `false`.
     */
    correct?: boolean;
}
/**
 * Result of {@link auc}.
 *
 * @category Hypothesis tests
 */
export interface AucResult {
    /** The area (the full AUC, or the partial one, standardised with `correct`). */
    auc: number;
    /** The limits `[high, low]` of the partial area (pROC's order), or `null` for the full AUC. */
    partialAuc: [number, number] | null;
    /** The axis of the limits. */
    focus: "specificity" | "sensitivity";
    /** Whether the partial AUC is standardised. */
    correct: boolean;
    /** R's warnings, each once, in R's order (an empty array when there are none). */
    warnings: string[];
}
/**
 * The area under a ROC curve, or the partial area between two specificities or sensitivities. Equivalent to
 * `pROC::auc()` in R.
 *
 * The partial area sums the trapezoids of the points within the limits and interpolates the curve linearly at the
 * limits. With `correct`, it is standardised as McClish (1989): (1 + (A − min)/(max − min))/2, with min the area under
 * the diagonal and max that of the perfect curve between the limits, computed exactly from the counts of the points and
 * rounded once (a curve on the diagonal gives 0.5); below the diagonal that is undefined, an error (pROC: NA with a
 * warning). Limits outside [0, 1] are an error (pROC: NA).
 *
 * @param curve A curve from {@link roc}.
 * @param options See {@link AucOptions}.
 *
 * @example
 * ```ts
 * const r = roc({ controls: [1, 2, 2, 3, 5, 7], cases: [2, 4, 5, 5, 8, 9, 10] });
 * auc(r).auc;                                        // 0.7857142857142857
 * auc(r, { partialAuc: [1, 0.8] }).auc;              // 0.08666666666666666
 * auc(r, { partialAuc: [1, 0.8], correct: true }).auc; // 0.6851851851851852
 * ```
 *
 * @category Hypothesis tests
 */
export declare function auc(curve: RocResult, options?: AucOptions): AucResult;
/**
 * Options for {@link coords}.
 *
 * @category Hypothesis tests
 */
export interface CoordsOptions {
    /**
     * The criterion of `"best"`: `"youden"` (default; the maximum of se + r·sp) or `"closest.topleft"` (the minimum of
     * (1 − se)² + r(1 − sp)²; `"topleft"` is the same); abbreviations are accepted.
     */
    bestMethod?: "youden" | "closest.topleft" | "topleft" | (string & {});
    /**
     * `[cost, prevalence]`: the weight r = (1 − prevalence)/(cost · prevalence) of the specificity in the criteria.
     * The cost must be positive and the prevalence in (0, 1). Default `[1, 0.5]` (r = 1).
     */
    bestWeights?: readonly number[];
}
/**
 * Result of {@link coords}: one array per column, one value per point (pROC's data frame with `ret = "all"`).
 *
 * @category Hypothesis tests
 */
export interface CoordsResult {
    /** The threshold of each point. */
    threshold: number[];
    /** Sensitivity tp/(tp + fn). */
    sensitivity: number[];
    /** Specificity tn/(tn + fp). */
    specificity: number[];
    /** Accuracy (tp + tn)/(number of observations). */
    accuracy: number[];
    /** True negatives. */
    tn: number[];
    /** True positives. */
    tp: number[];
    /** False negatives. */
    fn: number[];
    /** False positives. */
    fp: number[];
    /** Negative predictive value tn/(tn + fn) (`NaN` when no observation is negative). */
    npv: number[];
    /** Positive predictive value tp/(tp + fp) (`NaN` when no observation is positive). */
    ppv: number[];
    /** False positive rate fp/(fp + tn). */
    fpr: number[];
    /** Positive likelihood ratio se/(1 − sp). */
    lrPos: number[];
    /** Negative likelihood ratio (1 − se)/sp. */
    lrNeg: number[];
    /** pROC's Youden criterion se + r·sp (not se + sp − 1). */
    youden: number[];
    /** The squared distance to the top left corner (1 − se)² + r(1 − sp)². */
    closestTopleft: number[];
    /** R's warnings, each once, in R's order (an empty array when there are none). */
    warnings: string[];
}
/**
 * Coordinates of a ROC curve: sensitivity, specificity, the counts, predictive values, likelihood ratios and the
 * criteria of the best threshold, at every point of the curve, at the best threshold(s) or at given thresholds.
 * Equivalent to `pROC::coords(roc, x, ret = "all")` in R.
 *
 * Every column is computed from the integer counts of each threshold and rounded once (pROC rebuilds the counts from
 * the proportions, so that they are not always integers, and loses digits in 1 − specificity). The rows of `"best"`
 * are all the points whose criterion equals the best one exactly (pROC compares rounded sums and can lose ties). At a
 * given threshold, an observation equal to it counts as positive.
 *
 * @param curve A curve from {@link roc}.
 * @param x `"all"` (default: every point of the curve), `"best"`, or thresholds (a number or an array).
 * @param options See {@link CoordsOptions}.
 *
 * @example
 * ```ts
 * const r = roc({ controls: [1, 2, 2, 3, 5, 7], cases: [2, 4, 5, 5, 8, 9, 10] });
 * const best = coords(r, "best");
 * best.threshold;   // [3.5]
 * best.sensitivity; // [0.8571428571428571]
 * coords(r, [4, 6]).tp; // [6, 3]
 * ```
 *
 * @category Hypothesis tests
 */
export declare function coords(curve: RocResult, x?: "all" | "best" | (string & {}) | number | readonly number[], options?: CoordsOptions): CoordsResult;
