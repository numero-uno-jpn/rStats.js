import { type DD } from "../special/dd.js";
/**
 * Running sum of finite values in double-double that does not overflow: its value is (s[0] + s[1]) 2^shift. shift
 * is 0 until an addition would overflow; from then on the values are added scaled by 2^-shift
 */
export interface WideSum {
    s: DD;
    shift: number;
}
export declare function wideSum(): WideSum;
/** Adds the finite value v to acc; n is the number of values the sum will have in all */
export declare function wideSumAdd(acc: WideSum, v: number, n: number): void;
/** The value of the sum rounded to double (±Infinity beyond the range) */
export declare function wideSumValue(acc: WideSum): number;
/** v 2^k for an integer k, in two steps so that 2^k itself does not overflow or underflow */
export declare function ldexp(v: number, k: number): number;
/** v 2^k for any integer k (beyond the +-2046 of ldexp), in steps of at most 2^1000 */
export declare function ldexpWide(v: number, k: number): number;
/** Mean as double-double. x contains no NaN and has length >= 1 */
export declare function meanDD(x: readonly number[]): DD;
export declare function mean(x: readonly number[]): number;
/** Unbiased variance. NaN for length below 2 (R's var gives NA) */
export declare function variance(x: readonly number[]): number;
/**
 * Sample standard deviation from the scaled deviations: sqrt(sum d^2 / (n - 1)) in the coordinates 2^-k, times 2^k.
 * The same bits as sqrt(variance(x)) where the variance is a normal number (the square root of 4^k y is 2^k sqrt(y)),
 * and the right value where it overflows or underflows (sd of c(-1e308, -1e308, -1e308, -1e308, 1.5e308) is 1.118e308
 * while its variance is 1.25e616). x contains no NaN
 */
export declare function standardDeviation(x: readonly number[]): number;
/** Unbiased covariance. x and y have the same length and contain no NaN */
export declare function covariance(x: readonly number[], y: readonly number[]): number;
/**
 * The deviations from the mean of x scaled by 2^-k (the scaling first, see the rules above), in double-double, with k
 * and the scaled mean. undefined when x has an infinite value (the mean is not finite)
 */
export declare function centered(x: readonly number[]): {
    d: DD[];
    k: number;
    mean: DD;
} | undefined;
/**
 * (x - mean) / sd, from the scaled deviations (no overflow or underflow at any scale). NaN values when the standard
 * deviation is 0 or x has fewer than 2 values or an infinite one
 */
export declare function standardize(x: readonly number[]): number[];
/**
 * Moments of groups on one common scale 2^-k (see the rules above): per group the size, mean, within sum of squares
 * and variance (NaN below 2 values), the grand mean, the between and pooled within sums of squares (accumulated in
 * double-double), and the scaled values. Means are scaled back by 2^k, sums of squares and variances by 2^2k
 */
export interface GroupMoments {
    k: number;
    groups: number[][];
    n: number[];
    mean: number[];
    ss: number[];
    variance: number[];
    grandMean: number;
    ssBetween: number;
    ssWithin: number;
}
export declare function groupMoments(groups: readonly (readonly number[])[]): GroupMoments;
/** x - y for paired values, both scaled by one 2^-k first (so the differences cannot overflow), with k */
export declare function pairedDifferences(x: readonly number[], y: readonly number[]): {
    d: number[];
    k: number;
};
/**
 * Satterthwaite's degrees of freedom (sum w)^2 / sum(w^2 / df) of a sum of independent variance estimates w with
 * degrees of freedom df. The w are scaled by a power of 2 first (no rounding), so the squares neither overflow nor
 * underflow when the w do not; the ratio does not depend on the units of the data. The form of irr's icc (the same
 * order of operations); tTest, cohensD and gamesHowellTest use R's forms below and this only where those are not finite
 */
export declare function satterthwaiteDf(w: readonly number[], df: readonly number[]): number;
/**
 * Welch's degrees of freedom in the form of R's t.test and effectsize: se^4 / sum(se_i^4 / df_i) with se_i = sqrt(w_i)
 * and se = sqrt(sum se_i^2), on the w scaled by an even power of 2 (exact, also through sqrt, so the same bits as R
 * wherever R's terms are in range, and no overflow). {@link satterthwaiteDf} where that is not finite and positive
 * (revision of review 2)
 */
export declare function satterthwaiteDfSe(w: readonly number[], df: readonly number[]): number;
/**
 * Welch's degrees of freedom in the form of PMCMRplus's gamesHowellTest: A^2 / sum(s2_i^2 / (n_i^2 (n_i - 1))) with
 * A = sum s2_i / n_i, for the group variances s2 and sizes n, scaled as {@link satterthwaiteDfSe} (revision of review 2)
 */
export declare function satterthwaiteDfPM(s2: readonly number[], n: readonly number[]): number;
/**
 * Sum (accumulated in double-double without overflow, then rounded; ±Infinity beyond the double range). With
 * infinite or NaN values, as in double arithmetic
 */
export declare function sum(x: readonly number[]): number;
/**
 * Ranks (ties get the average rank, R's rank(ties.method = "average")). x contains no NaN.
 * Equality is decided by exact comparison
 */
export declare function rank(x: readonly number[]): number[];
/** Size of each group of ties (only those of size 2 or more). x contains no NaN */
export declare function tieCounts(x: readonly number[]): number[];
/** Array with NaN removed (R's x[!is.na(x)]) */
export declare function dropNaN(x: readonly number[]): number[];
/** Keep only the pairs where neither x nor y is NaN (R's complete.cases) */
export declare function completePairs(x: readonly number[], y: readonly number[]): [number[], number[]];
/**
 * d^2 / e, as for a Pearson chi-squared term. When d^2 overflows (or loses precision below the normal range) although
 * the quotient is representable, it is formed as (d / sqrt(e))^2 instead
 */
export declare function squareOver(d: number, e: number): number;
/**
 * a b / n, as for an expected count from two margins. When the product overflows, underflows or is subnormal (with a
 * and b not 0), the three are scaled to [1, 2) by powers of 2 and the exponents added back at the end
 */
export declare function productOver(a: number, b: number, n: number): number;
/**
 * Data scaled by a power of 2, 2^-k, so that the largest finite absolute value is in [1, 2) (k = 0 when there is
 * none). The scaling adds no rounding error, so statistics that do not depend on the units (t, F, chi-squared,
 * ratios of variances, degrees of freedom) come out as from the original data, but their squares and variances
 * can no longer overflow or underflow. Quantities with units are multiplied back by 2^k (see ldexp)
 */
export declare function scaleToUnit(groups: readonly (readonly number[])[]): {
    groups: number[][];
    k: number;
};
/**
 * Euclidean norm sqrt(sum x_i^2): the plain sum where it is in range (so the value is unchanged there), otherwise from
 * the values divided by the largest |x_i| (as BLAS's dnrm2), so that squares of values around 1e200 or 1e-200 neither
 * overflow nor underflow
 */
export declare function norm2(x: readonly number[]): number;
