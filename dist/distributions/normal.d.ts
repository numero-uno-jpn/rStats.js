import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
/**
 * Options for {@link pnorm} and {@link qnorm}.
 *
 * @category Distributions
 */
export interface NormalOptions {
    /** Mean. Default `0`. */
    mean?: number;
    /** Standard deviation. Default `1`. */
    sd?: number;
    /** If `true`, probabilities are P[X <= x]; if `false`, P[X > x]. Default `true`. */
    lowerTail?: boolean;
    /** If `true`, probabilities are given (to `qnorm`) and returned (from `pnorm`) as log(p). Default `false`. */
    logP?: boolean;
}
/**
 * Density of the normal distribution. Equivalent to R's `dnorm(x, mean = 0, sd = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - Distribution parameters and output scale.
 * @param options.mean - Mean. Default `0`.
 * @param options.sd - Standard deviation. Default `1`.
 * @param options.log - If `true`, return the log density. Default `false`.
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dnorm(0);                                  // 0.3989422804014327
 * dnorm([-1, 0, 1]);                         // [0.24197072451914337, 0.3989422804014327, 0.24197072451914337]
 * dnorm(1, { mean: 1, sd: 2, log: true });   // -1.612085713764618
 * ```
 *
 * @category Distributions
 */
export declare function dnorm<T extends Vectorizable>(x: T, options?: {
    mean?: number;
    sd?: number;
    log?: boolean;
}): VectorResult<T>;
/**
 * Distribution function of the normal distribution.
 * Equivalent to R's `pnorm(q, mean = 0, sd = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `mean`, `sd`, `lowerTail` and `logP` (see {@link NormalOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pnorm(1.96);                          // 0.9750021048517795
 * pnorm(1.96, { lowerTail: false });    // 0.024997895148220435
 * pnorm(new Float64Array([-1, 0, 1]));  // Float64Array [0.15865525393145707, 0.5, 0.8413447460685429]
 * pnorm(-40, { logP: true });           // -804.6084420137538
 * ```
 *
 * @category Distributions
 */
export declare function pnorm<T extends Vectorizable>(q: T, options?: NormalOptions): VectorResult<T>;
/**
 * Quantile function of the normal distribution.
 * Equivalent to R's `qnorm(p, mean = 0, sd = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `mean`, `sd`, `lowerTail` and `logP` (see {@link NormalOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qnorm(0.975);                         // 1.959963984540054
 * qnorm(0.05, { mean: 100, sd: 15 });   // 75.32719559572791
 * ```
 *
 * @category Distributions
 */
export declare function qnorm<T extends Vectorizable>(p: T, options?: NormalOptions): VectorResult<T>;
