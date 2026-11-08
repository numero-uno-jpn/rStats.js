import { type GlmerResult } from "./glmer.js";
import { type LmerResult } from "./lmer.js";
import type { DataFrame } from "./modelFrame.js";
/**
 * Options of {@link lmerPredict}. Only the keys below are accepted: R's `re.form`, `allow.new.levels`, `random.only`,
 * `se.fit`, `newparams`, `terms`, `na.action` and `naAction` give the Error `lmerPredict: argument '<key>' is not
 * supported`, any other key a RangeError.
 *
 * @category Mixed models
 */
export interface LmerPredictOptions {
    /**
     * The rows to predict: a data frame with the columns of the fit's data that the prediction uses (the variables of
     * the fixed-effects part and of the selected random-effects terms; not the response). Default: the rows of the fit.
     */
    newdata?: DataFrame;
    /**
     * Which random-effects terms to include (R's `re.form`): `undefined` or `null` all of them (default); `false`,
     * `"~0"` or `"~ 0"` none (the population-level prediction); a one-sided formula such as `"~ (1 | g)"` those written
     * in it (its fixed part is ignored). Its grouping factors must be the fit's and its columns among the fit's columns
     * for that factor; a term may have fewer columns than the fit's.
     */
    reForm?: string | false | null;
    /**
     * Whether a level of a grouping factor not in the fit, or a missing grouping value, is allowed (default `false`, an
     * error): that term then adds 0 for the row (the population level for that term). R's `allow.new.levels`.
     */
    allowNewLevels?: boolean;
    /** Whether to predict the random part only, without the fixed effects and the offset (default `false`; R's `random.only`). */
    randomOnly?: boolean;
    /** `"link"` (default) or `"response"`: for lmer both give the same values, as in R. */
    type?: "link" | "response";
    /** Whether to return the standard errors (default `false`; R's `se.fit`). */
    seFit?: boolean;
}
/**
 * Options of {@link glmerPredict}: those of {@link LmerPredictOptions} and `newoffset`. Only these keys are accepted:
 * R's `re.form`, `allow.new.levels`, `random.only`, `se.fit`, `newparams`, `terms`, `na.action` and `naAction` give
 * the Error `glmerPredict: argument '<key>' is not supported`, any other key a RangeError.
 *
 * @category Mixed models
 */
export interface GlmerPredictOptions extends LmerPredictOptions {
    /**
     * The offset of the rows of `newdata` (one number per row; default all 0) when the fit's offset was given as an
     * array (or not at all); an offset given to glmer as a column name is read from that column of `newdata` instead,
     * and `newoffset` is then a RangeError, as it is without `newdata`.
     */
    newoffset?: readonly number[] | Float64Array;
}
/**
 * Result of {@link glmerPredict} and {@link lmerPredict}.
 *
 * @category Mixed models
 */
export interface MixedPrediction {
    /** The predictions, one per row (of `newdata`, or of the fit), on the scale of `type`. */
    fit: number[];
    /** Their standard errors (only with `seFit: true`; R's `se.fit`). */
    seFit?: number[];
    /** R's warnings (only when there are some: glmer's warning about the standard errors). */
    warnings?: string[];
}
/**
 * Predictions of a linear mixed model fitted by {@link lmer}, at the rows of the fit or at new data, with all, some
 * or none of the random-effects terms, optionally with their standard errors. Equivalent to `lme4::predict()` in R.
 *
 * The prediction of a row is x'β̂ + Σ z'b̂ over the selected terms, x built from the row as the fit built its
 * fixed-effects matrix (its terms, contrasts, factor levels and dropped columns) and b̂ the conditional mode of the
 * row's level. A missing value in a variable gives NaN for its row; a factor level of the fixed part that the fit did
 * not have is the RangeError `factor <name> has new level <value>` (R: `non-conformable arguments`). The standard
 * errors are those of the conditional covariance σ² A K⁻¹ A' of (b, β) at θ̂ (Henderson's equations), computed
 * correctly also where lme4's are wrong (crossed grouping factors, some `reForm` subsets).
 *
 * @param fit The object returned by {@link lmer} (not a copy of it).
 * @param options `newdata`, `reForm`, `allowNewLevels`, `randomOnly`, `type` and `seFit` (see {@link LmerPredictOptions}).
 *
 * @example
 * ```ts
 * const data = {
 *   y: [9.8, 10.4, 10.1, 12.3, 12.9, 12.0, 8.1, 7.6, 8.4],
 *   g: ["a", "a", "a", "b", "b", "b", "c", "c", "c"],
 * };
 * const fit = lmer("y ~ 1 + (1 | g)", data);
 * lmerPredict(fit, { newdata: { g: ["a", "c"] } }).fit; // [10.101, 8.0565]
 * lmerPredict(fit, { reForm: false }).fit[0];          // 10.178
 * ```
 *
 * @category Mixed models
 */
export declare function lmerPredict(fit: LmerResult, options?: LmerPredictOptions): MixedPrediction;
/**
 * Predictions of a generalized linear mixed model fitted by {@link glmer}, at the rows of the fit or at new data, with
 * all, some or none of the random-effects terms, on the link or the response scale, optionally with their standard
 * errors. Equivalent to `lme4::predict()` in R.
 *
 * The rules are those of {@link lmerPredict}, with the offset: without `newdata` the fit's; with it, an offset given
 * to glmer as a column name is read from that column of `newdata`, one given as an array is replaced by `newoffset`
 * (default 0: R ignores glmer's `offset` argument in prediction). `type: "response"` applies R's inverse link (at the
 * fit's rows with all terms, the fitted means). The standard errors use the Fisher weights at the conditional mode,
 * with R's warning that they are an approximation; on the response scale they are multiplied by |dμ/dη|.
 *
 * @param fit The object returned by {@link glmer} (not a copy of it).
 * @param options `newdata`, `reForm`, `allowNewLevels`, `randomOnly`, `type`, `seFit` and `newoffset` (see
 *   {@link GlmerPredictOptions}).
 *
 * @example
 * ```ts
 * const data = {
 *   y: [2, 3, 6, 7, 8, 1, 0, 3, 2, 5, 4, 6, 9, 8, 13, 0, 2, 1, 4, 3],
 *   x: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
 *   g: ["a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "c", "c", "c", "c", "c", "d", "d", "d", "d", "d"],
 * };
 * const fit = glmer("y ~ x + (1 | g)", data, { family: "poisson" });
 * glmerPredict(fit, { newdata: { x: [6], g: ["c"] }, type: "response" }).fit; // [17.970]
 * glmerPredict(fit, { newdata: { x: [6], g: ["c"] }, reForm: false }).fit;    // [2.1967]
 * ```
 *
 * @category Mixed models
 */
export declare function glmerPredict(fit: GlmerResult, options?: GlmerPredictOptions): MixedPrediction;
