import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
/**
 * Parameters of the negative binomial distribution. Give exactly one of `prob` and `mu`.
 *
 * @category Distributions
 */
export interface NegBinomialParams {
    /** Probability of success on each trial (`0 < prob <= 1`). Do not combine with `mu`. */
    prob?: number;
    /** Mean (`mu = size * (1 - prob) / prob`). Do not combine with `prob`. */
    mu?: number;
}
export declare function dnbinom1(x: number, size: number, prob: number, log: boolean): number;
export declare function pnbinom1(q: number, size: number, prob: number, lowerTail: boolean, logP: boolean): number;
export declare function qnbinom1(p: number, size: number, prob: number, lowerTail: boolean, logP: boolean): number;
export declare function dnbinomMu1(x: number, size: number, mu: number, log: boolean): number;
export declare function pnbinomMu1(q: number, size: number, mu: number, lowerTail: boolean, logP: boolean): number;
export declare function qnbinomMu1(p: number, size: number, mu: number, lowerTail: boolean, logP: boolean): number;
/**
 * Probability mass function of the negative binomial distribution (number of failures before the `size`-th success). Equivalent to R's `dnbinom(x, size, prob, mu, log = FALSE)`.
 *
 * The distribution is parameterized by `size` and exactly one of `prob` or `mu`. With `mu`, `size = Infinity` gives the Poisson distribution.
 *
 * @throws TypeError unless exactly one of `prob` and `mu` is given.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param size - Target number of successes (need not be an integer).
 * @param options - `prob` or `mu` (see {@link NegBinomialParams}; exactly one is required) and `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * dnbinom(3, 5, { prob: 0.5 }); // 0.13671875
 * dnbinom(3, 5, { mu: 4 });     // 0.16261401187793145
 * ```
 *
 * @category Distributions
 */
export declare function dnbinom<T extends Vectorizable>(x: T, size: number, options: NegBinomialParams & DensityOptions): VectorResult<T>;
/**
 * Distribution function of the negative binomial distribution (number of failures before the `size`-th success). Equivalent to R's `pnbinom(q, size, prob, mu, lower.tail = TRUE, log.p = FALSE)`.
 *
 * The distribution is parameterized by `size` and exactly one of `prob` or `mu`. With `mu`, `size = Infinity` gives the Poisson distribution.
 *
 * @throws TypeError unless exactly one of `prob` and `mu` is given.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param size - Target number of successes (need not be an integer).
 * @param options - `prob` or `mu` (see {@link NegBinomialParams}; exactly one is required), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pnbinom(3, 5, { prob: 0.5 }); // 0.36328125
 * pnbinom(3, 5, { mu: 4 });     // 0.4899473063232853
 * ```
 *
 * @category Distributions
 */
export declare function pnbinom<T extends Vectorizable>(q: T, size: number, options: NegBinomialParams & TailOptions): VectorResult<T>;
/**
 * Quantile function of the negative binomial distribution (number of failures before the `size`-th success). Equivalent to R's `qnbinom(p, size, prob, mu, lower.tail = TRUE, log.p = FALSE)`.
 *
 * The distribution is parameterized by `size` and exactly one of `prob` or `mu`. With `mu`, `size = Infinity` gives the Poisson distribution.
 *
 * @throws TypeError unless exactly one of `prob` and `mu` is given.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param size - Target number of successes (need not be an integer).
 * @param options - `prob` or `mu` (see {@link NegBinomialParams}; exactly one is required), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qnbinom(0.5, 5, { prob: 0.5 });  // 4
 * qnbinom([0.05, 0.95], 5, { mu: 4 }); // [0, 9]
 * ```
 *
 * @category Distributions
 */
export declare function qnbinom<T extends Vectorizable>(p: T, size: number, options: NegBinomialParams & TailOptions): VectorResult<T>;
