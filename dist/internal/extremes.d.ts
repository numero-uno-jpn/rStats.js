/** Math.max(...v) without spreading (-Infinity for an empty array) */
export declare function maxOf(v: ArrayLike<number>): number;
/**
 * (a + b) / 2, falling back to a / 2 + b / 2 only when a and b are finite and their sum overflows (so that the
 * value is the usual one otherwise)
 */
export declare function midpoint(a: number, b: number): number;
/** Math.min(...v) without spreading (Infinity for an empty array) */
export declare function minOf(v: ArrayLike<number>): number;
