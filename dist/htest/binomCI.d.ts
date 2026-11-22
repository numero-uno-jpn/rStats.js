/**
 * Which limits of a proportion's interval are kept (DescTools' `sides`): `"two.sided"` both, `"left"` the lower one
 * (the upper is the end of the range), `"right"` the upper one.
 *
 * @category Hypothesis tests
 */
export type CISides = "two.sided" | "left" | "right";
/**
 * Methods of {@link binomCI}.
 *
 * @category Hypothesis tests
 */
export type BinomCIMethod = "wilson" | "wald" | "wilsoncc" | "agresti-coull" | "jeffreys" | "clopper-pearson" | "midp";
/**
 * Options for {@link binomCI}.
 *
 * @category Hypothesis tests
 */
export interface BinomCIOptions {
    /** The interval: `"wilson"` (default), `"wald"`, `"wilsoncc"`, `"agresti-coull"`, `"jeffreys"`,
     *  `"clopper-pearson"` or `"midp"`. Unambiguous abbreviations are accepted. */
    method?: BinomCIMethod | (string & {});
    /** Confidence level, in (0, 1). Default `0.95`. */
    confLevel?: number;
    /** `"two.sided"` (default), `"left"` (lower limit only) or `"right"` (upper limit only); abbreviations accepted. */
    sides?: CISides | (string & {});
}
/**
 * A confidence interval for a proportion, a difference or a ratio of proportions.
 *
 * @category Hypothesis tests
 */
export interface ProportionCIResult<M extends string = string> {
    /** The point estimate. */
    estimate: number;
    /** `[lower, upper]`; with `sides: "left"` the upper end of the range, with `"right"` the lower end. */
    confInt: [number, number];
    /** The confidence level given (of the one-sided limit, for `sides` other than `"two.sided"`). */
    confLevel: number;
    /** The method, in full. */
    method: M;
    /** The sides, in full. */
    sides: CISides;
    /** Warnings (none so far: input without a defined result is an error). */
    warnings: string[];
}
/**
 * Result of {@link binomCI}.
 *
 * @category Hypothesis tests
 */
export type BinomCIResult = ProportionCIResult<BinomCIMethod>;
/** The level, alpha and kappa = qnorm(1 - alpha/2) of an interval, from the level given and the sides */
export interface IntervalLevel {
    sides: CISides;
    /** The two-sided level actually used: confLevel, or 1 - 2(1 - confLevel) for one side */
    level: number;
    alpha: number;
    kappa: number;
    /**
     * qchisq(level, 1), the bound of the score statistics. Not kappa^2: 1 - alpha/2 rounds, which moves kappa^2 by up to
     * 1e-11 relative at alpha = 1e-6 (the score intervals of DescTools and epiR use qchisq or solve for alpha itself)
     */
    chisq: number;
}
/** Checks the level and sides, and the two-sided level that a one-sided limit is computed at (as DescTools) */
export declare function intervalLevel(confLevel: number | undefined, sides: string | undefined): IntervalLevel;
/**
 * The two-sided interval level of a given alpha, for callers that hold alpha itself (a test at 1 - 2 alpha: alpha
 * taken back as 1 - level is about eps / alpha relative off). `level` is 1 - alpha unless given
 */
export declare function levelOfAlpha(alpha: number, level?: number): IntervalLevel;
/** A count: a nonnegative integer (within the slack of isCount), returned rounded */
export declare function checkCount(v: number, name: string): number;
/** Successes and trials: integers with 0 <= x <= n and n > 0 */
export declare function checkTrials(x: number, n: number, xName: string, nName: string): [number, number];
/**
 * Wilson's score limits of x/n at kappa. At x = 0 the lower limit and at x = n the upper are exactly 0 and 1 (the
 * formula gives them up to rounding: DescTools' upper limit of 10/10 at the 50% level is 0.99999999999999989).
 * The limits are the roots of (n + kappa^2) p^2 - (2x + kappa^2) p + x^2/n = 0. Where centre - half cancels (more than
 * half of the centre, small x or a level close to 1) the lower limit is taken from the product of the roots,
 * x^2 / (n (n + kappa^2)), divided by the upper: centre - half loses digits in proportion to centre / lower (350 eps
 * at 1/1e15 and the level 1 - 2^-53, 28 eps for wilsoncc at 1/1000 and 95%; DescTools has the same digits)
 */
export declare function wilsonLimits(x: number, n: number, kappa: number): [number, number];
/**
 * Confidence interval for a binomial proportion x/n. Equivalent to `DescTools::BinomCI()` in R.
 *
 * Methods (`method`): `"wilson"` (the default, Wilson's score interval), `"wald"`, `"wilsoncc"` (with continuity
 * correction), `"agresti-coull"`, `"jeffreys"`, `"clopper-pearson"` (the exact interval) and `"midp"` (the mid-p exact
 * interval). With `sides: "left"` or `"right"` only the lower or the upper limit is kept, at the one-sided level
 * `confLevel` (the two-sided interval at `1 - 2 (1 - confLevel)`), and the other end is 0 or 1. Limits are clipped to
 * [0, 1].
 *
 * The mid-p limits are the roots of their equations to the precision of the doubles; DescTools stops its search at
 * an absolute 1.22e-4, which leaves its limits up to 1e-4 off and gives 0 for lower limits below that. Unlike
 * DescTools, which returns NaN or numbers, x > n, a negative or non-integer count, n = 0 and a level outside (0, 1)
 * are errors.
 *
 * @param x Number of successes.
 * @param n Number of trials.
 * @param options See {@link BinomCIOptions}.
 * @returns The estimate x/n and the interval; see {@link BinomCIResult}.
 * @throws RangeError for counts that are not integers with 0 <= x <= n, n > 0, a level outside (0, 1) (at least 0.5
 *   one-sided), or an unknown method or sides.
 *
 * @example
 * ```ts
 * binomCI(37, 100).confInt; // [0.28182360534324535, 0.4677947041905709]
 * binomCI(37, 100, { method: "clopper-pearson" }).confInt; // [0.27556657961455155, 0.4723516405516831]
 * binomCI(1, 1000, { method: "midp", sides: "right" }).confInt; // [0, 0.004106205924199768]
 * ```
 *
 * @category Hypothesis tests
 */
export declare function binomCI(x: number, n: number, options?: BinomCIOptions): BinomCIResult;
