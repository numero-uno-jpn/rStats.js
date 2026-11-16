import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { nonInt } from "../internal/integer.js";
/** Whether x is not an integer (relative tolerance 1e-9 as in R; see src/internal/integer.ts) */
export declare const nonInteger: typeof nonInt;
export declare function dpois1(x: number, lambda: number, log: boolean): number;
export declare function ppois1(q: number, lambda: number, lowerTail: boolean, logP: boolean): number;
export declare function qpois1(p: number, lambda: number, lowerTail: boolean, logP: boolean): number;
/**
 * Probability mass function of the Poisson distribution. Equivalent to R's `dpois(x, lambda, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param lambda - Mean.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * dpois(2, 3);         // 0.22404180765538775
 * dpois([0, 1, 2], 3); // [0.049787068367863944, 0.14936120510359185, 0.22404180765538775]
 * ```
 *
 * @category Distributions
 */
export declare function dpois<T extends Vectorizable>(x: T, lambda: number, options?: DensityOptions): VectorResult<T>;
/**
 * Distribution function of the Poisson distribution. Equivalent to R's `ppois(q, lambda, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param lambda - Mean.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * ppois(2, 3);                       // 0.4231900811268436
 * ppois(5, 3, { lowerTail: false }); // P[X > 5] = 0.08391794203130346
 * ```
 *
 * @category Distributions
 */
export declare function ppois<T extends Vectorizable>(q: T, lambda: number, options?: TailOptions): VectorResult<T>;
/**
 * Quantile function of the Poisson distribution. Equivalent to R's `qpois(p, lambda, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param lambda - Mean.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qpois(0.5, 3);           // 3
 * qpois([0.05, 0.95], 3);  // [1, 6]
 * ```
 *
 * @category Distributions
 */
export declare function qpois<T extends Vectorizable>(p: T, lambda: number, options?: TailOptions): VectorResult<T>;
