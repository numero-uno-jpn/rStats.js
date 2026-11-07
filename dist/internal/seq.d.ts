/**
 * Equally spaced values from `from` to `to`, both ends exact (R's seq(from, to, length.out = n)). A fractional `n` is
 * rounded up, as R's seq does.
 */
export declare function seqLength(from: number, to: number, n: number): number[];
