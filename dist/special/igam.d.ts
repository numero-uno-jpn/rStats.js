/** sum_n x^n / ((a + 1) ... (a + n)): P(a, x) = x^a e^-x / Gamma(a + 1) times this */
export declare function igamSeriesSum(a: number, x: number): number;
export declare function igamSeriesSumDD(a: number, x: number): number;
/** The continued fraction of DLMF 8.9.2: Q(a, x) = x^a e^-x / Gamma(a) times this */
export declare function igamcContinuedFractionValue(a: number, x: number): number;
/**
 * Return [log, linear] of gammaInc from a single series/continued-fraction computation.
 * The values are bit-identical to gammaInc(.., true) and gammaInc(.., false) respectively
 * (used by the Newton iteration for quantiles, which needs both at the same x)
 */
export declare function gammaIncBoth(a: number, x: number, lower: boolean): [number, number];
/**
 * Regularized incomplete gamma function: P(a, x) if lower, otherwise Q(a, x).
 * Returns the natural log if log.
 */
export declare function gammaInc(a: number, x: number, lower: boolean, log: boolean): number;
