/**
 * R's `round(x, digits)`: x rounded to `digits` decimal places (negative: to a power of ten), choosing between the
 * two neighbouring candidates the one closer to x in double arithmetic, a tie to the even one. Values that already
 * have at most about 15 significant digits at that position are returned unchanged.
 */
export declare function roundR(x: number, digits?: number): number;
/**
 * R's `zapsmall(x, digits = 7)` of the entries of a matrix (array of rows) taken together: every entry rounded by
 * {@link roundR} to `max(0, digits - log10(mx))` decimal places, mx the largest absolute entry (NaN left out), or
 * to `digits` places when mx is 0.
 */
export declare function zapsmall(m: readonly (readonly number[])[], digits?: number): number[][];
