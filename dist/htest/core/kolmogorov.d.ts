/**
 * Throws a RangeError when pkolmogorovExact(n, d) would need more than MAX_EXACT_WORK: the m x m matrix
 * (m = 2 floor(n d) + 1) is raised to the n-th power with floor(log2 n) squarings and popcount(n) - 1 products, each
 * m^3 multiply-adds (n 1e4 with d 0.4999 asked for an 800 MB matrix and hours of work). Checked before any allocation.
 *
 * @param n - Sample size.
 * @param d - Value of the statistic.
 */
export declare function checkKolmogorovExactSize(n: number, d: number): void;
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
/**
 * P(D_n >= d), the upper tail of the two-sided one-sample statistic, as a sum of positive terms (#483), or NaN where
 * that needs more than MAX_CHAIN_WORK terms. 1 - P(D_n < d) from pkolmogorovExact has absolute accuracy only (1e-22
 * came out as 3e-15 at n = 99).
 *
 * N(t), the number of points at or below t, is a Markov chain: given N(t_k) = s, the count in (t_k, t_(k+1)] is
 * Binomial(n - s, (t_(k+1) - t_k) / (1 - t_k)). D+ >= d when N(i/n - d) >= i for some i, D- >= d when
 * N(j/n + d) <= j for some j (N(t-) = N(t) almost surely). Between the at most 2n breakpoints i/n - d and j/n + d the
 * thresholds are constant, so the chain is stepped from one breakpoint to the next and the probability that leaves it
 * across a threshold is added up. Each binomial row starts from dbinom1 at its mode and follows the ratio recurrence
 * both ways until it underflows.
 *
 * @param n - Sample size, a positive integer.
 * @param d - Value of the statistic, in (0, 1).
 */
export declare function pkolmogorovExactUpper(n: number, d: number): number;
