import type { Alternative } from "./types.js";
/** An effect size: a number, or Cohen's conventional `"small"`, `"medium"` or `"large"` */
export type EffectSize = number | "small" | "medium" | "large";
/** The tests of {@link cohenES} */
export type CohenTest = "p" | "t" | "r" | "anov" | "chisq" | "f2";
/** Result of {@link cohenES}. */
export interface CohenESResult {
    test: CohenTest;
    size: "small" | "medium" | "large";
    effectSize: number;
    method: string;
}
/**
 * Cohen's conventional effect sizes. Equivalent to pwr's `cohen.ES(test, size)`.
 *
 * @example
 * ```ts
 * cohenES("anov", "medium").effectSize; // 0.25
 * ```
 */
export declare function cohenES(test?: CohenTest | (string & {}), size?: "small" | "medium" | "large" | (string & {})): CohenESResult;
/** Effect size h of two proportions: `2 asin(sqrt(p1)) - 2 asin(sqrt(p2))`. Equivalent to pwr's `ES.h`. */
export declare function esH(p1: number, p2: number): number;
/** Effect size w of a goodness-of-fit test, `sqrt(sum((p1 - p0)^2 / p0))`. Equivalent to pwr's `ES.w1`. */
export declare function esW1(p0: readonly number[], p1: readonly number[]): number;
/**
 * Effect size w of a test of association, for a matrix of cell probabilities (an array of rows): with the row sums
 * r and column sums c, `p0 = r c'` and `sqrt(sum((p - p0)^2 / p0))`. Equivalent to pwr's `ES.w2`.
 */
export declare function esW2(p: readonly (readonly number[])[]): number;
/** Common options of the pwr functions */
interface PwrCommon {
    /** Significance level. Default `0.05`. */
    sigLevel?: number | null;
    /** Power of the test. */
    power?: number | null;
}
/** Common options of the pwr functions with an alternative */
interface PwrAlternative extends PwrCommon {
    /** `"two.sided"` (default), `"less"` or `"greater"`; unambiguous abbreviations are accepted. */
    alternative?: Alternative | (string & {});
}
/** Options for {@link pwrTTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for. */
export interface PwrTTestOptions extends PwrAlternative {
    /** Number of observations (per group, or of pairs). */
    n?: number | null;
    /** Effect size d (Cohen's d), or `"small"`, `"medium"`, `"large"`. */
    d?: EffectSize | null;
    /** `"two.sample"` (default), `"one.sample"` or `"paired"`. */
    type?: "two.sample" | "one.sample" | "paired" | (string & {});
}
/** Result of {@link pwrTTest}. */
export interface PwrTTestResult {
    n: number;
    d: number;
    sigLevel: number;
    power: number;
    alternative: Alternative;
    note?: string;
    method: string;
}
/**
 * Power of a t test of means, or the sample size, effect size or significance level for a given power. Equivalent
 * to pwr's `pwr.t.test()`.
 *
 * @example
 * ```ts
 * pwrTTest({ n: 20, d: 0.5 }).power;          // 0.3379390289250411
 * pwrTTest({ d: 0.5, power: 0.8 }).n;         // 63.76561044415068
 * ```
 */
export declare function pwrTTest(options?: PwrTTestOptions): PwrTTestResult;
/** Options for {@link pwrT2nTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for. */
export interface PwrT2nTestOptions extends PwrAlternative {
    /** Number of observations in the first group. */
    n1?: number | null;
    /** Number of observations in the second group. */
    n2?: number | null;
    /** Effect size d, or `"small"`, `"medium"`, `"large"`. */
    d?: EffectSize | null;
}
/** Result of {@link pwrT2nTest}. */
export interface PwrT2nTestResult {
    n1: number;
    n2: number;
    d: number;
    sigLevel: number;
    power: number;
    alternative: Alternative;
    method: string;
}
/**
 * Power of a two-sample t test with unequal sample sizes, or a sample size, the effect size or the significance
 * level for a given power. Equivalent to pwr's `pwr.t2n.test()`.
 */
export declare function pwrT2nTest(options?: PwrT2nTestOptions): PwrT2nTestResult;
/** Options for {@link pwr2pTest} and {@link pwrPTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for. */
export interface Pwr2pTestOptions extends PwrAlternative {
    /** Effect size h ({@link esH}), or `"small"`, `"medium"`, `"large"`. */
    h?: EffectSize | null;
    /** Number of observations (per group for {@link pwr2pTest}). */
    n?: number | null;
}
/** Result of {@link pwr2pTest} and {@link pwrPTest}. */
export interface Pwr2pTestResult {
    h: number;
    n: number;
    sigLevel: number;
    power: number;
    alternative: Alternative;
    method: string;
    note?: string;
}
/**
 * Power of the test of two proportions with equal sample sizes (arcsine transformation), or the effect size, sample
 * size or significance level for a given power. Equivalent to pwr's `pwr.2p.test()`.
 */
export declare function pwr2pTest(options?: Pwr2pTestOptions): Pwr2pTestResult;
/**
 * Power of the test of one proportion (arcsine transformation), or the effect size, sample size or significance
 * level for a given power. Equivalent to pwr's `pwr.p.test()`.
 */
