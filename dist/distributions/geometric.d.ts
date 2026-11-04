import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { type DD } from "../special/dd.js";
/** p and q = 1 - p in double-double (the smaller one is the exact base) */
export declare function probPair(prob: number): {
    pd: DD;
    qd: DD;
};
export declare function dgeom1(x: number, prob: number, log: boolean): number;
export declare function pgeom1(q: number, prob: number, lowerTail: boolean, logP: boolean): number;
export declare function qgeom1(p: number, prob: number, lowerTail: boolean, logP: boolean): number;
/**
 * Probability mass function of the geometric distribution (number of failures before the first success). Equivalent to R's `dgeom(x, prob, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param prob - Probability of success on each trial.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * dgeom(2, 0.3);         // 0.147
 * dgeom([0, 1, 2], 0.5); // [0.5, 0.25, 0.125]
 * ```
 *
 * @category Distributions
 */
export declare function dgeom<T extends Vectorizable>(x: T, prob: number, options?: DensityOptions): VectorResult<T>;
/**
 * Distribution function of the geometric distribution (number of failures before the first success). Equivalent to R's `pgeom(q, prob, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param prob - Probability of success on each trial.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pgeom(2, 0.3);                       // 0.657
 * pgeom(2, 0.3, { lowerTail: false }); // 0.343
 * ```
 *
 * @category Distributions
 */
export declare function pgeom<T extends Vectorizable>(q: T, prob: number, options?: TailOptions): VectorResult<T>;
/**
 * Quantile function of the geometric distribution (number of failures before the first success). Equivalent to R's `qgeom(p, prob, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param prob - Probability of success on each trial.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qgeom(0.5, 0.3);          // 1
 * qgeom([0.1, 0.9], 0.3);   // [0, 6]
 * ```
 *
 * @category Distributions
 */
export declare function qgeom<T extends Vectorizable>(p: T, prob: number, options?: TailOptions): VectorResult<T>;
