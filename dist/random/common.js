// Shared helpers for the r functions.
/** Generate n random values. As in R, n must be non-negative (fractions are truncated) */
export function generate(n, f) {
    if (!Number.isFinite(n) || n < 0)
        throw new RangeError("n must be a non-negative finite number");
    const len = Math.trunc(n);
    const out = new Array(len);
    for (let i = 0; i < len; i++)
        out[i] = f();
    return out;
}
/** Integer power x^n (by repeated squaring; Math.pow is not used, to round the same way as R's generators) */
export function powInt(x, n) {
    let pow = 1;
    if (Number.isNaN(x))
        return x;
    if (n !== 0) {
        if (!Number.isFinite(x))
            return Math.pow(x, n);
        if (n < 0) {
            n = -n;
            x = 1 / x;
        }
        for (;;) {
            if (n & 1)
                pow *= x;
            n >>= 1;
            if (n)
                x *= x;
            else
                break;
        }
    }
    return pow;
}
