import type { Alternative } from "./types.js";
/**
 * An effect size: a number, or Cohen's conventional `"small"`, `"medium"` or `"large"`
 *
 * @category Effect sizes and power
 */
export type EffectSize = number | "small" | "medium" | "large";
/**
 * The tests of {@link cohenES}
 *
 * @category Effect sizes and power
 */
export type CohenTest = "p" | "t" | "r" | "anov" | "chisq" | "f2";
/**
 * Result of {@link cohenES}.
 *
 * @category Effect sizes and power
 */
export interface CohenESResult {
    /** The test. */
    test: CohenTest;
    /** The conventional size. */
    size: "small" | "medium" | "large";
    /** Cohen's effect size (R's `effect.size`). */
    effectSize: number;
    /** Description of the calculation. */
    method: string;
}
/**
 * Cohen's conventional effect sizes. Equivalent to `pwr::cohen.ES(test, size)` in R.
 *
 * @example
 * ```ts
 * cohenES("anov", "medium").effectSize; // 0.25
 * ```
 *
 * @category Effect sizes and power
 */
export declare function cohenES(test?: CohenTest | (string & {}), size?: "small" | "medium" | "large" | (string & {})): CohenESResult;
/**
 * Effect size h of two proportions: `2 asin(sqrt(p1)) - 2 asin(sqrt(p2))`. Equivalent to `pwr::ES.h()` in R.
 *
 * @example
 * ```ts
 * esH(0.65, 0.45); // 0.40486007517695755
 * ```
 *
 * @category Effect sizes and power
 */
export declare function esH(p1: number, p2: number): number;
/**
 * Effect size w of a goodness-of-fit test, `sqrt(sum((p1 - p0)^2 / p0))`. Equivalent to `pwr::ES.w1()` in R.
 *
 * @example
 * ```ts
 * esW1([0.25, 0.25, 0.25, 0.25], [0.4, 0.2, 0.2, 0.2]); // 0.34641016151377546
 * ```
 *
 * @category Effect sizes and power
 */
export declare function esW1(p0: readonly number[], p1: readonly number[]): number;
/**
 * Effect size w of a test of association, for a matrix of cell probabilities (an array of rows): with the row sums
 * r and column sums c, `p0 = r c'` and `sqrt(sum((p - p0)^2 / p0))`. Equivalent to `pwr::ES.w2()` in R.
 *
 * @example
 * ```ts
 * esW2([[0.3, 0.2], [0.1, 0.4]]); // 0.40824829046386296
 * ```
 *
 * @category Effect sizes and power
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
/**
 * Options for {@link pwrTTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrTTestOptions extends PwrAlternative {
    /** Number of observations (per group, or of pairs). */
    n?: number | null;
    /** Effect size d (Cohen's d), or `"small"`, `"medium"`, `"large"`. */
    d?: EffectSize | null;
    /** `"two.sample"` (default), `"one.sample"` or `"paired"`. */
    type?: "two.sample" | "one.sample" | "paired" | (string & {});
}
/**
 * Result of {@link pwrTTest}.
 *
 * @category Effect sizes and power
 */
export interface PwrTTestResult {
    /** Number of observations (per group, or of pairs). */
    n: number;
    /** Effect size d. */
    d: number;
    /** Significance level (R's `sig.level`). */
    sigLevel: number;
    /** Power of the test. */
    power: number;
    /** The alternative hypothesis. */
    alternative: Alternative;
    /** A note on the sample size. */
    note?: string;
    /** Description of the calculation. */
    method: string;
}
/**
 * Power of a t test of means, or the sample size, effect size or significance level for a given power.
 * Equivalent to `pwr::pwr.t.test()` in R.
 *
 * @example
 * ```ts
 * pwrTTest({ n: 20, d: 0.5 }).power;          // 0.3379390289250411
 * pwrTTest({ d: 0.5, power: 0.8 }).n;         // 63.76561044415068
 * ```
 *
 * @category Effect sizes and power
 */
