/**
 * P(D_n < d), the exact distribution of the two-sided one-sample Kolmogorov-Smirnov statistic for a continuous
 * distribution (Marsaglia, Tsang and Wang 2003). The matrix has size 2 floor(n d) + 1, so the cost grows like
 * (n d)^3 log n; ks.test uses it for small samples.
 *
 * @param n - Sample size, a positive integer.
 * @param d - Value of the statistic.
 */
export declare function pkolmogorovExact(n: number, d: number): number;
/**
 * The limiting distribution of sqrt(n) D_n (Kolmogorov's distribution), K(x) = P(sqrt(n) D_n <= x) as n -> infinity,
 * or 1 - K(x) for the upper tail. Each tail is summed directly with the series that converges fast for it.
 *
 * @param x - Value of sqrt(n) D_n.
 * @param lowerTail - `true` for K(x), `false` for 1 - K(x).
 */
export declare function pkolmogorovLimit(x: number, lowerTail?: boolean): number;
/**
 * P(D_n^+ >= d) for the one-sided one-sample statistic D_n^+ = sup (F_n(x) - F(x)) of a continuous distribution
 * (the same distribution holds for D_n^- = sup (F(x) - F_n(x))), exactly by the Birnbaum-Tingey formula. All terms are
 * positive, so small p-values keep their relative accuracy.
 *
 * @param n - Sample size, a positive integer.
 * @param d - Value of the statistic.
 */
export declare function pkolmogorovOneSidedUpper(n: number, d: number): number;
