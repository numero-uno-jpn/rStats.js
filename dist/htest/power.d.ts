import { type UnirootOptions } from "../numerics/integrate.js";
/** R's match.arg: the value in full, also from an unambiguous abbreviation */
export declare function matchChoice<T extends string>(value: string | undefined, choices: readonly T[]): T;
/** Whether a quantity is to be solved for: null, or omitted when R gives it no default */
export declare const isUnknown: (v: unknown) => v is null | undefined;
/** The error when not exactly one of the quantities is unknown */
export declare function checkExactlyOne(values: readonly unknown[], message: string): void;
/** The root of f(x) = 0 by uniroot, as the power functions call it */
export declare function solveFor(f: (x: number) => number, lower: number, upper: number, options?: UnirootOptions): number;
/** pt(q, df, ncp) in one tail */
export declare const ptNcp: (q: number, df: number, ncp: number, lowerTail: boolean) => number;
/** Options for {@link powerTTest}. The quantity given as `null` (or omitted, for those without a default) is solved for. */
export interface PowerTTestOptions {
    /** Number of observations (per group). */
    n?: number | null;
    /** True difference in means. */
    delta?: number | null;
    /** Standard deviation. Default `1`. */
    sd?: number | null;
    /** Significance level. Default `0.05`. */
    sigLevel?: number | null;
    /** Power of the test. */
    power?: number | null;
    /** `"two.sample"` (default), `"one.sample"` or `"paired"`. */
    type?: "two.sample" | "one.sample" | "paired" | (string & {});
    /** `"two.sided"` (default) or `"one.sided"`. */
    alternative?: "two.sided" | "one.sided" | (string & {});
    /** Two-sided: count the probability of rejecting in the wrong direction too. Default `false`. */
    strict?: boolean;
    /** Tolerance of the root finding. Default `eps^0.25`. */
    tol?: number;
}
/** Result of {@link powerTTest}: R's power.htest with the solved quantity filled in. */
export interface PowerTTestResult {
    n: number;
    delta: number;
    sd: number;
    sigLevel: number;
    power: number;
    alternative: "two.sided" | "one.sided";
    note?: string;
    method: string;
}
/**
 * Power of a one- or two-sample t test, or the sample size, difference, standard deviation or significance level
 * for a given power. Equivalent to R's `power.t.test()`.
 *
 * @example
 * ```ts
 * powerTTest({ n: 20, delta: 1 }).power;           // 0.8689528016921269
 * powerTTest({ delta: 0.5, power: 0.8 }).n;        // 63.765763714280546
 * ```
 */
export declare function powerTTest(options?: PowerTTestOptions): PowerTTestResult;
/** Options for {@link powerPropTest}. The quantity given as `null` (or omitted, for those without a default) is solved for. */
export interface PowerPropTestOptions {
    /** Number of observations per group. */
    n?: number | null;
    /** Probability in one group. */
    p1?: number | null;
    /** Probability in the other group. */
    p2?: number | null;
    /** Significance level. Default `0.05`. */
    sigLevel?: number | null;
    /** Power of the test. */
    power?: number | null;
    /** `"two.sided"` (default) or `"one.sided"`. */
    alternative?: "two.sided" | "one.sided" | (string & {});
    /** Two-sided: count the probability of rejecting in the wrong direction too. Default `false`. */
    strict?: boolean;
    /** Tolerance of the root finding. Default `eps^0.25`. */
    tol?: number;
}
/** Result of {@link powerPropTest}. */
export interface PowerPropTestResult {
    n: number;
    p1: number;
    p2: number;
    sigLevel: number;
    power: number;
    alternative: "two.sided" | "one.sided";
    note: string;
    method: string;
    /** R's warnings. */
    warnings: string[];
}
/**
 * Power of the test of two proportions, or the sample size, a probability or the significance level for a given
 * power. Equivalent to R's `power.prop.test()`.
 *
 * @example
 * ```ts
 * powerPropTest({ n: 50, p1: 0.5, p2: 0.75 }).power;   // 0.7401659013313878
 * ```
 */
export declare function powerPropTest(options?: PowerPropTestOptions): PowerPropTestResult;
/** Options for {@link powerAnovaTest}. The quantity given as `null` (or omitted, for those without a default) is solved for. */
export interface PowerAnovaTestOptions {
    /** Number of groups. */
    groups?: number | null;
    /** Number of observations per group. */
    n?: number | null;
    /** Variance between the groups' means. */
    betweenVar?: number | null;
    /** Variance within the groups. */
    withinVar?: number | null;
    /** Significance level. Default `0.05`. */
    sigLevel?: number | null;
    /** Power of the test. */
    power?: number | null;
}
/** Result of {@link powerAnovaTest}. */
export interface PowerAnovaTestResult {
    groups: number;
    n: number;
    betweenVar: number;
    withinVar: number;
    sigLevel: number;
    power: number;
    note: string;
    method: string;
}
/**
 * Power of the F test of a balanced one-way analysis of variance, or one of the other quantities for a given power.
 * Equivalent to R's `power.anova.test()`.
 *
 * @example
 * ```ts
 * powerAnovaTest({ groups: 4, n: 5, betweenVar: 1, withinVar: 3 }).power;   // 0.3535594237229933
 * ```
 */
export declare function powerAnovaTest(options?: PowerAnovaTestOptions): PowerAnovaTestResult;