export declare function pwrTTest(options?: PwrTTestOptions): PwrTTestResult;
/**
 * Options for {@link pwrT2nTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrT2nTestOptions extends PwrAlternative {
    /** Number of observations in the first group. */
    n1?: number | null;
    /** Number of observations in the second group. */
    n2?: number | null;
    /** Effect size d, or `"small"`, `"medium"`, `"large"`. */
    d?: EffectSize | null;
}
/**
 * Result of {@link pwrT2nTest}.
 *
 * @category Effect sizes and power
 */
export interface PwrT2nTestResult {
    /** Number of observations in the first group. */
    n1: number;
    /** Number of observations in the second group. */
    n2: number;
    /** Effect size d. */
    d: number;
    /** Significance level (R's `sig.level`). */
    sigLevel: number;
    /** Power of the test. */
    power: number;
    /** The alternative hypothesis. */
    alternative: Alternative;
    /** Description of the calculation. */
    method: string;
}
/**
 * Power of a two-sample t test with unequal sample sizes, or a sample size, the effect size or the significance
 * level for a given power. Equivalent to `pwr::pwr.t2n.test()` in R.
 *
 * @example
 * ```ts
 * pwrT2nTest({ n1: 20, n2: 30, d: 0.5 }).power; // 0.39656999440895696
 * pwrT2nTest({ n1: 50, d: 0.5, power: 0.8 }).n2; // 87.70891347276086
 * ```
 *
 * @category Effect sizes and power
 */
export declare function pwrT2nTest(options?: PwrT2nTestOptions): PwrT2nTestResult;
/**
 * Options for {@link pwr2pTest} and {@link pwrPTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface Pwr2pTestOptions extends PwrAlternative {
    /** Effect size h ({@link esH}), or `"small"`, `"medium"`, `"large"`. */
    h?: EffectSize | null;
    /** Number of observations (per group for {@link pwr2pTest}). */
    n?: number | null;
}
/**
 * Result of {@link pwr2pTest} and {@link pwrPTest}.
 *
 * @category Effect sizes and power
 */
export interface Pwr2pTestResult {
    /** Effect size h. */
    h: number;
    /** Number of observations (per group for {@link pwr2pTest}). */
    n: number;
    /** Significance level (R's `sig.level`). */
    sigLevel: number;
    /** Power of the test. */
    power: number;
    /** The alternative hypothesis. */
    alternative: Alternative;
    /** Description of the calculation. */
    method: string;
    /** A note on the sample sizes (absent for {@link pwrPTest}). */
    note?: string;
}
/**
 * Power of the test of two proportions with equal sample sizes (arcsine transformation), or the effect size, sample
 * size or significance level for a given power. Equivalent to `pwr::pwr.2p.test()` in R.
 *
 * @example
 * ```ts
 * pwr2pTest({ h: 0.3, n: 80 }).power; // 0.47510087057263806
 * pwr2pTest({ h: esH(0.65, 0.45), power: 0.8 }).n; // 95.76938656160651
 * ```
 *
 * @category Effect sizes and power
 */
export declare function pwr2pTest(options?: Pwr2pTestOptions): Pwr2pTestResult;
/**
 * Power of the test of one proportion (arcsine transformation), or the effect size, sample size or significance
 * level for a given power. Equivalent to `pwr::pwr.p.test()` in R.
 *
 * @example
 * ```ts
 * pwrPTest({ h: 0.2, n: 60 }).power; // 0.34084512406749834
 * pwrPTest({ h: 0.2, power: 0.8 }).n; // 196.221512550509
 * ```
 *
 * @category Effect sizes and power
 */
export declare function pwrPTest(options?: Pwr2pTestOptions): Pwr2pTestResult;
/**
 * Options for {@link pwrNormTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrNormTestOptions extends PwrAlternative {
    /** Effect size d (difference of means over the known standard deviation), or `"small"`, `"medium"`, `"large"`. */
    d?: EffectSize | null;
    /** Number of observations. */
    n?: number | null;
}
/**
 * Result of {@link pwrNormTest}.
 *
 * @category Effect sizes and power
 */
