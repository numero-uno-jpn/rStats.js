/**
 * Alternative hypothesis of a test, as in R. Test options also accept unambiguous
 * abbreviations (`"two"`, `"l"`, `"g"`), like R's `match.arg()`.
 */
export type Alternative = "two.sided" | "less" | "greater";
/** A sample: an array of numbers. */
export type Sample = readonly number[] | Float64Array;
/** Counts: an array of numbers. A contingency table is passed as an array of rows. */
export type Counts = readonly number[] | Float64Array;
/**
 * Result of a hypothesis test: a plain object mirroring R's `htest` class.
 *
 * R's named values (`statistic`, `parameter`, `estimate`, `null.value`) are split into a
 * number and a separate `...Name` field. `estimate` is an array only when there are two
 * estimates (for example the two means of a two-sample t-test). `conf.int`'s
 * `conf.level` attribute becomes `confLevel`.
 */
export interface HTest {
    /** Description of the test, as R's `method` (e.g. `"Welch Two Sample t-test"`). */
    method: string;
    /** Alternative hypothesis, always in full form. */
    alternative: Alternative;
    /** Value of the test statistic (R's `statistic`). */
    statistic: number;
    /** Name of the test statistic (e.g. `"t"`, `"X-squared"`, `"V"`, `"W"`). */
    statisticName: string;
    /** Parameter of the null distribution of the statistic, such as degrees of freedom (R's `parameter`). */
    parameter?: number;
    /** Name of `parameter` (e.g. `"df"`). */
    parameterName?: string;
    /** p-value of the test (R's `p.value`). */
    pValue: number;
    /** Confidence interval `[lower, upper]` (R's `conf.int`). */
    confInt?: [number, number];
    /** Confidence level of `confInt` (R's `attr(conf.int, "conf.level")`). */
    confLevel?: number;
    /** Estimate(s) of the parameter being tested (R's `estimate`). */
    estimate?: number | number[];
    /** Name(s) of `estimate` (R's `names(estimate)`), e.g. `"mean of x"`. */
    estimateNames?: string | string[];
    /** Value of the parameter under the null hypothesis (R's `null.value`). */
    nullValue?: number;
    /** Name of `nullValue` (R's `names(null.value)`), e.g. `"difference in means"`. */
    nullValueName?: string;
}
/** Like R's match.arg, abbreviations ("two", "l", "g") are also accepted */
export declare function matchAlternative(a: string | undefined): Alternative;
/** Validate the confidence level (R's t.test also accepts exactly 0 and 1; with 1 the interval is ±Inf) */
export declare function checkConfLevel(level: number): void;
