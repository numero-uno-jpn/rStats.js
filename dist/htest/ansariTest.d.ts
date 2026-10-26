import { type Alternative, type HTest, type Sample } from "./types.js";
/** Options for {@link ansariTest}. */
export interface AnsariTestOptions {
    /** Alternative hypothesis (unambiguous abbreviations accepted). Default `"two.sided"`. */
    alternative?: Alternative | "two" | "l" | "g";
    /** Exact p-value. Default: exact when both samples have fewer than 50 values and there are no ties. */
    exact?: boolean;
    /** Compute a confidence interval for the ratio of scales and its estimate (R's `conf.int`). Default `false`. */
    confInt?: boolean;
    /** Confidence level of the interval. Default `0.95`. */
    confLevel?: number;
}
/**
 * Ansari-Bradley test that two samples differ in scale. Equivalent to R's `ansari.test()`.
 * `NaN` values are dropped.
 *
 * With `confInt: true`, `confInt` is the interval for the ratio of the scales of `x` and `y` and `estimate` its
 * estimate, both computed with the locations taken as 0 (exact without ties when both samples have fewer than 50
 * values, otherwise by the normal approximation, whose limits are roots found to a tolerance of 1e-4 as in R). Limits
 * that cannot be formed (the samples differ in location) are `NaN`. With ties and `exact` unset or `true`, R fails
 * ("object 'cint' not found"); rStats.js returns the normal-approximation interval, as with `exact: false`.
 *
 * @example
 * ```ts
 * const r = ansariTest([-2, -1, 1, 2], [-4, -3, 3, 4], { confInt: true });
 * r.confInt;  // [0.25, 0.6666666666666666]
 * r.estimate; // 0.41666666666666663
 * ```
 */
export declare function ansariTest(x: Sample, y: Sample, options?: AnsariTestOptions): HTest;
