/** Whether x is not an integer (relative slack 1e-9) */
export declare function nonInt(x: number): boolean;
/**
 * The largest count k with k <= q, for the distribution functions of discrete distributions on the integers. A q within
 * min(1e-7, 1e-9 max(1, |q|)) of an integer is that integer (a computed 2.9999999999999996 counts as 3); any other q
 * gives floor(q). R adds 1e-7 before taking the floor (or, in psignrank, rounding to the nearest integer), which counts
 * q in [k - 1e-7, k) as k although P[X <= q] is P[X <= k - 1] there, and does not agree with its densities
 * (dpois(1 - 1e-8, 1) is 0 while ppois(1 - 1e-8, 1) is P[X <= 1]) (#145, #146). The slack of {@link nonInt} alone
 * would be wider than R's above q = 100 (ppois(1000 - 5e-7, 1000) would be P[X <= 1000]), so it is capped at 1e-7.
 */
export declare function countAtMost(q: number): number;
/** Round half to even (0.5 goes to the nearest even number) */
export declare function roundHalfEven(x: number): number;
