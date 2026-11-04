export declare const FUZZ_LINEAR: number;
export declare const FUZZ_LOG: number;
export interface DiscreteQuantileProblem {
    /** Probability supplied by the user (0 < p < 1; log if logP) */
    p: number;
    lowerTail: boolean;
    logP: boolean;
    /** P[X <= y] (lowerTail) / P[X > y] (!lowerTail); log if logP */
    cdf: (y: number, lowerTail: boolean, logP: boolean) => number;
    /** Starting value (need not be an integer) */
    y0: number;
    /** Lower and upper ends of the support */
    lo: number;
    hi: number;
}
export declare function discreteQuantile(problem: DiscreteQuantileProblem): number;
/**
 * For a predicate on the integers from lo on that is false up to some integer and true from there on: the first
 * integer >= lo where it holds, at most hi + 1 (hi + 1 when none up to hi; hi may be Infinity). Found by doubling the
 * step from lo and then bisecting, so in O(log) evaluations: the two-sided exact tests use it on the tail beyond the
 * mode of a unimodal distribution, where "probability at most that of the observation" switches once
 */
export declare function firstTrue(pred: (i: number) => boolean, lo: number, hi: number): number;
/**
 * For a predicate on lo..hi that is true up to some integer and false from there on: the last integer <= hi where it
 * holds (lo - 1 when none). By bisection (the mirror image of firstTrue, on a finite range)
 */
export declare function lastTrue(pred: (i: number) => boolean, lo: number, hi: number): number;
