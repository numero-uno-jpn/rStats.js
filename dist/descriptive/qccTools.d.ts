import { type QccResult } from "./qcc.js";
/**
 * Options for {@link ocCurves}.
 * @category Descriptive statistics
 */
export interface OcCurvesOptions {
    /** Group sizes of the curves (xbar, R, S; default the chart's size and 1 or 2, 5, 10, 15, 20). */
    n?: readonly number[];
    /** Shifts of the mean in sigma units (xbar) or ratios of the new sigma (R, S). */
    c?: readonly number[];
    /** The number of sigmas of the limits (default the chart's; probability limits when the chart has them). */
    nsigmas?: number;
}
/**
 * Result of {@link ocCurves}: the probability of not signalling (type II error) for a shift of the process.
 * @category Descriptive statistics
 */
export interface OcCurvesResult {
    /** The chart type. */
    type: QccResult["type"];
    /** xbar, R, S: one row per shift (`c`), one column per size (`n`). p, np, c, u: one value per point of `grid`. */
    beta: number[] | number[][];
    /** The shifts (xbar: of the mean in sigma units, R and S: ratios of sigma); empty for p, np, c, u. */
    c: number[];
    /** The group sizes of the columns; empty for p, np, c, u. */
    n: number[];
    /** p, np: the proportions 0, 0.01, ..., 1; c, u: the means 0, 1, ... of the counts; empty for xbar, R, S. */
    grid: number[];
    /** R's warnings. */
    warnings: string[];
}
/**
 * Operating characteristic curves of a chart: the probability that a group's statistic stays within the limits after
 * a shift of the process. For xbar: the normal model with limits `+- L` (L = nsigmas or the quantile of the
 * chart's confidence level); R and S: for each size its own limits (with sigma 1) under a scale change, from the
 * range distribution (ptukey) and chi-square; p and np: the binomial over p = 0, 0.01, ..., 1 with the chart's
 * limits; c: the Poisson over 0, 1, ..., ceiling(c + 10 sqrt(c)); u: the c curve of the counts (limits times n) over
 * 0, ..., ceiling(n u + 10 sqrt(u)). Equal group sizes only.
 *
 * Equivalent to `qcc::oc.curves()` in R.
 *
 * @param chart a result of {@link qcc}
 * @category Descriptive statistics
 */
export declare function ocCurves(chart: QccResult, options?: OcCurvesOptions): OcCurvesResult;
/**
 * Options for {@link processCapability}.
 * @category Descriptive statistics
 */
export interface ProcessCapabilityOptions {
    /** The target (default the middle of the specification limits). */
    target?: number;
    /** The within-group standard deviation (default the chart's). */
    stdDev?: number;
    /** The number of sigmas (default the chart's). */
    nsigmas?: number;
    /** The level of the confidence intervals (default 0.95). */
    confidenceLevel?: number;
}
/**
 * Result of {@link processCapability}.
 * @category Descriptive statistics
 */
export interface ProcessCapabilityResult {
    /** The number of observations. */
    nobs: number;
    /** The center of the chart. */
    center: number;
    /** The standard deviation used. */
    stdDev: number;
    /** The target. */
    target: number;
    /** [LSL, USL] (NaN for a missing one). */
    specLimits: [number, number];
    /** Cp, Cp_l, Cp_u, Cp_k, Cpm with their confidence limits. */
    indices: {
        /** "Cp", "Cp_l", "Cp_u", "Cp_k", "Cpm". */
        names: string[];
        /** The indices. */
        value: number[];
        /** The lower confidence limits. */
        lower: number[];
        /** The upper confidence limits. */
        upper: number[];
        /** The confidence level. */
        level: number;
    };
    /** The expected fractions below LSL and above USL under the normal model (values below 1e-4 as 0, as qcc). */
    exp: [number, number];
    /** The observed fractions below LSL and above USL. */
    obs: [number, number];
    /** R's warnings. */
    warnings: string[];
}
/**
 * Process capability indices of an xbar or xbar.one chart. They are Cp with Chou's limits, Cp_u and
 * Cp_k with Bissell's (the one-sided Cp_l and Cp_u with the one-sided quantile qnorm(conf)), Cpm with Boyles's
 * (nu = n (1 + d^2) / (1 + 2 d^2)). As qcc: with one specification limit missing, Cp, Cp_k and Cpm are NaN; expected fractions below 1e-4
 * are reported as 0.
 *
 * Equivalent to `qcc::process.capability()` in R.
 *
 * @param chart an xbar or xbar.one chart ({@link qcc})
 * @param specLimits [LSL, USL]; NaN for a one-sided specification
 * @category Descriptive statistics
 */
