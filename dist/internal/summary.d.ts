import { type DD } from "../special/dd.js";
/**
 * Running sum of finite values in double-double that does not overflow: its value is (s[0] + s[1]) 2^shift. shift
 * is 0 until an addition would overflow; from then on the values are added scaled by 2^-shift
 */
export interface WideSum {
    s: DD;
    shift: number;
}
export declare function wideSum(): WideSum;
/** Adds the finite value v to acc; n is the number of values the sum will have in all */
export declare function wideSumAdd(acc: WideSum, v: number, n: number): void;
/** The value of the sum rounded to double (±Infinity beyond the range) */
export declare function wideSumValue(acc: WideSum): number;
/** v 2^k for an integer k, in two steps so that 2^k itself does not overflow or underflow */
export declare function ldexp(v: number, k: number): number;
/** Mean as double-double. x contains no NaN and has length >= 1 */
export declare function meanDD(x: readonly number[]): DD;
export declare function mean(x: readonly number[]): number;
/** Unbiased variance. NaN for length below 2 (R's var gives NA) */
export declare function variance(x: readonly number[]): number;
/** Unbiased covariance. x and y have the same length and contain no NaN */
export declare function covariance(x: readonly number[], y: readonly number[]): number;
/**
 * Sum (accumulated in double-double without overflow, then rounded; ±Infinity beyond the double range). With
 * infinite or NaN values, as in double arithmetic
 */
export declare function sum(x: readonly number[]): number;
/**
 * Ranks (ties get the average rank, R's rank(ties.method = "average")). x contains no NaN.
 * Equality is decided by exact comparison
 */
export declare function rank(x: readonly number[]): number[];
/** Size of each group of ties (only those of size 2 or more). x contains no NaN */
export declare function tieCounts(x: readonly number[]): number[];
/** Array with NaN removed (R's x[!is.na(x)]) */
export declare function dropNaN(x: readonly number[]): number[];
/** Keep only the pairs where neither x nor y is NaN (R's complete.cases) */
export declare function completePairs(x: readonly number[], y: readonly number[]): [number[], number[]];