export interface PwrNormTestResult {
    /** Effect size d. */
    d: number;
    /** Number of observations. */
    n: number;
    /** Significance level (R's `sig.level`). */
    sigLevel: number;
    /** Power of the test. */
    power: number;
    /** The alternative hypothesis. */
    alternative: Alternative;
    /** Description of the calculation. */
    method: string;
}
/**
 * Power of the test of a mean of a normal distribution with known variance, or the effect size, sample size or
 * significance level for a given power. Equivalent to `pwr::pwr.norm.test()` in R.
 *
 * @example
 * ```ts
 * pwrNormTest({ d: 0.3, n: 50 }).power; // 0.5641160254310038
 * pwrNormTest({ d: 0.3, power: 0.8 }).n; // 87.20953791564195
 * ```
 *
 * @category Effect sizes and power
 */
export declare function pwrNormTest(options?: PwrNormTestOptions): PwrNormTestResult;
/**
 * Options for {@link pwr2p2nTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface Pwr2p2nTestOptions extends PwrAlternative {
    /** Effect size h ({@link esH}), or `"small"`, `"medium"`, `"large"`. */
    h?: EffectSize | null;
    /** Number of observations in the first group. */
    n1?: number | null;
    /** Number of observations in the second group. */
    n2?: number | null;
}
/**
 * Result of {@link pwr2p2nTest}.
 *
 * @category Effect sizes and power
 */
export interface Pwr2p2nTestResult {
    /** Effect size h. */
    h: number;
    /** Number of observations in the first group. */
    n1: number;
    /** Number of observations in the second group. */
    n2: number;
    /** Significance level (R's `sig.level`). */
    sigLevel: number;
    /** Power of the test. */
    power: number;
    /** The alternative hypothesis. */
    alternative: Alternative;
    /** Description of the calculation. */
    method: string;
    /** A note on the sample sizes. */
    note: string;
}
/**
 * Power of the test of two proportions with unequal sample sizes (arcsine transformation), or the effect size, a
 * sample size or the significance level for a given power. Equivalent to `pwr::pwr.2p2n.test()` in R.
 *
 * @example
 * ```ts
 * pwr2p2nTest({ h: 0.3, n1: 80, n2: 120 }).power; // 0.5471899635264242
 * pwr2p2nTest({ h: 0.3, n1: 200, power: 0.8 }).n2; // 154.6399892648981
 * ```
 *
 * @category Effect sizes and power
 */
export declare function pwr2p2nTest(options?: Pwr2p2nTestOptions): Pwr2p2nTestResult;
/**
 * Options for {@link pwrRTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrRTestOptions extends PwrAlternative {
    /** Number of observations. */
    n?: number | null;
    /** Correlation, or `"small"`, `"medium"`, `"large"`. */
    r?: EffectSize | null;
}
/**
 * Result of {@link pwrRTest}.
 *
 * @category Effect sizes and power
 */
export interface PwrRTestResult {
    /** Number of observations. */
    n: number;
    /** Correlation. */
    r: number;
    /** Significance level (R's `sig.level`). */
    sigLevel: number;
    /** Power of the test. */
    power: number;
    /** The alternative hypothesis. */
    alternative: Alternative;
    /** Description of the calculation. */
    method: string;
}
/**
 * Power of the test of a correlation (Fisher's z transformation), or the sample size, correlation or significance
 * level for a given power. Equivalent to `pwr::pwr.r.test()` in R. As in pwr, the power computed for `"less"` reports
 * `r` negated.
 *
 * @example
 * ```ts
 * pwrRTest({ n: 50, r: 0.3 }).power; // 0.571555841860208
 * pwrRTest({ r: 0.3, power: 0.8 }).n; // 84.07363978228769
 * ```
 *
 * @category Effect sizes and power
 */
export declare function pwrRTest(options?: PwrRTestOptions): PwrRTestResult;
/**
 * Options for {@link pwrChisqTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrChisqTestOptions extends PwrCommon {
    /** Effect size w ({@link esW1}, {@link esW2}), or `"small"`, `"medium"`, `"large"`. */
    w?: EffectSize | null;
    /** Total number of observations. */
    N?: number | null;
    /** Degrees of freedom. */
    df: number;
}
/**
 * Result of {@link pwrChisqTest}.
 *
 * @category Effect sizes and power
 */