export declare function pwrPTest(options?: Pwr2pTestOptions): Pwr2pTestResult;
/** Options for {@link pwrNormTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for. */
export interface PwrNormTestOptions extends PwrAlternative {
    /** Effect size d (difference of means over the known standard deviation), or `"small"`, `"medium"`, `"large"`. */
    d?: EffectSize | null;
    /** Number of observations. */
    n?: number | null;
}
/** Result of {@link pwrNormTest}. */
export interface PwrNormTestResult {
    d: number;
    n: number;
    sigLevel: number;
    power: number;
    alternative: Alternative;
    method: string;
}
/**
 * Power of the test of a mean of a normal distribution with known variance, or the effect size, sample size or
 * significance level for a given power. Equivalent to pwr's `pwr.norm.test()`.
 */
export declare function pwrNormTest(options?: PwrNormTestOptions): PwrNormTestResult;
/** Options for {@link pwr2p2nTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for. */
export interface Pwr2p2nTestOptions extends PwrAlternative {
    /** Effect size h ({@link esH}), or `"small"`, `"medium"`, `"large"`. */
    h?: EffectSize | null;
    /** Number of observations in the first group. */
    n1?: number | null;
    /** Number of observations in the second group. */
    n2?: number | null;
}
/** Result of {@link pwr2p2nTest}. */
export interface Pwr2p2nTestResult {
    h: number;
    n1: number;
    n2: number;
    sigLevel: number;
    power: number;
    alternative: Alternative;
    method: string;
    note: string;
}
/**
 * Power of the test of two proportions with unequal sample sizes (arcsine transformation), or the effect size, a
 * sample size or the significance level for a given power. Equivalent to pwr's `pwr.2p2n.test()`.
 */
export declare function pwr2p2nTest(options?: Pwr2p2nTestOptions): Pwr2p2nTestResult;
/** Options for {@link pwrRTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for. */
export interface PwrRTestOptions extends PwrAlternative {
    /** Number of observations. */
    n?: number | null;
    /** Correlation, or `"small"`, `"medium"`, `"large"`. */
    r?: EffectSize | null;
}
/** Result of {@link pwrRTest}. */
export interface PwrRTestResult {
    n: number;
    r: number;
    sigLevel: number;
    power: number;
    alternative: Alternative;
    method: string;
}
/**
 * Power of the test of a correlation (Fisher's z transformation), or the sample size, correlation or significance
 * level for a given power. Equivalent to pwr's `pwr.r.test()`. As in pwr, the power computed for `"less"` reports
 * `r` negated.
 */
export declare function pwrRTest(options?: PwrRTestOptions): PwrRTestResult;
/** Options for {@link pwrChisqTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for. */
export interface PwrChisqTestOptions extends PwrCommon {
    /** Effect size w ({@link esW1}, {@link esW2}), or `"small"`, `"medium"`, `"large"`. */
    w?: EffectSize | null;
    /** Total number of observations. */
    N?: number | null;
    /** Degrees of freedom. */
    df: number;
}
/** Result of {@link pwrChisqTest}. */
export interface PwrChisqTestResult {
    w: number;
    N: number;
    df: number;
    sigLevel: number;
    power: number;
    method: string;
    note: string;
}
/**
 * Power of a chi-squared test, or the effect size, number of observations or significance level for a given power.
 * Equivalent to pwr's `pwr.chisq.test()`.
 */
export declare function pwrChisqTest(options: PwrChisqTestOptions): PwrChisqTestResult;
/** Options for {@link pwrAnovaTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for. */
export interface PwrAnovaTestOptions extends PwrCommon {
    /** Number of groups. */
    k?: number | null;
    /** Number of observations per group. */
    n?: number | null;
    /** Effect size f, or `"small"`, `"medium"`, `"large"`. */
    f?: EffectSize | null;
}
/** Result of {@link pwrAnovaTest}. */
export interface PwrAnovaTestResult {
    k: number;
    n: number;
    f: number;
    sigLevel: number;
    power: number;
    note: string;
    method: string;
}
/**
 * Power of the F test of a balanced one-way analysis of variance, or the number of groups, sample size, effect size
 * or significance level for a given power. Equivalent to pwr's `pwr.anova.test()`.
 */
export declare function pwrAnovaTest(options?: PwrAnovaTestOptions): PwrAnovaTestResult;
/** Options for {@link pwrF2Test}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for. */
export interface PwrF2TestOptions extends PwrCommon {
    /** Degrees of freedom of the numerator. */
    u?: number | null;
    /** Degrees of freedom of the denominator. */
    v?: number | null;
    /** Effect size f², or `"small"`, `"medium"`, `"large"`. */
    f2?: EffectSize | null;
}
/** Result of {@link pwrF2Test}. */
export interface PwrF2TestResult {
    u: number;
    v: number;
    f2: number;
    sigLevel: number;
    power: number;
    method: string;
}
/**
 * Power of the F test of a general linear model, or the degrees of freedom, effect size or significance level for a
 * given power. Equivalent to pwr's `pwr.f2.test()`.
 */
export declare function pwrF2Test(options?: PwrF2TestOptions): PwrF2TestResult;
export {};
