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
