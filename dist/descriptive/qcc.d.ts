/**
 * The type of a Shewhart chart (qcc's `type`): group means `"xbar"`, ranges `"R"`, standard deviations `"S"`,
 * individual values `"xbar.one"`, proportion `"p"` and number `"np"` of nonconforming units, nonconformities `"c"` and
 * nonconformities per unit `"u"`, and the number of non-events between events `"g"`.
 * @category Descriptive statistics
 */
export type QccType = "xbar" | "R" | "S" | "xbar.one" | "p" | "np" | "c" | "u" | "g";
/**
 * A method of estimating the process standard deviation (qcc's `std.dev`): from the group ranges `"UWAVE-R"`,
 * `"MVLUE-R"`, from the group standard deviations `"UWAVE-SD"`, `"MVLUE-SD"`, `"RMSDF"` (grouped data), from the moving
 * ranges `"MR"` or the standard deviation `"SD"` (individual values).
 * @category Descriptive statistics
 */
export type QccStdDevMethod = "UWAVE-R" | "UWAVE-SD" | "MVLUE-R" | "MVLUE-SD" | "RMSDF" | "MR" | "SD";
/**
 * Data of a control chart: one value per group (a vector), or one row per group (a matrix as an array of rows; `null`
 * or `NaN` for a missing value, so that the groups may differ in size).
 * @category Descriptive statistics
 */
export type QccData = readonly (number | null)[] | readonly (readonly (number | null)[])[];
/**
 * Options for {@link qcc}.
 * @category Descriptive statistics
 */
export interface QccOptions {
    /** The chart (required). */
    type: QccType;
    /**
     * The group sizes: one number for all groups or one per group. Required for `"p"`, `"np"` and `"u"`; for a matrix
     * the sizes are the numbers of non-missing values of the rows.
     */
    sizes?: number | readonly number[];
    /** The center (target) of the statistic; estimated from the data when not given. */
    center?: number;
    /**
     * The process standard deviation, or the method that estimates it. Defaults: `"UWAVE-R"` for xbar (`"RMSDF"` when a
     * group is larger than 25, as qcc) and R, `"UWAVE-SD"` for S, `"MR"` for xbar.one.
     */
    stdDev?: number | QccStdDevMethod;
    /** Control limits `[LCL, UCL]` to use instead of computing them. */
    limits?: readonly [number, number];
    /** Further groups charted with the center, standard deviation and limits of `data` (qcc's `newdata`). */
    newdata?: QccData;
    /** The sizes of the groups of `newdata` (default: as `sizes` when that is one number). */
    newsizes?: number | readonly number[];
    /** Labels of the groups (and of the groups of `newdata`, `newlabels`). */
    labels?: readonly string[];
    /** Labels of the groups of `newdata`. */
    newlabels?: readonly string[];
    /** The number of standard deviations of the limits (default 3); ignored when `confidenceLevel` is given. */
    nsigmas?: number;
    /** A probability in (0, 1): probability limits at this level instead of `nsigmas`. */
    confidenceLevel?: number;
    /** The length of a run on one side of the center that signals (default 7, qcc's `run.length` option). */
    runLength?: number;
    /** The number of points of the moving ranges for xbar.one with `"MR"` (default 2, qcc's `k`). */
    k?: number;
}
/**
 * The points out of control (qcc's `violations`): 1-based indices over the groups of `data` followed by those of
 * `newdata`.
 * @category Descriptive statistics
 */
export interface QccViolations {
    /** The points above the upper limit, in order, then those below the lower limit (as qcc). */
    beyondLimits: number[];
    /** The points that are the `runLength`-th or a later point of a run strictly on one side of the center. */
    violatingRuns: number[];
}
/**
 * Result of {@link qcc}.
 * @category Descriptive statistics
 */
