/** Generate n random values. As in R, n must be non-negative (fractions are truncated) */
export declare function generate(n: number, f: () => number): number[];
/** Integer power x^n (by repeated squaring; Math.pow is not used, to round the same way as R's generators) */
export declare function powInt(x: number, n: number): number;
