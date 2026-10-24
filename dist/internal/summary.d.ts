import { type DD } from "../special/dd.js";
/** Mean as double-double. x contains no NaN and has length >= 1 */
export declare function meanDD(x: readonly number[]): DD;
export declare function mean(x: readonly number[]): number;
/** Unbiased variance. NaN for length below 2 (R's var gives NA) */
export declare function variance(x: readonly number[]): number;
/** Unbiased covariance. x and y have the same length and contain no NaN */
export declare function covariance(x: readonly number[], y: readonly number[]): number;
/** Sum (accumulated in double-double, then rounded) */
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
