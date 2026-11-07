import { type CISides, type IntervalLevel, type ProportionCIResult } from "./binomCI.js";
import type { Counts } from "./types.js";
/**
 * Methods of {@link binomDiffCI}.
 *
 * @category Hypothesis tests
 */
export type BinomDiffCIMethod = "ac" | "wald" | "score" | "mn" | "mee";
/**
 * Options for {@link binomDiffCI}.
 *
 * @category Hypothesis tests
 */
export interface BinomDiffCIOptions {
    /** `"ac"` (Agresti-Caffo, the default), `"wald"`, `"score"` (Newcombe's hybrid score interval), `"mn"`
     *  (Miettinen-Nurminen) or `"mee"` (Farrington-Manning / Mee). Unambiguous abbreviations are accepted. */
    method?: BinomDiffCIMethod | (string & {});
    /** Confidence level, in (0, 1). Default `0.95`. */
    confLevel?: number;
    /** `"two.sided"` (default), `"left"` (lower limit only) or `"right"` (upper limit only); abbreviations accepted. */
    sides?: CISides | (string & {});
}
/**
 * Result of {@link binomDiffCI}.
 *
 * @category Hypothesis tests
 */
export type BinomDiffCIResult = ProportionCIResult<BinomDiffCIMethod>;
/**
 * The two-sided limits of binomDiffCI for checked counts at the level lv (also used by binomDiffEquivalenceTest, with
 * the level built from its alpha)
 */
export declare function binomDiffLimits(a1: number, m1: number, a2: number, m2: number, method: BinomDiffCIMethod, lv: IntervalLevel): [number, number];
/**
 * Confidence interval for the difference p1 - p2 of two independent proportions x1/n1 and x2/n2. Equivalent to
 * `DescTools::BinomDiffCI()` in R.
 *
 * Methods (`method`): `"ac"` (Agresti-Caffo, the default as in DescTools: the Wald interval with one success and one
 * failure added to each group), `"wald"`, `"score"` (Newcombe's hybrid score interval, his method 10), `"mn"`
 * (Miettinen-Nurminen score interval) and `"mee"` (Farrington-Manning / Mee: the same without the factor N/(N - 1);
 * epiR's score interval of the attributable risk). With `sides: "left"` or `"right"` only the lower or the upper limit
 * is kept, at the one-sided level `confLevel`, and the other end is 1 or -1. The `"mn"` and `"mee"` limits are the
 * roots of the score statistic to the precision of the doubles (DescTools stops at about 1e-7 and 1e-4).
 *
 * @param x1 Successes in group 1.
 * @param n1 Trials in group 1.
 * @param x2 Successes in group 2.
 * @param n2 Trials in group 2.
 * @param options See {@link BinomDiffCIOptions}.
 * @returns The estimate p1 - p2 and the interval; see {@link BinomDiffCIResult}.
 * @throws RangeError for counts that are not integers with 0 <= x <= n, n > 0, a level outside (0, 1) (at least 0.5
 *   one-sided), or an unknown method or sides.
 *
 * @example
 * ```ts
 * binomDiffCI(56, 70, 48, 80).confInt; // [0.05245292663805373, 0.3357584554757674]
 * binomDiffCI(56, 70, 48, 80, { method: "mn" }).confInt; // [0.05282971324584462, 0.33817294001586834]
 * ```
 *
 * @category Hypothesis tests
 */
export declare function binomDiffCI(x1: number, n1: number, x2: number, n2: number, options?: BinomDiffCIOptions): BinomDiffCIResult;
/**
 * Methods of {@link binomRatioCI}.
 *
 * @category Hypothesis tests
 */
export type BinomRatioCIMethod = "katz.log" | "koopman";
/**
 * Options for {@link binomRatioCI}.
 *
 * @category Hypothesis tests
 */
export interface BinomRatioCIOptions {
    /** `"katz.log"` (the default) or `"koopman"` (Koopman's score interval). Unambiguous abbreviations are accepted. */
    method?: BinomRatioCIMethod | (string & {});
    /** Confidence level, in (0, 1). Default `0.95`. */
    confLevel?: number;
    /** `"two.sided"` (default), `"left"` (lower limit only) or `"right"` (upper limit only); abbreviations accepted. */
    sides?: CISides | (string & {});
}
/**
 * Result of {@link binomRatioCI}.
 *
 * @category Hypothesis tests
 */
export type BinomRatioCIResult = ProportionCIResult<BinomRatioCIMethod>;
/**
 * Confidence interval for the ratio p1/p2 of two independent proportions x1/n1 and x2/n2 (the risk ratio). Equivalent
 * to `DescTools::BinomRatioCI()` in R.
 *
 * Methods (`method`): `"katz.log"` (the default; Katz's log interval, with 0.5 put for a zero count, and n - 0.5 for
 * both counts when both groups are all successes, as DescTools) and `"koopman"` (Koopman's score interval, also epiR's
 * score interval of the risk ratio), whose limits are the roots of Koopman's statistic to the precision of the
 * doubles. With `sides: "left"` or `"right"` only the lower or the upper limit is kept, at the one-sided level
 * `confLevel`, and the other end is Infinity or 0 (DescTools computes the one-sided level but keeps both limits).
 * With x1 = x2 = 0 the estimate is 0 and the interval [0, Infinity], as DescTools.
 *
 * @param x1 Successes in group 1.
 * @param n1 Trials in group 1.
 * @param x2 Successes in group 2.
 * @param n2 Trials in group 2.
 * @param options See {@link BinomRatioCIOptions}.
 * @returns The estimate p1/p2 and the interval; see {@link BinomRatioCIResult}.
 * @throws RangeError for counts that are not integers with 0 <= x <= n, n > 0, a level outside (0, 1) (at least 0.5
 *   one-sided), or an unknown method or sides.
 *
 * @example
 * ```ts
 * binomRatioCI(56, 70, 48, 80).confInt; // [1.076626422763193, 1.6512485112663868]
 * binomRatioCI(56, 70, 48, 80, { method: "koopman" }).confInt; // [1.0798215063618983, 1.6708055780191118]
 * ```
 *
 * @category Hypothesis tests
 */
