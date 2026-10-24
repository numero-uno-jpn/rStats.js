// χ² distribution dchisq / pchisq / qchisq, computed as the gamma distribution with shape = df/2, scale = 2.
// Passing ncp gives the noncentral χ² (src/distributions/nchisq.ts). As in R, when ncp is omitted the
// central distribution is used.
import { vectorize } from "../internal/vectorize.js";
import { dgamma1, pgamma1, qgamma1 } from "./gamma.js";
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
 */
export function dchisq(x, df, options = {}) {
    const { log = false, ncp } = options;
    if (ncp !== undefined)
        return vectorize(x, (v) => dnchisq1(v, df, ncp, log));
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
export function pchisq(q, df, options = {}) {
    const { lowerTail = true, logP = false, ncp } = options;
    if (ncp !== undefined)
        return vectorize(q, (v) => pnchisq1(v, df, ncp, lowerTail, logP));
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
 */
export function qchisq(p, df, options = {}) {
    const { lowerTail = true, logP = false, ncp } = options;
    if (ncp !== undefined)
        return vectorize(p, (v) => qnchisq1(v, df, ncp, lowerTail, logP));
    return vectorize(p, (v) => qgamma1(v, df / 2, 2, lowerTail, logP));
}