export declare function processCapability(chart: QccResult, specLimits: readonly [number, number] | readonly number[], options?: ProcessCapabilityOptions): ProcessCapabilityResult;
/**
 * Options for {@link mqcc}.
 * @category Descriptive statistics
 */
export interface MqccOptions {
    /** `"T2"` (subgrouped data, default when data is a list of matrices) or `"T2.single"` (one row per observation). */
    type?: "T2" | "T2.single";
    /** The center of the variables (default estimated). */
    center?: readonly number[];
    /** The covariance matrix of the variables (default estimated). */
    cov?: readonly (readonly number[])[];
    /** Compute the prediction (phase II) limits too (default false). */
    predLimits?: boolean;
    /** Further groups (rows) charted with the phase I center and covariance. */
    newdata?: readonly (readonly number[])[] | readonly (readonly (readonly number[])[])[];
    /** The confidence level of the limits (default (1 - 0.0027)^p). */
    confidenceLevel?: number;
}
/**
 * Result of {@link mqcc}.
 * @category Descriptive statistics
 */
export interface MqccResult {
    /** The chart. */
    type: "T2" | "T2.single";
    /** Hotelling's T2 of each group (row) of data. */
    statistics: number[];
    /** T2 of each group of newdata. */
    newstatistics: number[];
    /** The group means (T2) or the rows (T2.single). */
    means: number[][];
    /** The center of the variables. */
    center: number[];
    /** The covariance matrix of the variables. */
    cov: number[][];
    /** The phase I limits (LCL 0). */
    limits: {
        /** The lower limit, 0. */
        lcl: number;
        /** The upper limit. */
        ucl: number;
    };
    /** The prediction (phase II) limits, or null. */
    predLimits: {
        /** The lower limit, 0. */
        lcl: number;
        /** The upper limit. */
        ucl: number;
    } | null;
    /** The confidence level of the limits. */
    confidenceLevel: number;
    /** 1-based indices over data and newdata. */
    violations: {
        /** The points above the phase I limit. */
        beyondLimits: number[];
        /** The points above the prediction limit (empty without prediction limits). */
        beyondPredLimits: number[];
    };
    /** R's warnings. */
    warnings: string[];
}
/**
 * A multivariate control chart of Hotelling's T2. It charts T2 of subgroup means (`"T2"`: data a list with one matrix
 * per variable, rows = groups) or of individual observations (`"T2.single"`: one row per observation, one column per
 * variable), with the phase I limits (F for T2, Beta for T2.single) and optionally the prediction limits.
 *
 * Equivalent to `qcc::mqcc()` in R.
 * @category Descriptive statistics
 */
export declare function mqcc(data: readonly (readonly number[])[] | readonly (readonly (readonly number[])[])[], options?: MqccOptions): MqccResult;
/**
 * Options for {@link qccOverdispersionTest}.
 * @category Descriptive statistics
 */
export interface QccOverdispersionTestOptions {
    /** The sample sizes (binomial data). */
    size?: number | readonly number[];
    /** `"binomial"` (default when sizes are given) or `"poisson"`. */
    type?: "binomial" | "poisson";
}
/**
 * Result of {@link qccOverdispersionTest}.
 * @category Descriptive statistics
 */
