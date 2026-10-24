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
