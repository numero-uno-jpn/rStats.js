import { type DD } from "../special/dd.js";
export interface MixtureKernel {
    /** Distribution function of component j: P_j if lower, otherwise Q_j; log if log */
    cdf(j: number, lower: boolean, log: boolean): number;
    /** Increment d_j = P_j - P_{j+1} = Q_{j+1} - Q_j (>= 0); log if log */
    inc(j: number, log: boolean): number;
    /** Ratio d_j / d_{j-1} (j >= 1) as double-double. With ratioK, the value is ratio × 2^(500 ratioK) */
    ratio(j: number): DD;
    /** Exponent used when the ratio is returned scaled by 2^(-500 ratioK) to avoid underflow */
    ratioK?: number;
    /**
     * log d_j as double-double (optional). Used when d_j underflows in double, to build the mantissa more
     * accurately than from the double log (error eps × |log d_j|)
     */
    incLogDD?(j: number): DD | number;
}
/** log Pois(x; λ) = log(λ^x e^-λ / Gamma(x + 1)) as double-double (x >= 0, λ > 0) */
export declare function dpoisLogDD(x: number, lambda: number): DD;
/** Σ_j w_j P_j (lower) or Σ_j w_j Q_j (!lower). Returned as a log if log */
export declare function mixtureCdf(mu: number, kernel: MixtureKernel, lower: boolean, log: boolean): number;
/**
 * Linear value and log of mixtureCdf, with the larger tail taken as 1 - (smaller): summed directly it can exceed 1 by
 * a few ulps (the weights' rounding errors add up, while every P_j or Q_j is near 1), and its errors need not follow
 * x, so it could also step back. lowerSmaller guesses which tail is the smaller (summed first; when the guess is wrong
 * the other is summed too)
 */
export declare function mixtureTail(mu: number, kernel: MixtureKernel, lower: boolean, lowerSmaller: boolean): {
    lin: number;
    log: number;
};
/**
 * Mixture of densities Σ_j w_j c_j d_j, where c_j is a coefficient (when component j's density can be written c_j d_j).
 * jStar is a guess for the location of the peak of the terms. Sums outward from the peak on both sides until the terms are negligible.
 * Returns the sum divided by divisor (as a log if log).
 */
export declare function mixtureDensity(mu: number, kernel: MixtureKernel, coef: (j: number) => number, jStar: number, divisor: number, log: boolean): number;
