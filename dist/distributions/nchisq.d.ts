export declare function dnchisq1(x: number, df: number, ncp: number, log: boolean): number;
/**
 * log f(x) at x = x0 e^v, with the offset v taken exactly where the density varies faster than the rounding of x can
 * follow: in the asymptotic forms the exponent depends on x through sqrt(x) - sqrt(λ) or λ + 2ν - x, which are formed
 * from x0 and v (by expm1) instead of from the double x. Used by integrals over log x (src/distributions/nbeta.ts),
 * where x0 e^v rounded would put an error of eps |d log f / d log x| (eps sqrt(λ) near the mode) into each node.
 */
export declare function dnchisqLogNear(x0: number, v: number, df: number, ncp: number): number;
/**
 * P(s, t) (lower) or Q(s, t) of the central gamma distribution (its log if log) for a large shape (s > 1e4), as the
 * central χ² with 2s degrees of freedom through debyeTails (λ = 0; the uniform expansion then reduces to Stirling's
 * series), at t = t0 e^v with the offset v exact: N = 2s - 2 - 2t is formed from t0 and v (src/distributions/nbeta.ts
 * integrates over log t, where the rounding of t0 e^v would carry an error of eps sqrt(s) into the log). The
 * incomplete gamma function can take 40 ms for such shapes (s = 1e12, t < s; 0.1 s at s = 1e37)
 */
export declare function gammaTailNear(s: number, t0: number, v: number, lower: boolean, log: boolean): number;
export declare function pnchisq1(q: number, df: number, ncp: number, lowerTail: boolean, logP: boolean): number;
/**
 * A tail that a rigorous bound places below the smallest positive double: `far` is "lower" when P[X <= q] is
 * negligible, "upper" when P[X > q] is, undefined when neither bound decides it
 */
export type FarTail = "lower" | "upper" | undefined;
/**
 * The value of the requested tail when the far tail is negligible: the far tail is exactly 0, the near tail exactly 1
 * (log 0). The log of the far tail is left to the full computation (undefined).
 */
export declare function negligibleTail(far: FarTail, lowerTail: boolean, logP: boolean): number | undefined;
/**
 * The quantile x found by the Newton iteration if its log probability lp is within 1e-15 of the target, or within 1e-9
 * and x is the quantile to 1e-14 (x reaches the target and x (1 - 1e-14) does not: where the distribution function is
 * nearly flat in log x the iteration can stall 1e-8 away in log p, and where it is steep in log x, 1e-12 in log p can
 * be 4e-13 in x), otherwise that of `search`. The iteration fails where the distribution function is too steep to be
 * resolved by the doubles (for a huge df or ncp the spread can be below the spacing of x, so that the function steps
 * from 0 to 1/2 at one double); a search over the doubles (searchDoubles) then gives the smallest x that reaches the
 * target
 */
export declare function confirmQuantile(x: number, lp: number, logTarget: number, search: () => number, passes: (x: number) => boolean): number;
export declare function qnchisq1(p: number, df: number, ncp: number, lowerTail: boolean, logP: boolean): number;
