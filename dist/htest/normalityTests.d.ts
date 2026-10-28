import type { HTest, Sample } from "./types.js";
/**
 * Result of a normality test: no `alternative`, as nortest returns none.
 *
 * @category Hypothesis tests
 */
export type NormalityTestResult = Omit<HTest, "alternative">;
/**
 * Result of {@link cvmTest}, with nortest's warning for a p-value below the approximation's range.
 *
 * @category Hypothesis tests
 */
export interface CvmTestResult extends NormalityTestResult {
    /** Warnings, as nortest gives them (empty when there are none). */
    warnings: string[];
}
/**
 * Anderson-Darling test for normality. Equivalent to `nortest::ad.test()` in R. `NaN` values are dropped; at least 8
 * values are needed.
 *
 * @example
 * ```ts
 * adTest([2.1, 3.4, 1.9, 5.6, 4.4, 3.8, 2.9, 4.1, 3.3, 2.6]).statistic; // 0.15414195923525043
 * ```
 *
 * @category Hypothesis tests
 */
export declare function adTest(x: Sample): NormalityTestResult;
/**
 * Cramer-von Mises test for normality. Equivalent to `nortest::cvm.test()` in R. `NaN` values are dropped; at least 8
 * values are needed.
 *
 * @example
 * ```ts
 * const x = [2.1, 3.4, 1.9, 5.6, 4.4, 3.3, 2.8, 4.1, 3.9, 6.2];
 * cvmTest(x).pValue; // 0.8725514730213816
 * ```
 *
 * @category Hypothesis tests
 */
export declare function cvmTest(x: Sample): CvmTestResult;
/**
 * Lilliefors (Kolmogorov-Smirnov) test for normality. Equivalent to `nortest::lillie.test()` in R. `NaN` values are
 * dropped; at least 5 values are needed.
 *
 * @example
 * ```ts
 * const x = [2.1, 3.4, 1.9, 5.6, 4.4, 3.3, 2.8, 4.1, 3.9, 6.2];
 * lillieTest(x).pValue; // 0.9287268902599117
 * ```
 *
 * @category Hypothesis tests
 */
export declare function lillieTest(x: Sample): NormalityTestResult;
/**
 * Shapiro-Francia test for normality. Equivalent to `nortest::sf.test()` in R. `NaN` values are dropped; the sample
 * size must be between 5 and 5000.
 *
 * @example
 * ```ts
 * const x = [2.1, 3.4, 1.9, 5.6, 4.4, 3.3, 2.8, 4.1, 3.9, 6.2];
 * sfTest(x).pValue; // 0.8583583366365347
 * ```
 *
 * @category Hypothesis tests
 */
export declare function sfTest(x: Sample): NormalityTestResult;
/**
 * Options for {@link pearsonTest}.
 *
 * @category Hypothesis tests
 */
export interface PearsonTestOptions {
    /** Number of classes. Default `ceil(2 n^(2/5))`. */
    nClasses?: number;
    /** Subtract the 2 estimated parameters from the degrees of freedom. Default `true`. */
    adjust?: boolean;
}
/**
 * Pearson chi-square test for normality, with classes of equal probability under the fitted normal distribution.
 * Equivalent to `nortest::pearson.test()` in R. `NaN` values are dropped.
 *
 * @example
 * ```ts
 * const x = [2.1, 3.4, 1.9, 5.6, 4.4, 3.3, 2.8, 4.1, 3.9, 6.2];
 * pearsonTest(x).pValue; // 0.8494670333918255
 * ```
 *
 * @category Hypothesis tests
 */
export declare function pearsonTest(x: Sample, options?: PearsonTestOptions): NormalityTestResult;
