import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
import type { NoncentralOption } from "../internal/noncentral.js";
/** Log density (0 < x < 1, 0 < a, b < Inf) */
export declare function dbetaLog(x: number, _xc: number, a: number, b: number): number;
export declare function dbeta1(x: number, a: number, b: number, log: boolean): number;
export declare function pbeta1(q: number, a: number, b: number, lowerTail: boolean, logP: boolean): number;
/**
 * Starting value for quantiles (Abramowitz & Stegun 26.5.22). Approximates the x with I_x(a, b) = target if lower,
 * otherwise 1 - I_x(a, b) = target. Used only for a, b > 1; undefined otherwise.
 *   x ≈ a / (a + b e^(2w)),  w = y sqrt(h + λ)/h - (1/(2b-1) - 1/(2a-1)) (λ + 5/6 - 2/(3h)),
 *   h = 2 / (1/(2a-1) + 1/(2b-1)),  λ = (y^2 - 3)/6,  y is the normal point whose upper probability equals I_x
 */
export declare function betaQuantileGuess(a: number, b: number, lower: boolean, logTarget: number): number | undefined;
export declare function qbeta1(p: number, a: number, b: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the beta distribution. Equivalent to R's `dbeta(x, shape1, shape2, ncp = 0, log = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral beta distribution.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape1 - First shape parameter (a).
 * @param shape2 - Second shape parameter (b).
 * @param options - `ncp` (see {@link NoncentralOption}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dbeta(0.5, 2, 3);         // 1.5
 * dbeta([0.25, 0.75], 2, 3); // [1.6875, 0.5625]
 * ```
 *
 * @category Distributions
 */
export declare function dbeta<T extends Vectorizable>(x: T, shape1: number, shape2: number, options?: DensityOptions & NoncentralOption): VectorResult<T>;
/**
 * Distribution function of the beta distribution. Equivalent to R's `pbeta(q, shape1, shape2, ncp = 0, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral beta distribution.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape1 - First shape parameter (a).
 * @param shape2 - Second shape parameter (b).
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pbeta(0.5, 2, 3); // 0.6875 (up to rounding)
 * ```
 *
 * @category Distributions
 */
export declare function pbeta<T extends Vectorizable>(q: T, shape1: number, shape2: number, options?: TailOptions & NoncentralOption): VectorResult<T>;
/**
 * Quantile function of the beta distribution. Equivalent to R's `qbeta(p, shape1, shape2, ncp = 0, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral beta distribution.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape1 - First shape parameter (a).
 * @param shape2 - Second shape parameter (b).
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qbeta(0.025, 3, 7);          // 0.07485463141969181
 * qbeta([0.025, 0.975], 3, 7); // [0.07485463141969181, 0.6000935737163121]
 * ```
 *
 * @category Distributions
 */
export declare function qbeta<T extends Vectorizable>(p: T, shape1: number, shape2: number, options?: TailOptions & NoncentralOption): VectorResult<T>;
