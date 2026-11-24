/**
 * (R'R)^-1 of an upper triangular R as inv_jk 2^(-e_j - e_k): the columns of R divided by 2^e_j first (exact). The
 * inverse of R itself overflowed for columns of 1e-200 (and underflowed for 1e200), so standard errors were Infinity
 * or 0 though they scale with the column (R's too). e_j is the exponent of the largest |R_ij| of a column outside
 * [2^-400, 2^400], else 0, which leaves the computation as before
 */
export declare function chol2invColumns(R: readonly (readonly number[])[]): {
    inv: number[][];
    e: number[];
};
