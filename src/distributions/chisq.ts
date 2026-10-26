// χ² distribution dchisq / pchisq / qchisq, computed as the gamma distribution with shape = df/2, scale = 2.
// Passing ncp gives the noncentral χ² (src/distributions/nchisq.ts). As in R, when ncp is omitted the
// central distribution is used.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import type { DensityOptions, TailOptions } from "../internal/dpq.js";
import { dgamma1, pgamma1, qgamma1 } from "./gamma.js";
import type { NoncentralOption } from "../internal/noncentral.js";
import { dnchisq1, pnchisq1, qnchisq1 } from "./nchisq.js";

/**
 * Density of the chi-squared distribution. Equivalent to R's `dchisq(x, df, ncp = 0, log = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral chi-squared distribution.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df - Degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dchisq(1, 3);              // 0.24197072451914337
 * dchisq(1, 3, { ncp: 2 });  // 0.12180056753215114
 * ```
 */
export function dchisq<T extends Vectorizable>(
  x: T,
  df: number,
  options: DensityOptions & NoncentralOption = {},
): VectorResult<T> {
  const { log = false, ncp } = options;
  if (ncp !== undefined) return vectorize(x, (v) => dnchisq1(v, df, ncp, log));
  return vectorize(x, (v) => dgamma1(v, df / 2, 2, log));
}

/**
 * Distribution function of the chi-squared distribution. Equivalent to R's `pchisq(q, df, ncp = 0, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral chi-squared distribution.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df - Degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pchisq(3.84, 1, { lowerTail: false }); // 0.05004352124870517
 * pchisq(5, 3, { ncp: 2 });              // 0.5934051800831556
 * ```
 */
export function pchisq<T extends Vectorizable>(
  q: T,
  df: number,
  options: TailOptions & NoncentralOption = {},
): VectorResult<T> {
  const { lowerTail = true, logP = false, ncp } = options;
  if (ncp !== undefined) return vectorize(q, (v) => pnchisq1(v, df, ncp, lowerTail, logP));
  return vectorize(q, (v) => pgamma1(v, df / 2, 2, lowerTail, logP));
}

/**
 * Quantile function of the chi-squared distribution. Equivalent to R's `qchisq(p, df, ncp = 0, lower.tail = TRUE, log.p = FALSE)`.
 *
 * If `ncp` is omitted the central distribution is used; otherwise the noncentral chi-squared distribution.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param df - Degrees of freedom.
 * @param options - `ncp` (see {@link NoncentralOption}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qchisq(0.95, 1);                   // 3.841458820694125
 * qchisq(0.05, 3, { lowerTail: false }); // 7.814727903251181
 * ```
 */
export function qchisq<T extends Vectorizable>(
  p: T,
  df: number,
  options: TailOptions & NoncentralOption = {},
): VectorResult<T> {
  const { lowerTail = true, logP = false, ncp } = options;
  if (ncp !== undefined) return vectorize(p, (v) => qnchisq1(v, df, ncp, lowerTail, logP));
  return vectorize(p, (v) => qgamma1(v, df / 2, 2, lowerTail, logP));
}
