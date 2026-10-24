import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type TailOptions } from "../internal/dpq.js";
/** Options for {@link ptukey} and {@link qtukey}. */
export interface TukeyOptions extends TailOptions {
    /** Number of groups whose ranges are compared; the statistic is the maximum of that many ranges. Default `1`. */
    nranges?: number;
}
export declare function ptukey1(q: number, k: number, df: number, r: number, lowerTail: boolean, logP: boolean): number;
/**
 * Quantile: solve log P(e^y) = target for the smaller tail in y = log q with Brent's method.
 * The starting value solves the same equation for the df = ∞ distribution (computable from the inner integral alone).
 */
export declare function qtukey1(p: number, k: number, df: number, r: number, lowerTail: boolean, logP: boolean): number;
/**
 * Distribution function of the studentized range distribution (used by Tukey's HSD). Equivalent to R's `ptukey(q, nmeans, df, nranges = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * Results aim at a relative accuracy of about 1e-15. R's `ptukey` is accurate to only about 8 digits, so values can differ from R's beyond that.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param nmeans - Number of means (sample size of each range).
 * @param df - Degrees of freedom of the standard deviation estimate.
 * @param options - `nranges`, `lowerTail` and `logP` (see {@link TukeyOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * ptukey(3.5, 3, 12);                       // 0.9300045147248135
 * ptukey(3.5, 3, 12, { lowerTail: false }); // 0.06999548527518648
 * ```
 */
export declare function ptukey<T extends Vectorizable>(q: T, nmeans: number, df: number, options?: TukeyOptions): VectorResult<T>;
/**
 * Quantile function of the studentized range distribution (used by Tukey's HSD). Equivalent to R's `qtukey(p, nmeans, df, nranges = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * Results aim at a relative accuracy of about 1e-15. R's `ptukey` is accurate to only about 8 digits, so values can differ from R's beyond that.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param nmeans - Number of means (sample size of each range).
 * @param df - Degrees of freedom of the standard deviation estimate.
 * @param options - `nranges`, `lowerTail` and `logP` (see {@link TukeyOptions}).
 * @returns The quantile(s).
 */
export declare function qtukey<T extends Vectorizable>(p: T, nmeans: number, df: number, options?: TukeyOptions): VectorResult<T>;
