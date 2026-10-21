import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
import type { NoncentralOption } from "../internal/noncentral.js";
export declare function dfDensity1(x: number, m: number, n: number, log: boolean): number;
export declare function pf1(q: number, m: number, n: number, lowerTail: boolean, logP: boolean): number;
export declare function qf1(p: number, m: number, n: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the F distribution. Equivalent to R's `df(x, df1, df2, ncp, log = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral F distribution.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df1 - Numerator degrees of freedom.
 * @param df2 - Denominator degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 */
export declare function df<T extends Vectorizable>(x: T, df1: number, df2: number, options?: DensityOptions & NoncentralOption): VectorResult<T>;
/**
 * Distribution function of the F distribution. Equivalent to R's `pf(q, df1, df2, ncp, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral F distribution.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df1 - Numerator degrees of freedom.
 * @param df2 - Denominator degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pf(4.1, 2, 20, { lowerTail: false }); // 0.03219651558603902
 * ```
 */
export declare function pf<T extends Vectorizable>(q: T, df1: number, df2: number, options?: TailOptions & NoncentralOption): VectorResult<T>;
/**
 * Quantile function of the F distribution. Equivalent to R's `qf(p, df1, df2, ncp, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral F distribution.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df1 - Numerator degrees of freedom.
 * @param df2 - Denominator degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 */
export declare function qf<T extends Vectorizable>(p: T, df1: number, df2: number, options?: TailOptions & NoncentralOption): VectorResult<T>;
