/** Inverse of the standard normal distribution function. */
export declare function ndtri(y0: number): number;
/** ndtri taking log(p). Computes ndtriExp(y) = ndtri(exp(y)) without overflow in exp. */
export declare function ndtriExp(y: number): number;
