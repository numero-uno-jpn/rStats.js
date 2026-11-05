/**
 * Throws a RangeError when the exact distribution for sample sizes m and n is too large to build: the two layers of
 * ansariDist hold 2 (m + 1) (maxSum + 1) doubles (maxSum = floor((N + 1)^2 / 4), N = m + n) and the N passes take
 * N (m + 1) (maxSum + 1) steps (m = n = 1000 asked for 16 GB). Checked before any allocation.
 *
 * @param m - Size of the first sample.
 * @param n - Size of the second sample.
 */
export declare function checkAnsariExactSize(m: number, n: number): void;
/**
 * P(AB <= q) (lowerTail) or P(AB > q) for the Ansari-Bradley statistic with sample sizes m and n, without ties.
 *
 * @param q - Value of the statistic.
 * @param m - Size of the first sample.
 * @param n - Size of the second sample.
 * @param lowerTail - `true` for P(AB <= q), `false` for P(AB > q).
 */
export declare function pansariExact(q: number, m: number, n: number, lowerTail?: boolean): number;
/**
 * P(AB = x) for the Ansari-Bradley statistic with sample sizes m and n, without ties.
 */
export declare function dansariExact(x: number, m: number, n: number): number;
/**
 * The smallest q with P(AB <= q) >= p (quantile of the Ansari-Bradley statistic), without ties. A relative slack of
 * 64 ε on p keeps p = P(AB <= q) itself from being missed by rounding.
 */
export declare function qansariExact(p: number, m: number, n: number): number;
/**
 * R's qansari, used by ansari.test's exact interval and estimate: the smallest q at which the running sum of
 * count(k) / C(N, m) over k = min, ..., q, accumulated in double, reaches p (p = 0 gives the minimum, p = 1 the
 * maximum). Unlike {@link qansariExact} there is no slack, so a cumulative probability that equals p mathematically
 * (such as 1/2) may be missed by rounding, as in R.
 */
export declare function qansariR(p: number, m: number, n: number): number;
