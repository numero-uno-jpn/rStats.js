import { type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import type { Sample } from "./types.js";
/**
 * Options for {@link grubbsTest}.
 *
 * @category Hypothesis tests
 */
export interface GrubbsTestOptions {
    /** Grubbs test type. Only 10 is supported in 1.9.0. Default 10. */
    type?: 10 | 11 | 20;
    /** Test the lowest rather than the highest observation. Default false. */
    opposite?: boolean;
    /** Use a two-sided p-value. Default false. */
    twoSided?: boolean;
}
/**
 * Result of Grubbs' test for one outlier.
 *
 * @category Hypothesis tests
 */
export interface GrubbsTestResult {
    /** Description of the test (R's `method`). */
    method: string;
    /** Grubbs G and U statistics, in that order. */
    statistic: [number, number];
    /** Names corresponding to the two entries of `statistic`. */
    statisticName: ["G", "U"];
    /** P-value for the selected tail and sidedness. */
    pValue: number;
    /** Text description of the alternative hypothesis. */
    alternative: string;
    /** Warnings produced while evaluating the test. */
    warnings: string[];
}
/**
 * Cumulative distribution of the type-10 Grubbs statistic. Vectorised over q.
 * Equivalent to R's `outliers::pgrubbs()`. Type 10 only.
 *
 * @param q Statistic value(s).
 * @param n Sample size.
 * @param type Only 10 is supported; 11 and 20 are intentionally deferred.
 *
 * @category Distributions
 */
export declare function pgrubbs<T extends Vectorizable>(q: T, n: number, type?: number): VectorResult<T>;
/**
 * Quantile of the type-10 Grubbs statistic. Vectorised over p.
 * Equivalent to R's `outliers::qgrubbs()`. Type 10 only.
 *
 * @param p Probability value(s).
 * @param n Sample size.
 * @param type Only 10 is supported; 11 and 20 are intentionally deferred.
 *
 * @category Distributions
 */
export declare function qgrubbs<T extends Vectorizable>(p: T, n: number, type?: number): VectorResult<T>;
/**
 * Grubbs' test for one outlier. Type 10 selects the highest or lowest observation and reports G and U.
 * NaN observations are omitted; infinities are rejected. A constant sample has undefined statistics and p = NaN.
 *
 * Equivalent to R's `outliers::grubbs.test()`. Type 10 only.
 *
 * @param x Numeric sample.
 * @param options Type, tail and sidedness.
 *
 * @category Hypothesis tests
 */
export declare function grubbsTest(x: Sample, options?: GrubbsTestOptions): GrubbsTestResult;
