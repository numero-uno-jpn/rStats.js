import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
import type { NoncentralOption } from "../internal/noncentral.js";
/** Log density (n finite and positive, x finite) */
export declare function dtLog(x: number, n: number): number;
export declare function dtDensity1(x: number, df: number, log: boolean): number;
export declare function pt1(q: number, df: number, lowerTail: boolean, logP: boolean): number;
export declare function qt1(p: number, df: number, lowerTail: boolean, logP: boolean): number;
/**
 * Density of the t distribution. Equivalent to R's `dt(x, df, ncp, log = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral t distribution.
 *
 * As in R, `ncp: 0` gives the same values as the central distribution.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df - Degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dt(0, 5);             // 0.37960668982249446
 * dt(1, 5, { ncp: 1 }); // 0.36232483923371867
 * ```
 *
 * @category Distributions
 */
export declare function dt<T extends Vectorizable>(x: T, df: number, options?: DensityOptions & NoncentralOption): VectorResult<T>;
/**
 * Distribution function of the t distribution. Equivalent to R's `pt(q, df, ncp, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral t distribution.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df - Degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pt(2.1, 10, { lowerTail: false }); // 0.031038622101109286
 * pt(1, 5, { ncp: 1 });              // 0.48092614124210525
 * ```
 *
 * @category Distributions
 */
export declare function pt<T extends Vectorizable>(q: T, df: number, options?: TailOptions & NoncentralOption): VectorResult<T>;
/**
 * Quantile function of the t distribution. Equivalent to R's `qt(p, df, ncp, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral t distribution.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df - Degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qt(0.975, 10);         // 2.228138851986274
 * qt([0.025, 0.975], 5); // [-2.5705818356363155, 2.5705818356363146]
 * ```
 *
 * @category Distributions
 */
export declare function qt<T extends Vectorizable>(p: T, df: number, options?: TailOptions & NoncentralOption): VectorResult<T>;
