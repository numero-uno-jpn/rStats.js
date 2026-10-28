import { type DD } from "./dd.js";
/**
 * Error of Stirling's approximation, stirlerr(n) = log(n!) - log(sqrt(2 pi n) (n/e)^n).
 * It enters the exponent of probabilities, so the absolute (not relative) error must be kept small.
 */
export declare function stirlerr(n: number): number;
/**
 * Deviance bd0(x, M) = x log(x/M) + M - x (>= 0) in double-double.
 * M is also taken in double-double (so as not to bring in the rounding of a product such as n p).
 * When x and M are close, it is computed by the series in v = (x - M)/(x + M) (Loader 2000).
 */
export declare function bd0dd(x: number, M: DD): DD;
/** Double-precision version of bd0 */
export declare function bd0(x: number, M: number): number;
/**
 * Binomial probability C(n, x) p^x q^(n-x). x and n need not be integers (used by the beta and F distributions).
 * The caller passes q = 1 - p accurately.
 */
export declare function dbinomRaw(x: number, n: number, p: number, q: number, log: boolean): number;
/**
 * Version of dbinomRaw taking x and n - x separately (n = x + nmx).
 * Used where forming n = a + b and recovering n - a would lose digits of the smaller one, as in the beta
 * function with a ≪ b.
 */
export declare function dbinomRawSplit(x: number, nmx: number, p: number, q: number, log: boolean): number;
/**
 * Version that additionally takes p and q = 1 - p in double-double.
 * The rounding error of p^x is amplified x times (1e-11 at x = 1e5), so where p is formed as 1 - (smaller side),
 * pass that difference exactly in double-double.
 */
export declare function dbinomRawDD(x: number, nmx: number, p: DD, q: DD, log: boolean): number;
/**
 * Return the exponent of the core binomial probability (0 < x, 0 < n - x, 0 < p, q) in double-double.
 * Probability = exp(-e) / sqrt(denom). Used when exp should be taken after combining with other factors (beta density).
 */
export declare function dbinomExponent(x: number, nmx: number, p: DD, q: DD): {
    e: DD;
    logDenom: number;
};
/** Poisson probability lambda^x e^-lambda / x!. x need not be an integer (used by the gamma distribution). */
export declare function dpoisRaw(x: number, lambda: number, log: boolean): number;
/** Return [log, linear] of dpoisRaw in one computation (bit-identical to each of dpoisRaw's values) */
export declare function dpoisRawBoth(x: number, lambda: number): [number, number];
