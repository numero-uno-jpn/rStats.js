/**
 * Options shared by the distribution (`p*`) and quantile (`q*`) functions.
 * Correspond to R's `lower.tail` and `log.p` arguments.
 */
export interface TailOptions {
    /** If `true`, probabilities are P[X <= x]; if `false`, P[X > x]. Default `true`. */
    lowerTail?: boolean;
    /** If `true`, probabilities are given (to `q*`) and returned (from `p*`) as log(p). Default `false`. */
    logP?: boolean;
}
/**
 * Options shared by the density / probability mass (`d*`) functions.
 * Corresponds to R's `log` argument.
 */
export interface DensityOptions {
    /** If `true`, return the log of the density (or probability). Default `false`. */
    log?: boolean;
}
/** Value corresponding to probability 0 (depending on lowerTail and logP) */
export declare function dt0(lowerTail: boolean, logP: boolean): number;
/** Value corresponding to probability 1 */
export declare function dt1(lowerTail: boolean, logP: boolean): number;
/** Density 0 / 1 */
export declare function d0(log: boolean): number;
/**
 * If the quantile function's input p is out of range or at an endpoint, return that answer (otherwise undefined).
 * left is the x for lower probability 0, right the x for 1.
 */
export declare function quantileBoundaries(p: number, left: number, right: number, lowerTail: boolean, logP: boolean): number | undefined;
/**
 * Express the quantile function's target in terms of the "smaller tail".
 * If the lower probability exceeds 1/2, switch to the upper tail (avoids cancellation in 1 - p).
 * Assumes p is in range (0 < p < 1).
 *
 * logTarget is the log probability of that tail. linearTarget is the linear probability obtained without rounding
 * (or within 1 ulp), e.g. when the input was a linear p. The rounding of log(p) has a larger absolute error the smaller
 * p is (7.7e-14 at p = 1e-300), so when available the residual is measured as a linear ratio.
 */
export declare function smallerTail(p: number, lowerTail: boolean, logP: boolean): {
    lower: boolean;
    logTarget: number;
    linearTarget?: number;
};
