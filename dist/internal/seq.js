/**
 * Equally spaced values from `from` to `to`, both ends exact (R's seq(from, to, length.out = n)). A fractional `n` is
 * rounded up, as R's seq does.
 */
export function seqLength(from, to, n) {
    const len = Math.ceil(n);
    if (len === 1)
        return [from];
    const by = (to - from) / (len - 1);
    const out = Array.from({ length: len }, (_, i) => from + i * by);
    if (len > 0)
        out[len - 1] = to;
    return out;
}
