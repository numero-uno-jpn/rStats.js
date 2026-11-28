/** 2^round(log2(max |y|)) over the finite values (1 when there is none or all are zero). */
export declare function powerOfTwoScale(y: readonly number[]): number;
/**
 * The series divided by {@link powerOfTwoScale}: for statistics that do not depend on the scale, the same values bit
 * for bit wherever the squares (and fourth powers) stay in range, and right beyond.
 */
export declare function standardise(y: readonly number[]): number[];
/**
 * A reference value to subtract from a series with a large common value (1.20.0, log 110): the first finite value
 * when it exceeds 1024 times the range of the finite values (y + 1e15: the sums of the values pass 2^53 and the
 * statistics lose digits), else 0, so that ordinary series are left as they are. y - r is exact for such values
 * (Sterbenz: r and y within a factor 2).
 */
export declare function shiftReference(y: readonly number[]): number;
/** The series minus {@link shiftReference} (NaN kept), for statistics that do not depend on a common value. */
export declare function centred(y: readonly number[]): number[];
