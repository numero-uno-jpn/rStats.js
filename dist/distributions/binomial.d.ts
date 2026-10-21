import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
export declare function dbinom1(x: number, size: number, prob: number, log: boolean): number;
export declare function pbinom1(q: number, size: number, prob: number, lowerTail: boolean, logP: boolean): number;
export declare function qbinom1(p: number, size: number, prob: number, lowerTail: boolean, logP: boolean): number;
/**
 * Probability mass function of the binomial distribution. Equivalent to R's `dbinom(x, size, prob, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param size - Number of trials.
 * @param prob - Probability of success on each trial.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 */
export declare function dbinom<T extends Vectorizable>(x: T, size: number, prob: number, options?: DensityOptions): VectorResult<T>;
/**
 * Distribution function of the binomial distribution. Equivalent to R's `pbinom(q, size, prob, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param size - Number of trials.
 * @param prob - Probability of success on each trial.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pbinom(3, 10, 0.5);      // 0.171875
 * pbinom([3, 5], 10, 0.5); // [0.171875, 0.623046875]
 * ```
 */
export declare function pbinom<T extends Vectorizable>(q: T, size: number, prob: number, options?: TailOptions): VectorResult<T>;
/**
 * Quantile function of the binomial distribution. Equivalent to R's `qbinom(p, size, prob, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param size - Number of trials.
 * @param prob - Probability of success on each trial.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export declare function qbinom<T extends Vectorizable>(p: T, size: number, prob: number, options?: TailOptions): VectorResult<T>;
