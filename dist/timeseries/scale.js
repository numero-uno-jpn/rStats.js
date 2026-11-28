// Standardising a series by a power of two (1.20.0, experiments/tsmeta120-log.md 104): exact, so the fitting
// functions can work on a series of unit scale and map the results back. Written for rStats.js (no ported code).
/** 2^round(log2(max |y|)) over the finite values (1 when there is none or all are zero). */
export function powerOfTwoScale(y) {
    let mx = 0;
    for (const v of y)
        if (Number.isFinite(v) && Math.abs(v) > mx)
            mx = Math.abs(v);
    if (!(mx > 0))
        return 1;
    const k = Math.round(Math.log2(mx));
    // clamped to the normal powers of two (max |y| near 2^1024 or below 2^-1022)
    return k > 1023 ? 2 ** 1023 : k < -1022 ? 2 ** -1022 : 2 ** k;
}
/**
 * The series divided by {@link powerOfTwoScale}: for statistics that do not depend on the scale, the same values bit
 * for bit wherever the squares (and fourth powers) stay in range, and right beyond.
 */
export function standardise(y) {
    const c = powerOfTwoScale(y);
    return c === 1 ? y.slice() : y.map((v) => v / c);
}
/**
 * A reference value to subtract from a series with a large common value (1.20.0, log 110): the first finite value
 * when it exceeds 1024 times the range of the finite values (y + 1e15: the sums of the values pass 2^53 and the
 * statistics lose digits), else 0, so that ordinary series are left as they are. y - r is exact for such values
 * (Sterbenz: r and y within a factor 2).
 */
export function shiftReference(y) {
    let first = NaN, lo = Infinity, hi = -Infinity;
    for (const v of y)
        if (Number.isFinite(v)) {
            if (Number.isNaN(first))
                first = v;
            if (v < lo)
                lo = v;
            if (v > hi)
                hi = v;
        }
    if (Number.isNaN(first))
        return 0;
    return Math.abs(first) > 1024 * (hi - lo) && hi - lo > 0 ? first : 0;
}
/** The series minus {@link shiftReference} (NaN kept), for statistics that do not depend on a common value. */
export function centred(y) {
    const r = shiftReference(y);
    return r === 0 ? y.slice() : y.map((v) => v - r);
}
