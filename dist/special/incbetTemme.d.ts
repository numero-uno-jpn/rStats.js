import { type DD } from "./dd.js";
/**
 * Smallest m = ab/(a+b) for which the expansion is used. Measured against mpmath with |τ| <= 1: within 9e-16 from
 * m = 20 on (as accurate as the continued fraction), 7e-15 for m in 15-20 and 5e-14 for m in 10-15 (the series
 * in 1/m no longer converges far enough). It is faster than the continued fraction from m = 10 on (2 µs against 8)
 */
export declare const TEMME_MIN_M = 25;
/**
 * ½ erfc(y) to a few ulp. erfc in erf.ts forms 1 - erf(y) below 1, which loses a factor of up to 6 near y = 1, so
 * for 0.5 <= y < 1 use erfc(y) = erfc(1) + (2/sqrt(pi)) ∫_y^1 e^(-t²) dt (both terms positive), with the integral
 * by 8-point Gauss-Legendre quadrature (3e-16 relative on this interval)
 */
export declare function halfErfc(y: number): number;
/**
 * I_x(a, b) (lower) or 1 - I_x(a, b) by the uniform asymptotic expansion, as [log, linear] (log NaN unless
 * wantLog). x and 1 - x are given in double-double. Returns undefined outside the region where the expansion is
 * used (m >= TEMME_MIN_M and |τ| <= TAU_MAX); the caller then uses the series or continued fractions
 */
export declare function betaIncTemme(a: number, b: number, xd: DD, xcd: DD, lower: boolean, wantLog: boolean): [number, number] | undefined;