export interface QccOverdispersionTestResult {
    /** The distribution tested. */
    type: "binomial" | "poisson";
    /** The observed variance over the theoretical variance. */
    ratio: number;
    /** ratio (k - 1). */
    statistic: number;
    /** The degrees of freedom, k - 1. */
    df: number;
    /** 1 - pchisq(statistic, df) (qcc rounds it to 5 significant digits; this is the full value). */
    pValue: number;
}
/**
 * The overdispersion test for binomial or Poisson counts. It refers D = var(x) / theoretical
 * variance * (k - 1) against chi-square on k - 1 degrees of freedom; the theoretical variance is mean(size) p (1 - p)
 * with p = sum(x) / sum(size), or mean(x).
 *
 * Equivalent to `qcc::qcc.overdispersion.test()` in R.
 * @category Descriptive statistics
 */
export declare function qccOverdispersionTest(x: readonly number[], options?: QccOverdispersionTestOptions): QccOverdispersionTestResult;
/**
 * Result of {@link paretoChart}.
 * @category Descriptive statistics
 */
export interface ParetoChartResult {
    /** The categories in decreasing order of frequency (ties in the given order). */
    names: string[];
    /** The frequencies. */
    frequency: number[];
    /** The cumulative frequencies. */
    cumFrequency: number[];
    /** The percentages of the total. */
    percentage: number[];
    /** The cumulative percentages. */
    cumPercentage: number[];
}
/**
 * The table of a Pareto chart without the plot: frequencies in decreasing order with the
 * cumulative frequencies and percentages. Unnamed data are named A, B, C, ...
 *
 * Equivalent to `qcc::pareto.chart()` in R.
 * @category Descriptive statistics
 */
export declare function paretoChart(data: readonly number[] | Readonly<Record<string, number>>, names?: readonly string[]): ParetoChartResult;
/**
 * Result of {@link qccGroups}.
 * @category Descriptive statistics
 */
export interface QccGroupsResult {
    /** The sample values, sorted: the names of the rows. */
    names: string[];
    /** One row per sample, the values in order of appearance, NaN to fill. */
    groups: number[][];
}
/**
 * Groups data by a sample indicator into one row per sample, for {@link qcc}.
 *
 * Equivalent to `qcc::qcc.groups()` in R.
 * @category Descriptive statistics
 */
export declare function qccGroups(data: readonly number[], sample: readonly (number | string)[]): QccGroupsResult;
/**
 * Result of {@link medianChart}.
 * @category Descriptive statistics
 */
export interface MedianChartResult {
    /** The groups in order of first appearance. */
    groups: string[];
    /** The group size. */
    n: number;
    /** The group medians. */
    medians: number[];
    /** The group ranges. */
    ranges: number[];
    /** The median chart: center (mean of the medians) and limits center +- A4 Rbar. */
    median: {
        /** The mean of the medians. */
        center: number;
        /** center - A4 Rbar. */
        lcl: number;
        /** center + A4 Rbar. */
        ucl: number;
        /** 1-based indices of the groups whose median is outside the limits. */
        outOfControl: number[];
    };
    /** The range chart: center Rbar and limits D3 Rbar, D4 Rbar. */
    range: {
        /** The mean range Rbar. */
        center: number;
        /** D3 Rbar. */
        lcl: number;
        /** D4 Rbar. */
        ucl: number;
        /** 1-based indices of the groups whose range is outside the limits. */
        outOfControl: number[];
    };
}
/**
 * The median chart (Me-R chart) of subgroups of equal size 2 to 10, with the JIS factors A4, D3, D4: medians charted
 * around the mean median with limits `+- A4 Rbar`, ranges around Rbar with limits `D3 Rbar`, `D4 Rbar` (the procedure of
 * ReactiveStat; not in qcc). Unequal group sizes are an error.
 *
 * Not an R function. qcc has no median chart; this is the procedure of ReactiveStat with the JIS factors.
 *
 * @param values the observations
 * @param groups the subgroup of each observation (groups in order of first appearance)
 * @category Descriptive statistics
 */
export declare function medianChart(values: readonly number[], groups: readonly (string | number)[]): MedianChartResult;