export declare function binomRatioCI(x1: number, n1: number, x2: number, n2: number, options?: BinomRatioCIOptions): BinomRatioCIResult;
/**
 * Methods of {@link oddsRatio}.
 *
 * @category Hypothesis tests
 */
export type OddsRatioMethod = "midp" | "fisher" | "wald" | "score";
/**
 * Options for {@link oddsRatio}.
 *
 * @category Hypothesis tests
 */
export interface OddsRatioOptions {
    /** `"midp"` (the default: median-unbiased estimate and mid-p exact interval), `"fisher"` (conditional MLE and
     *  Fisher's exact interval), `"wald"` or `"score"` (epiR's score interval). Unambiguous abbreviations accepted. */
    method?: OddsRatioMethod | (string & {});
    /** Confidence level, in (0, 1). Default `0.95`. */
    confLevel?: number;
}
/**
 * Result of {@link oddsRatio}.
 *
 * @category Hypothesis tests
 */
export interface OddsRatioResult {
    /** The odds ratio: the median-unbiased estimate (`"midp"`), the conditional MLE (`"fisher"`) or the sample odds
     *  ratio x11 x22 / (x12 x21) (`"wald"`, `"score"`). */
    estimate: number;
    /** `[lower, upper]`. */
    confInt: [number, number];
    /** The confidence level. */
    confLevel: number;
    /** epitools' description of the method (e.g. `"median-unbiased estimate & mid-p exact CI"`). */
    method: string;
    /** epitools' p-values of independence, the same for every method. */
    pValue: {
        /** The two-sided mid-p exact p-value: twice the smaller one-sided mid-p value P(X < a) + P(X = a)/2. */
        midp: number;
        /** Fisher's exact two-sided p-value (as {@link fisherTest}). */
        fisher: number;
        /** Pearson's chi-squared test without continuity correction. */
        chiSquare: number;
    };
    /** R's warnings ("Chi-squared approximation may be incorrect" where an expected count is below 5). */
    warnings: string[];
}
/**
 * Odds ratio of a 2 x 2 table with its confidence interval and three p-values of independence. Equivalent to
 * `epitools::oddsratio()` in R.
 *
 * The table is in epitools' orientation: rows are the exposure (row 1 the reference level) and columns the outcome
 * (column 1 without the disease); the odds ratio x11 x22 / (x12 x21) is the same for the transposed table.
 *
 * Methods (`method`): `"midp"` (the default, as epitools: the median-unbiased estimate and the mid-p exact interval
 * from Fisher's noncentral hypergeometric distribution of x11 given the margins), `"fisher"` (the conditional MLE and
 * the exact interval of {@link fisherTest}), `"wald"` (the sample odds ratio and Woolf's interval on the log scale;
 * as epitools, no zero-cell correction: a zero cell gives an estimate of 0 or Infinity and NaN for the limit that is
 * not defined) and `"score"` (the sample odds ratio and the score interval of epiR's `epi.2by2`, Miettinen-Nurminen
 * without the factor N/(N - 1)). The mid-p and score limits are the roots of their equations to the precision of the
 * doubles (epitools solves with uniroot's tolerance on [0, 1000] and fails beyond and for zero cells; epiR steps by
 * 0.1%). With a zero cell the mid-p estimate and limits follow the conventions of exact2x2: 0 or Infinity at the end
 * of the support.
 *
 * `pValue` has epitools' three p-values: the two-sided mid-p (twice the smaller one-sided mid-p value), Fisher's
 * exact test and Pearson's chi-squared without continuity correction (with R's warning "Chi-squared approximation may
 * be incorrect" where an expected count is below 5).
 *
 * @param table A 2 x 2 table of counts as an array of rows.
 * @param options See {@link OddsRatioOptions}.
 * @returns See {@link OddsRatioResult}.
 * Limits: the exact methods (`"midp"`, `"fisher"`) need the support of x11 given the margins (min(x11, x22) +
 * min(x12, x21) + 1 values) to be at most 2^23 (about 6 s), and `"fisher"` counts of at most 2^31 - 1 (as
 * `fisherTest`); the p-values of every method need phyper within its 2^26 terms (counts up to about 1e12).
 *
 * @throws TypeError if the table is not 2 x 2; RangeError for negative or non-integer counts, a table of zeros, a
 *   level outside (0, 1), an unknown method, or a table beyond the limits above.
 *
 * @example
 * ```ts
 * const r = oddsRatio([[56, 14], [48, 32]]);
 * r.estimate; // 2.6364237331551914
 * r.confInt;  // [1.276159154292712, 5.670866460839431]
 * r.pValue;   // { midp: 0.008449442679452648, fisher: 0.012521129749209155, chiSquare: 0.00804508136819659 }
 * ```
 *
 * @category Hypothesis tests
 */
export declare function oddsRatio(table: readonly Counts[], options?: OddsRatioOptions): OddsRatioResult;
