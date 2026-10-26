import type { HTest, Sample } from "./types.js";
/** Result of a normality test: no `alternative`, as nortest returns none. */
export type NormalityTestResult = Omit<HTest, "alternative">;
/** Result of {@link cvmTest}, with nortest's warning for a p-value below the approximation's range. */
export interface CvmTestResult extends NormalityTestResult {
    warnings: string[];
}
/**
 * Anderson-Darling test for normality. Equivalent to nortest's `ad.test()`. `NaN` values are dropped; at least 8
 * values are needed.
 *
 * @example
 * ```ts
 * adTest([2.1, 3.4, 1.9, 5.6, 4.4, 3.8, 2.9, 4.1, 3.3, 2.6]).statistic; // 0.15414195923525043
 * ```
 */
export declare function adTest(x: Sample): NormalityTestResult;
/**
 * Cramer-von Mises test for normality. Equivalent to nortest's `cvm.test()`. `NaN` values are dropped; at least 8
 * values are needed.
 */
export declare function cvmTest(x: Sample): CvmTestResult;
/**
 * Lilliefors (Kolmogorov-Smirnov) test for normality. Equivalent to nortest's `lillie.test()`. `NaN` values are
 * dropped; at least 5 values are needed.
 */
export declare function lillieTest(x: Sample): NormalityTestResult;
/**
 * Shapiro-Francia test for normality. Equivalent to nortest's `sf.test()`. `NaN` values are dropped; the sample size
 * must be between 5 and 5000.
 */
export declare function sfTest(x: Sample): NormalityTestResult;
/** Options for {@link pearsonTest}. */
export interface PearsonTestOptions {
    /** Number of classes. Default `ceil(2 n^(2/5))`. */
    nClasses?: number;
    /** Subtract the 2 estimated parameters from the degrees of freedom. Default `true`. */
    adjust?: boolean;
}
/**
 * Pearson chi-square test for normality, with classes of equal probability under the fitted normal distribution.
 * Equivalent to nortest's `pearson.test()`. `NaN` values are dropped.
 */
export declare function pearsonTest(x: Sample, options?: PearsonTestOptions): NormalityTestResult;
