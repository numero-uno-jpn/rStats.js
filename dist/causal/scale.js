// Exact rescaling of a column before its moments: by a power of 2 (no rounding) so that its largest magnitude is near
// 1, then shifted by its first value (exact for nearby values, Sterbenz) and rescaled again. Standardised differences
// and variance ratios do not change under v -> (v - a) c, c > 0, while the sums of squares then neither overflow
// (values near 1e300) nor underflow (near 1e-300) nor lose the digits a large common offset (1e15 + small
// differences) takes from them. Written for rStats.js.
import { ldexp } from "../internal/summary.js";
/** The largest finite magnitude's power of 2 (0 for an all-zero column). */
function exponentOf(values) {
    let top = 0;
    for (const v of values)
        if (Math.abs(v) > top)
            top = Math.abs(v);
    return top > 0 && Number.isFinite(top) ? Math.floor(Math.log2(top)) : 0;
}
/**
 * The column as `(v 2^-e1 - first) 2^-e2`, and the exponent e1 + e2 back to the original units (of spreads, not of
 * locations: a spread s of the result is s 2^(e1 + e2)). A constant column comes back as zeros.
 */
export function rescaled(values) {
    const e1 = exponentOf(values);
    const scaled = values.map((v) => ldexp(v, -e1));
    const first = scaled[0] ?? 0;
    const shifted = scaled.map((v) => v - first);
    const e2 = exponentOf(shifted);
    return { values: shifted.map((v) => ldexp(v, -e2)), unitExp: e1 + e2 };
}
