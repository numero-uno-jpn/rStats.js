import type { LmFormulaResult } from "../models/lm.js";
import type { GlmFormulaResult } from "../models/glm.js";
import type { DataFrame } from "../models/modelFrame.js";
/**
 * A model for {@link simSlopes} and {@link johnsonNeyman}: a formula fit of {@link lm} or {@link glm}.
 *
 * @category Causal inference
 */
export type ModerationModel = LmFormulaResult | GlmFormulaResult;
/**
 * Options for {@link johnsonNeyman}.
 *
 * @category Causal inference
 */
export interface JohnsonNeymanOptions {
    /** The predictor whose slope is examined. */
    pred: string;
    /** The moderator. */
    modx: string;
    /** Significance level (default 0.05). */
    alpha?: number;
    /** `"HC3"` for heteroskedasticity-consistent standard errors, `false` (the default) for the model's. */
    robust?: false | "HC3";
}
/**
 * Result of {@link johnsonNeyman}.
 *
 * @category Causal inference
 */
export interface JohnsonNeymanResult {
    /** The two bounds (sorted); `[-Infinity, Infinity]` when the interval could not be found. */
    bounds: [number, number];
    /** Whether the slope is significant inside the bounds (else outside them). */
    inside: boolean;
    /** Whether no real bound exists (interactions' "could not be found"). */
    failed: boolean;
    /** Whether no bound lies within the observed range of the moderator (interactions' `all_sig`; also when failed). */
    allSig: boolean;
    /** The observed range of the moderator. */
    modrange: [number, number];
    /** The significance level. */
    alpha: number;
}
/**
 * Options for {@link simSlopes}.
 *
 * @category Causal inference
 */
export interface SimSlopesOptions {
    /** The predictor whose slope is examined. */
    pred: string;
    /** The moderator. */
    modx: string;
    /** The moderator's values: `"mean-plus-minus"` (the default: mean − SD, mean, mean + SD) or numbers. */
    modxValues?: "mean-plus-minus" | readonly number[];
    /** Also compute the Johnson-Neyman interval (default `true`). */
    johnsonNeyman?: boolean;
    /** The Johnson-Neyman significance level (default 0.05). */
    jnAlpha?: number;
    /** Width of the confidence intervals (default 0.95). */
    ciWidth?: number;
    /** `"HC3"` for heteroskedasticity-consistent standard errors, `false` (the default) for the model's. */
    robust?: false | "HC3";
}
/**
 * Result of {@link simSlopes}: one row per moderator value.
 *
 * @category Causal inference
 */
export interface SimSlopesResult {
    /** The moderator's values. */
    values: number[];
    /** The slopes of the predictor. */
    estimate: number[];
    /** Their standard errors. */
    se: number[];
    /** Lower confidence limits. */
    lower: number[];
    /** Upper confidence limits. */
    upper: number[];
    /** The t (lm) or z (glm) statistics. */
    statistic: number[];
    /** `"t"` or `"z"`. */
    statisticName: "t" | "z";
    /** Two-sided p-values. */
    p: number[];
    /** The Johnson-Neyman interval, when asked for. */
    jn?: JohnsonNeymanResult;
}
/**
 * The Johnson-Neyman interval: the moderator values at which the predictor's slope stops being significant.
 * Equivalent to `interactions::johnson_neyman()` in R. Its bounds, `inside`, `failed` and `all_sig` are returned; there
 * is no plot.
 *
 * The bounds solve (b_X + b_XW w)² = t² Var(b_X + b_XW w), with the t quantile on the model's residual degrees of
 * freedom (for a glm too, as interactions does). The slope is significant inside the bounds when the quadratic's
 * leading coefficient is negative, else outside them.
 *
 * @param fit A formula fit of {@link lm} or {@link glm} with the interaction `pred:modx`.
 * @param data The data it was fitted on (for the moderator's observed range).
 * @param options See {@link JohnsonNeymanOptions}.
 * @returns See {@link JohnsonNeymanResult}.
 * @throws RangeError if the model lacks the coefficients or the moderator is not numeric.
 *
 * @example
 * ```ts
 * const data = {
 *   X: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], C: [1.2, -0.4, 0.3, 0.8, -1.1, 0.5, -0.2, 1.4, -0.7, 0.1],
 *   M: [1.1, 0.4, 0.9, 1.6, 0.2, 1.9, 1.3, 2.6, 1.0, 1.8], Y: [2.0, 1.1, 1.5, 2.4, 0.8, 3.1, 2.2, 3.9, 1.9, 2.8],
 *   W: [3.1, 2.2, 4.0, 2.8, 3.5, 2.9, 3.8, 2.4, 3.3, 4.2],
 * };
 * const fit = lm("Y ~ X * W", data);
 * johnsonNeyman(fit, data, { pred: "X", modx: "W" }).bounds; // [2.4941, 3.4079]
 * ```
 *
 * @category Causal inference
 */
export declare function johnsonNeyman(fit: ModerationModel, data: DataFrame, options: JohnsonNeymanOptions): JohnsonNeymanResult;
/**
 * Simple slopes of a predictor at values of a moderator, with the Johnson-Neyman interval. Equivalent to
 * `interactions::sim_slopes()` in R. The slopes table (as with `confint = TRUE`) and the Johnson-Neyman results are
 * returned.
 *
 * The slope at w is b_X + b_XW w with standard error sqrt(V_XX + 2 w V_XW + w² V_WW), from the model's covariance or
 * its HC3 sandwich; intervals and p-values use t on the residual degrees of freedom for lm and the normal distribution
 * for glm. `"mean-plus-minus"` takes the moderator's mean and mean ± SD on the model's rows.
 *
 * @param fit A formula fit of {@link lm} or {@link glm} (binomial or gaussian) with the interaction `pred:modx`.
 * @param data The data it was fitted on.
 * @param options See {@link SimSlopesOptions}.
 * @returns See {@link SimSlopesResult}.
 * @throws RangeError if the model lacks the coefficients, the moderator is not numeric or the levels are outside (0, 1).
 *
 * @example
 * ```ts
 * const data = {
 *   X: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], C: [1.2, -0.4, 0.3, 0.8, -1.1, 0.5, -0.2, 1.4, -0.7, 0.1],
 *   M: [1.1, 0.4, 0.9, 1.6, 0.2, 1.9, 1.3, 2.6, 1.0, 1.8], Y: [2.0, 1.1, 1.5, 2.4, 0.8, 3.1, 2.2, 3.9, 1.9, 2.8],
 *   W: [3.1, 2.2, 4.0, 2.8, 3.5, 2.9, 3.8, 2.4, 3.3, 4.2],
 * };
 * const s = simSlopes(lm("Y ~ X * W", data), data, { pred: "X", modx: "W" });
 * s.estimate; // [1.6926, 1.2999, 0.90721]
 * s.p; // [0.045753, 0.031345, 0.22941]
 * ```
 *
 * @category Causal inference
 */
export declare function simSlopes(fit: ModerationModel, data: DataFrame, options: SimSlopesOptions): SimSlopesResult;
