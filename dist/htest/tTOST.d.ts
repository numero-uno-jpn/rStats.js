import type { Sample } from "./types.js";
/**
 * Options for {@link tTOST} and {@link tsumTOST}. The equivalence bounds are required: `eqb`, or `lowEqbound` and
 * `highEqbound`. Unambiguous abbreviations of the choices are accepted.
 *
 * @category Hypothesis tests
 */
export interface TTOSTOptions {
    /** The bounds: a number `e` for `(-|e|, |e|)`, or two numbers `[low, high]` (in either order). */
    eqb?: number | readonly number[];
    /** The lower bound (with `highEqbound`, where `eqb` is not given). */
    lowEqbound?: number;
    /** The upper bound (with `lowEqbound`, where `eqb` is not given). */
    highEqbound?: number;
    /** `"EQU"` (default): equivalence, the effect lies inside the bounds; `"MET"`: minimal effect, outside them. */
    hypothesis?: "EQU" | "MET" | (string & {});
    /** Paired samples. Default `false`. */
    paired?: boolean;
    /** Two samples: pooled variance (Student's t) instead of Welch's. Default `false`. */
    varEqual?: boolean;
    /** The level of each one-sided test, in (0, 0.5); the intervals are 1 − 2 alpha intervals. Default `0.05`. */
    alpha?: number;
    /** The difference (or mean) of the two-sided t test (the `tTest` row). Default `0`. */
    mu?: number;
    /** `"raw"` (default): the bounds are in the units of the data; `"SMD"`: in units of the standardised difference. */
    eqboundType?: "raw" | "SMD" | (string & {});
    /** Hedges' small-sample correction J of the standardised difference (g instead of d). Default `true`. */
    biasCorrection?: boolean;
    /** Paired samples: standardise by the SD of the differences over sqrt(2(1 − r)) (d_rm). Default `false`. */
    rmCorrection?: boolean;
    /** `"glass1"` or `"glass2"`: Glass's delta, standardised by the SD of the first or second sample. */
    glass?: "glass1" | "glass2" | (string & {});
    /** Interval of the standardised difference: `"nct"` (default), `"goulet"`, `"t"` or `"z"`. */
    smdCi?: "nct" | "goulet" | "t" | "z" | (string & {});
}
/**
 * Summary statistics for {@link tsumTOST}. One sample: `m1`, `sd1`, `n1`; two samples: also `m2`, `sd2`, `n2`;
 * paired samples (option `paired`): also `r12`, the correlation of the pairs.
 *
 * @category Hypothesis tests
 */
export interface TsumTOSTStatistics {
    /** Mean of the first sample. */
    m1: number;
    /** Standard deviation of the first sample. */
    sd1: number;
    /** Size of the first sample. */
    n1: number;
    /** Mean of the second sample. */
    m2?: number;
    /** Standard deviation of the second sample. */
    sd2?: number;
    /** Size of the second sample. */
    n2?: number;
    /** Paired samples: the correlation of the pairs. */
    r12?: number;
}
/**
 * One t test of {@link TTOSTResult}.
 *
 * @category Hypothesis tests
 */
export interface TTOSTTest {
    /** The t statistic. */
    t: number;
    /** Standard error of the difference (or mean). */
    se: number;
    /** Degrees of freedom. */
    df: number;
    /** p-value. */
    pValue: number;
}
/**
 * Result of {@link tTOST} and {@link tsumTOST}.
 *
 * @category Hypothesis tests
 */
