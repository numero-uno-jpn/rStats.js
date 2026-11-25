// Argument handling shared by the d/p/q functions (lowerTail, logP, endpoints).
/** Value corresponding to probability 0 (depending on lowerTail and logP) */
export function dt0(lowerTail, logP) {
    return lowerTail ? (logP ? -Infinity : 0) : logP ? 0 : 1;
}
/** Value corresponding to probability 1 */
export function dt1(lowerTail, logP) {
    return lowerTail ? (logP ? 0 : 1) : logP ? -Infinity : 0;
}
/** Density 0 / 1 */
export function d0(log) {
    return log ? -Infinity : 0;
}
/**
 * If the quantile function's input p is out of range or at an endpoint, return that answer (otherwise undefined).
 * left is the x for lower probability 0, right the x for 1.
 */
export function quantileBoundaries(p, left, right, lowerTail, logP) {
    if (logP) {
        if (p > 0)
            return NaN;
        if (p === 0)
            return lowerTail ? right : left;
        if (p === -Infinity)
            return lowerTail ? left : right;
    }
    else {
        if (p < 0 || p > 1)
            return NaN;
        if (p === 0)
            return lowerTail ? left : right;
        if (p === 1)
            return lowerTail ? right : left;
    }
    return undefined;
}
/**
 * Express the quantile function's target in terms of the "smaller tail".
 * If the lower probability exceeds 1/2, switch to the upper tail (avoids cancellation in 1 - p).
 * Assumes p is in range (0 < p < 1).
 *
 * logTarget is the log probability of that tail. linearTarget is the linear probability obtained without rounding
 * (or within 1 ulp), e.g. when the input was a linear p. The rounding of log(p) has a larger absolute error the smaller
 * p is (7.7e-14 at p = 1e-300), so when available the residual is measured as a linear ratio.
 */
export function smallerTail(p, lowerTail, logP) {
    const lp = logP ? p : Math.log(p);
    if (lp <= -Math.LN2) {
        return logP ? { lower: lowerTail, logTarget: lp } : { lower: lowerTail, logTarget: lp, linearTarget: p };
    }
    // This side's probability exceeds 1/2, so switch to the other side
    const other = logP ? -Math.expm1(p) : 1 - p; // 1 - p is exact when p > 1/2
    return { lower: !lowerTail, logTarget: Math.log(other), linearTarget: other };
}
