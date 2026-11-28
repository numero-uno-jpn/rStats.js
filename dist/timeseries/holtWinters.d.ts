/**
 * Options of {@link holtWinters}.
 *
 * @category Time series
 */
export interface HoltWintersOptions {
    frequency?: number;
    /** Given, or estimated when undefined; `false` for beta / gamma leaves that component out. */
    alpha?: number;
    beta?: number | false;
    gamma?: number | false;
    seasonal?: "additive" | "multiplicative";
    startPeriods?: number;
    lStart?: number;
    bStart?: number;
    sStart?: readonly number[];
}
/**
 * Result of {@link holtWinters}.
 *
 * @category Time series
 */
export interface HoltWintersResult {
    alpha: number;
    beta: number | false;
    gamma: number | false;
    /** a, b, s1..sf (R's coefficients). */
    coefficients: number[];
    coefficientNames: string[];
    SSE: number;
    /** One-step fitted values from the first fitted time (R's fitted xhat). */
    fitted: number[];
    /** The time index (0-based) of the first fitted value. */
    start: number;
    seasonal: "additive" | "multiplicative";
    frequency: number;
    x: number[];
}
/**
 * Holt-Winters filtering (stats' `HoltWinters()`): exponential smoothing with optional trend and seasonal components,
 * the start values from decompose() of the first start.periods periods, the parameters minimising the SSE.
 * Equivalent to R's `HoltWinters()`.
 *
 * @category Time series
 */
export declare function holtWinters(x: readonly number[], options?: HoltWintersOptions): HoltWintersResult;
/**
 * Predictions from a {@link holtWinters} fit with intervals (stats' `predict.HoltWinters()`): additive and
 * non-seasonal models var(residuals) (1 + sum_{j<h} psi_j^2), psi_j = alpha (1 + j beta) + gamma (1 - alpha) [j mod f
 * = 0]; multiplicative models var(residuals) sum_{j=0}^{h-1} (psi_j s_h / s_{h-j})^2 with cyclic seasonal indices
 * (R reads the seasonal factors at fixed positions of its coefficient vector instead: R bug 19369; equal for h < f with
 * a trend).
 * Equivalent to R's `predict()`.
 *
 * @category Time series
 */
export declare function predictHoltWinters(fit: HoltWintersResult, options?: {
    nAhead?: number;
    predictionInterval?: boolean;
    level?: number;
}): {
    fit: number[];
    upr?: number[];
    lwr?: number[];
};