export interface QccResult {
    /** The chart. */
    type: QccType;
    /** The charted statistic of each group of `data`. */
    statistics: number[];
    /** The group sizes. */
    sizes: number[];
    /** The center: one number, or one per group for an np chart with unequal sizes. */
    center: number | number[];
    /** The process standard deviation (one per group for an np chart with unequal sizes). */
    stdDev: number | number[];
    /** The method that estimated `stdDev`, or `null` when it was given or follows from the center. */
    stdDevMethod: QccStdDevMethod | null;
    /**
     * The control limits: one pair when all groups (of `data` and `newdata`) have the same size, else one pair per group
     * of `data` followed by those of `newdata`.
     */
    limits: {
        /** The lower control limits. */
        lcl: number[];
        /** The upper control limits. */
        ucl: number[];
    };
    /** `nsigmas`, or `null` for probability limits. */
    nsigmas: number | null;
    /** The level of probability limits, or `null`. */
    confidenceLevel: number | null;
    /** The statistic of each group of `newdata` (empty without newdata). */
    newstatistics: number[];
    /** The sizes of the groups of `newdata`. */
    newsizes: number[];
    /** Labels of the groups (and of newdata), or `null`. */
    labels: string[] | null;
    /** The points out of control. */
    violations: QccViolations;
    /** The data of the chart, as groups (one value per group for vector data); used by {@link processCapability}. */
    data: number[][];
    /** The run length used for `violations`. */
    runLength: number;
    /** R's warnings. */
    warnings: string[];
}
/** d2(n), NaN outside the table (n above 25, as qcc) */
export declare function d2(n: number): number;
/** d3(n), NaN outside the table (n above 50) */
export declare function d3(n: number): number;
/** c4(n) = sqrt(2 / (n - 1)) Gamma(n / 2) / Gamma((n - 1) / 2) */
export declare function c4(n: number): number;
/**
 * The points out of control of charted statistics: those beyond the limits and those in long runs on one side of the
 * center. The limits are one pair for all points or one per point. An NA statistic is left out of both lists (qcc puts
 * NA into them) and ends a run.
 *
 * Equivalent to `qcc::shewhart.rules()` in R.
 * @category Descriptive statistics
 */
export declare function shewhartRules(statistics: readonly number[], center: number | readonly number[], limits: {
    lcl: readonly number[];
    ucl: readonly number[];
}, options?: {
    runLength?: number;
}): QccViolations;
/**
 * A Shewhart control chart without the plot: the charted statistics, the center, the process standard deviation, the
 * control limits and the points out of control. The charts:
 *
 * - xbar, R, S: data one row per group; sigma by UWAVE-R (default), MVLUE-R, UWAVE-SD, MVLUE-SD or RMSDF, the
 *   centers weighted by the group sizes; R limits `center +- k d3(n) sigma`, S limits `center +- k sigma
 *   sqrt(1 - c4(n)^2)`; probability limits from the range distribution (qtukey) and from chi-square.
 * - xbar.one: individual values, sigma from moving ranges (MR) or the standard deviation (SD).
 * - p, np, c, u, g: counts; limits from the binomial, Poisson and geometric models.
 *
 * As qcc: a group of size 1 is an error when sigma is estimated; groups larger than 25 switch the default of the xbar
 * chart to RMSDF and give NA limits for the R chart (no d2 / d3 there); unequal sizes are an error for the c chart.
 * Unlike qcc, NA statistics are left out of the violation indices.
 *
 * Equivalent to `qcc::qcc()` in R.
 *
 * @param data one value per group, or one row per group
 * @param options the chart `type` and the options of qcc
 * @category Descriptive statistics
 */
export declare function qcc(data: QccData, options: QccOptions): QccResult;
/**
 * Options for {@link cusum}.
 * @category Descriptive statistics
 */
export interface CusumOptions {
    /** The group sizes (individual values: 1). */
    sizes?: number | readonly number[];
    /** The target (default: the center of the xbar or xbar.one chart of the data). */
    center?: number;
    /** The process standard deviation or the method that estimates it (as {@link qcc}). */
    stdDev?: number | QccStdDevMethod;
    /** The initial cumulative sums, in standard errors (default 0; must be in [0, decisionInterval)). */
    headStart?: number;
    /** The number of standard errors at which a cumulative sum signals (default 5). */
    decisionInterval?: number;
    /** The shift to detect, in standard errors (default 1); the reference value is half of it. */
    seShift?: number;
    /** Further groups whose sums continue those of `data`. */
    newdata?: QccData;
    /** The sizes of the groups of `newdata`. */
    newsizes?: number | readonly number[];
}
/**
 * Result of {@link cusum}.
 * @category Descriptive statistics
 */