export interface TTOSTResult {
    /** The two-sided t test of the difference against `mu` (TOSTER's "t-test" row). */
    tTest: TTOSTTest;
    /** The test of the lower bound: alternative "greater" (EQU) or "less" (MET). */
    lower: TTOSTTest;
    /** The test of the upper bound: alternative "less" (EQU) or "greater" (MET). */
    upper: TTOSTTest;
    /** The p-value of the TOST: the larger (EQU) or the smaller (MET) of the p-values of `lower` and `upper`. */
    pValue: number;
    /** The bounds `[low, high]` in the units of the data (`raw`) and of the standardised difference (`smd`). */
    bounds: {
        /** `[low, high]` in the units of the data. */
        raw: [number, number];
        /** `[low, high]` in the units of the standardised difference. */
        smd: [number, number];
    };
    /** The raw effect, the difference minus `mu`: estimate, standard error and 1 − 2 alpha interval. */
    raw: {
        /** The difference minus `mu`. */
        estimate: number;
        /** Its standard error. */
        se: number;
        /** Its 1 − 2 alpha interval. */
        confInt: [number, number];
    };
    /**
     * The standardised mean difference: its label (`"Hedges's g(av)"`, `"Cohen's d"`, `"Hedges's g(z)"`, `"Glass's
     * delta(g)"`, ...), estimate, standard error, 1 − 2 alpha interval, the degrees of freedom of its interval and the
     * bias correction J (1 without it).
     */
    smd: {
        /** The name of the standardised difference, such as `"Hedges's g(av)"`. */
        label: string;
        /** The estimate. */
        estimate: number;
        /** Its standard error. */
        se: number;
        /** Its 1 − 2 alpha interval. */
        confInt: [number, number];
        /** The degrees of freedom of the interval. */
        df: number;
        /** The bias correction J (1 without it). */
        J: number;
    };
    /** `1 - 2 alpha`. */
    confLevel: number;
    /** The t test's method (`"Welch Two Sample t-test"`, `" Two Sample t-test"`, `"Paired t-test"`, `"One Sample t-test"`). */
    method: string;
    /** `"EQU"` or `"MET"`. */
    hypothesis: "EQU" | "MET";
    /** TOSTER's notes, as warnings. */
    warnings: string[];
}
/**
 * Two one-sided t tests (TOST) of equivalence, or minimal-effect tests, for one sample, two samples or paired samples,
 * with the standardised mean difference and its interval. Equivalent to `TOSTER::t_TOST()` in R.
 *
 * With `hypothesis: "EQU"` (the default) equivalence, low < difference < high, is shown at level alpha when both the
 * test of the lower bound (alternative "greater") and that of the upper bound (alternative "less") reject; the
 * p-value is the larger of the two. With `"MET"` the alternatives are reversed and the p-value is the smaller. The
 * effect is the difference minus `mu`: mean(x) - mean(y) - mu (two samples, Welch's or pooled), the mean of x - y
 * minus mu (paired) or the mean of x minus mu (one sample). The bounds, the raw estimate and interval and the
 * standardised difference all refer to that effect. The intervals are 1 - 2 alpha intervals (90% for the default alpha
 * 0.05).
 *
 * The standardised difference is Hedges' g (Cohen's d without `biasCorrection`) with the average SD
 * `sqrt((s1² + s2²)/2)` for Welch's test, the pooled SD with `varEqual`, the SD of the differences for paired samples
 * (d_z, or d_rm with `rmCorrection`), the SD of one sample with `glass`, or the SD for one sample. Its interval is from
 * the noncentral t (`"nct"`, as exact roots; TOSTER's optimiser is about 1e-9 accurate), Goulet-Pelletier and
 * Cousineau's (`"goulet"`), or `g -+ q se` with a t or normal quantile (`"t"`, `"z"`).
 *
 * Differences from TOSTER (decisions 20-23 of oracle/methodcomparison-behaviour.md): `mu` is subtracted everywhere
 * (TOSTER tests the bounds on the difference itself, gives the raw interval of the difference, the two-sample SMD of
 * the difference plus mu and the paired SMD without mu); the one-sample `"t"` and `"z"` intervals of the standardised
 * difference are 1 - 2 alpha intervals (TOSTER's 1 - alpha); TOSTER's notes are warnings; alpha must be in (0, 0.5).
 * With `mu` 0 only the last three apply.
 *
 * With 2 observations (df 1) Hedges' correction J(1) is 0: the bias-corrected standardised difference is 0 (and its
 * `"nct"` interval), and some of its standard errors and intervals are NaN or infinite, as TOSTER's formulas give.
 *
 * @param x Sample (NaN values are dropped; for paired samples, the pairs with a NaN).
 * @param y Second sample (omit for one sample).
 * @param options See {@link TTOSTOptions}; the bounds are required.
 * @returns See {@link TTOSTResult}.
 * @throws TypeError without bounds, for options of the wrong type, or for samples that are not arrays of numbers
 *   (`null` or strings in them); RangeError for infinite values, alpha outside (0, 0.5), bounds that are not finite or
 *   in the wrong order, an unknown choice, or fewer than 2 observations in a sample; Error where the t test has too
 *   few observations or the data are essentially constant.
 *
 * @example
 * ```ts
 * const r = tTOST([5.1, 4.9, 5.6, 5.8, 6.0, 5.4, 5.2, 6.1], [5.3, 5.0, 5.5, 5.7, 5.9, 5.2, 4.8, 5.6, 5.0], { eqb: 0.5 });
 * r.pValue;      // 0.06280707532313813
 * r.raw.confInt; // [-0.16777332363212605, 0.5261066569654603] (90%)
 * r.smd.label;   // "Hedges's g(av)"
 * ```
 *
 * @category Hypothesis tests
 */
export declare function tTOST(x: Sample, y?: Sample, options?: TTOSTOptions): TTOSTResult;
/**
 * {@link tTOST} from summary statistics: means, standard deviations, sample sizes and, for paired samples, the
 * correlation of the pairs. Equivalent to `TOSTER::tsum_TOST()` in R.
 *
 * The tests and effect sizes are those of tTOST for data with these summaries (Welch's or pooled for two samples;
 * paired from the SD of the differences sqrt(sd1² + sd2² - 2 r12 sd1 sd2)). The one-sided p-values are upper tails
 * where TOSTER takes `1 - pt(t, df)`, so small ones keep their digits. For paired samples with n1 != n2 the smaller
 * is used, with TOSTER's warning `Unequal number of pairs; using smallest n`.
 *
 * @param stats See {@link TsumTOSTStatistics}.
 * @param options See {@link TTOSTOptions}; the bounds are required.
 * @returns See {@link TTOSTResult}.
 * @throws RangeError for sizes below 2 (or not integers), standard deviations that are not positive, a correlation
 *   outside (-1, 1), missing statistics of the second sample, or the errors of {@link tTOST}'s options.
 *
 * @example
 * ```ts
 * const r = tsumTOST({ m1: 5.5125, sd1: 0.4357, n1: 8, m2: 5.3333, sd2: 0.3536, n2: 9 }, { eqb: 0.5 });
 * r.pValue;      // 0.060568376615229305
 * r.smd.confInt; // [-0.35185844793775967, 1.1906849789772087]
 * ```
 *
 * @category Hypothesis tests
 */
export declare function tsumTOST(stats: TsumTOSTStatistics, options?: TTOSTOptions): TTOSTResult;
