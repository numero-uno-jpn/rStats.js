/**
 * The Shapiro-Wilk coefficients a_1..a_n for a sample of size n (3 <= n <= 5000), antisymmetric
 * (a_i = -a_(n+1-i)) with sum a_i^2 = 1.
 */
export declare function swilkCoefficients(n: number): Float64Array;
/**
 * 1 - W for a sample sorted in increasing order, formed as (r + c)(r - c) / r^2 from c = sum a_i (x_i - mean) and
 * r^2 = sum a_i^2 sum (x_i - mean)^2, so that it keeps its relative accuracy when W is close to 1 (the p-value
 * depends on log(1 - W)). The data are scaled by their range first.
 */
export declare function swilkOneMinusW(sorted: readonly number[]): number;
/**
 * The W statistic of a sample sorted in increasing order:
 * W = (sum a_i x_(i))^2 / sum (x_i - mean)^2.
 */
export declare function swilkW(sorted: readonly number[]): number;
/**
 * The p-value P(W' <= W) of the Shapiro-Wilk test for a sample of size n (Royston's approximations), from W.
 */
export declare function swilkPValue(w: number, n: number): number;
/**
 * The p-value P(W' <= W) of the Shapiro-Wilk test for a sample of size n, from w1 = 1 - W (see swilkOneMinusW).
 */
export declare function swilkPValueFromOneMinusW(w1: number, n: number): number;