export interface PwrChisqTestResult {
    /** Effect size w. */
    w: number;
    /** Total number of observations. */
    N: number;
    /** Degrees of freedom. */
    df: number;
    /** Significance level (R's `sig.level`). */
    sigLevel: number;
    /** Power of the test. */
    power: number;
    /** Description of the calculation. */
    method: string;
    /** A note on the sample size. */
    note: string;
}
/**
 * Power of a chi-squared test, or the effect size, number of observations or significance level for a given power.
 * Equivalent to `pwr::pwr.chisq.test()` in R.
 *
 * @example
 * ```ts
 * pwrChisqTest({ w: 0.3, N: 100, df: 3 }).power; // 0.7112535997950422
 * pwrChisqTest({ w: 0.3, df: 3, power: 0.8 }).N; // 121.13959310294602
 * ```
 *
 * @category Effect sizes and power
 */
export declare function pwrChisqTest(options: PwrChisqTestOptions): PwrChisqTestResult;
/**
 * Options for {@link pwrAnovaTest}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrAnovaTestOptions extends PwrCommon {
    /** Number of groups. */
    k?: number | null;
    /** Number of observations per group. */
    n?: number | null;
    /** Effect size f, or `"small"`, `"medium"`, `"large"`. */
    f?: EffectSize | null;
}
/**
 * Result of {@link pwrAnovaTest}.
 *
 * @category Effect sizes and power
 */
export interface PwrAnovaTestResult {
    /** Number of groups. */
    k: number;
    /** Number of observations per group. */
    n: number;
    /** Effect size f. */
    f: number;
    /** Significance level (R's `sig.level`). */
    sigLevel: number;
    /** Power of the test. */
    power: number;
    /** A note on the sample size. */
    note: string;
    /** Description of the calculation. */
    method: string;
}
/**
 * Power of the F test of a balanced one-way analysis of variance, or the number of groups, sample size, effect size
 * or significance level for a given power. Equivalent to `pwr::pwr.anova.test()` in R.
 *
 * @example
 * ```ts
 * pwrAnovaTest({ k: 4, n: 20, f: 0.25 }).power; // 0.42039009037704295
 * pwrAnovaTest({ k: 4, f: 0.25, power: 0.8 }).n; // 44.59927432039623
 * ```
 *
 * @category Effect sizes and power
 */
export declare function pwrAnovaTest(options?: PwrAnovaTestOptions): PwrAnovaTestResult;
/**
 * Options for {@link pwrF2Test}. The quantity given as `null` (or omitted, except `sigLevel`) is solved for.
 *
 * @category Effect sizes and power
 */
export interface PwrF2TestOptions extends PwrCommon {
    /** Degrees of freedom of the numerator. */
    u?: number | null;
    /** Degrees of freedom of the denominator. */
    v?: number | null;
    /** Effect size f², or `"small"`, `"medium"`, `"large"`. */
    f2?: EffectSize | null;
}
/**
 * Result of {@link pwrF2Test}.
 *
 * @category Effect sizes and power
 */
export interface PwrF2TestResult {
    /** Degrees of freedom of the numerator. */
    u: number;
    /** Degrees of freedom of the denominator. */
    v: number;
    /** Effect size f². */
    f2: number;
    /** Significance level (R's `sig.level`). */
    sigLevel: number;
    /** Power of the test. */
    power: number;
    /** Description of the calculation. */
    method: string;
}
/**
 * Power of the F test of a general linear model, or the degrees of freedom, effect size or significance level for a
 * given power. Equivalent to `pwr::pwr.f2.test()` in R.
 *
 * @example
 * ```ts
 * pwrF2Test({ u: 3, v: 60, f2: 0.15 }).power; // 0.7109605416866717
 * pwrF2Test({ u: 3, f2: 0.15, power: 0.8 }).v; // 72.70582657950871
 * ```
 *
 * @category Effect sizes and power
 */
export declare function pwrF2Test(options?: PwrF2TestOptions): PwrF2TestResult;
export {};
