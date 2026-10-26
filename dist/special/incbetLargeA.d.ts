import { type DD } from "./dd.js";
/**
 * Region where the expansion is used (the caller tries it where it would otherwise use the continued fraction):
 * a >= LARGE_A_MIN, b <= SMALL_B_MAX, y = 1 - x <= Y_MAX, u <= U_MAX, and on the J side u >= U_MIN_J (below,
 * J_0 would need more than 1000 terms of its continued fraction). Chosen by measurement against mpmath
 * (scripts/mpmath/smallb.py) and against the time of the continued fraction (docs/performance.md)
 */
export declare const LARGE_A_MIN = 15;
export declare const SMALL_B_MAX = 40;
/**
 * I_x(a, b) (lower) or 1 - I_x(a, b) by the expansion for large a, as [log, linear] (log NaN unless wantLog).
 * x and y = 1 - x are given in double-double. Returns undefined outside the region above (assumes a >= LARGE_A_MIN
 * and b <= SMALL_B_MAX)
 */
export declare function betaIncLargeA(a: number, b: number, xd: DD, yd: DD, lower: boolean, wantLog: boolean): [number, number] | undefined;
