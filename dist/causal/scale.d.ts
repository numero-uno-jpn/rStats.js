/**
 * The column as `(v 2^-e1 - first) 2^-e2`, and the exponent e1 + e2 back to the original units (of spreads, not of
 * locations: a spread s of the result is s 2^(e1 + e2)). A constant column comes back as zeros.
 */
export declare function rescaled(values: readonly number[]): {
    values: number[];
    unitExp: number;
};