export interface CusumResult {
    /** The group means (or values) of data. */
    statistics: number[];
    /** The group means (or values) of newdata. */
    newstatistics: number[];
    /** The sizes of data and newdata. */
    sizes: number[];
    /** The target. */
    center: number;
    /** The process standard deviation. */
    stdDev: number;
    /** The upper cumulative sums C+. */
    pos: number[];
    /** The lower cumulative sums as non-positive values (-C-, as qcc). */
    neg: number[];
    /** The initial cumulative sums, in standard errors. */
    headStart: number;
    /** The decision interval, in standard errors. */
    decisionInterval: number;
    /** The shift to detect, in standard errors. */
    seShift: number;
    /** Indices (1-based) where -neg or pos exceeds the decision interval. */
    violations: {
        /** Where -neg exceeds it (a decrease). */
        lower: number[];
        /** Where pos exceeds it (an increase). */
        upper: number[];
    };
    /** R's warnings. */
    warnings: string[];
}
/**
 * A cusum chart: the tabular cumulative sums of the standardized group means or individual values above and below the
 * target. The reference value is `seShift / 2`; a sum beyond the decision interval signals.
 *
 * Equivalent to `qcc::cusum()` in R.
 *
 * @param data one row per group, or individual values
 * @category Descriptive statistics
 */
export declare function cusum(data: QccData, options?: CusumOptions): CusumResult;
/**
 * Options for {@link ewma}.
 * @category Descriptive statistics
 */
export interface EwmaOptions {
    /** The group sizes (individual values: 1). */
    sizes?: number | readonly number[];
    /** The target and starting value (default: the center of the xbar or xbar.one chart of the data). */
    center?: number;
    /** The process standard deviation or the method that estimates it (as {@link qcc}). */
    stdDev?: number | QccStdDevMethod;
    /** The smoothing parameter in [0, 1] (default 0.2). */
    lambda?: number;
    /** The number of standard deviations of the limits (default 3). */
    nsigmas?: number;
    /** Further groups smoothed on from `data`. */
    newdata?: QccData;
    /** The sizes of the groups of `newdata`. */
    newsizes?: number | readonly number[];
}
/**
 * Result of {@link ewma}.
 * @category Descriptive statistics
 */
export interface EwmaResult {
    /** The group means (or values) of data. */
    statistics: number[];
    /** The group means (or values) of newdata. */
    newstatistics: number[];
    /** The sizes of data and newdata. */
    sizes: number[];
    /** The target and starting value. */
    center: number;
    /** The process standard deviation. */
    stdDev: number;
    /** The smoothed values. */
    y: number[];
    /** The standard deviation of each smoothed value (qcc's closed form with each point's own size). */
    sigma: number[];
    /** The smoothing parameter. */
    lambda: number;
    /** The number of standard deviations of the limits. */
    nsigmas: number;
    /** The limits of each point. */
    limits: {
        /** The lower control limits of each point. */
        lcl: number[];
        /** The upper control limits of each point. */
        ucl: number[];
    };
    /** Indices (1-based) of the points outside their limits. */
    violations: number[];
    /** R's warnings. */
    warnings: string[];
}
/**
 * An EWMA chart: the exponentially weighted moving average of the group means or individual values, started at the
 * center. The limits are `center +- nsigmas sigma_i` with `sigma_i = sd / sqrt(n_i) sqrt(lambda / (2 - lambda)
 * (1 - (1 - lambda)^(2 i)))`, qcc's form, with each point's own size also when the sizes differ.
 *
 * Equivalent to `qcc::ewma()` in R.
 *
 * @param data one row per group, or individual values
 * @category Descriptive statistics
 */
export declare function ewma(data: QccData, options?: EwmaOptions): EwmaResult;
/**
 * Options for {@link ewmaSmooth}.
 * @category Descriptive statistics
 */
export interface EwmaSmoothOptions {
    /** The smoothing parameter (default 0.2). */
    lambda?: number;
    /** The starting value (default: the first y in the order of x). */
    start?: number;
}
/**
 * Result of {@link ewmaSmooth}.
 * @category Descriptive statistics
 */
export interface EwmaSmoothResult {
    /** x sorted. */
    x: number[];
    /** The smoothed y in the order of x. */
    y: number[];
    /** The smoothing parameter. */
    lambda: number;
    /** The starting value. */
    start: number;
}
/**
 * EWMA smoothing of y in the order of x. It computes `z_t = lambda y_t + (1 - lambda) z_{t-1}` from `z_0 = start`.
 *
 * Equivalent to `qcc::ewmaSmooth()` in R.
 * @category Descriptive statistics
 */
export declare function ewmaSmooth(x: readonly number[], y: readonly number[], options?: EwmaSmoothOptions): EwmaSmoothResult;
