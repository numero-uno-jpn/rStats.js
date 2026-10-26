import type { MatrixInput } from "../linalg/matrix.js";
import { type DDMatrix } from "./ddMatrix.js";
import { type DataFrame } from "./modelFrame.js";
/** Options for {@link mauchlyTest}. */
export interface MauchlyTestOptions {
    /** Between-subjects group labels, parallel to the rows of `y` (the residuals are taken from the group means). */
    group?: readonly (string | number)[];
    /** The within-subject design: a data frame with one row per column of `y`. Default: a column `index` = 1 ... k. */
    idata?: DataFrame;
    /** Formula over `idata` whose model matrix spans the space tested. Default: all k dimensions (the identity). */
    M?: string;
    /** Formula over `idata` whose space is projected out. Default `"~0"` (nothing). */
    X?: string;
}
/** Result of {@link mauchlyTest}. */
export interface MauchlyTestResult {
    /** Mauchly's W. */
    statistic: number;
    statisticName: "W";
    pValue: number;
    method: "Mauchly's test of sphericity";
}
/** W = det(U) / (trace(U)/p)^p of a p x p matrix U */
export declare function sphericityW(U: DDMatrix): number;
/**
 * The p-value of Mauchly's W by the asymptotic expansion: pp the dimension tested, n the degrees of freedom of the
 * cross-products, k the number of measurements per subject.
 */
export declare function mauchlyPValue(W: number, pp: number, n: number, k: number): number;
/**
 * The matrix T S T' for an orthonormal basis T (rows) of the part of span(Mcols) orthogonal to span(Xcols), S a
 * symmetric k x k matrix. Throws if span(X) is not inside span(M).
 */
export declare function contrastCrossprod(S: DDMatrix, mcols: number[][], xcols: number[][]): DDMatrix;
/**
 * Mauchly's test of sphericity of the measurements of each subject (a row of `y`), on the contrasts spanned by `M`
 * and orthogonal to `X` (both formulas over `idata`). Equivalent to R's `mauchly.test(lm(y ~ 1), X = ~1)` and its
 * variants (`group` for `lm(y ~ group)`, `M`, `X`, `idata`).
 *
 * @param y One row per subject, one column per measurement.
 *
 * @example
 * ```ts
 * const y = [[10.5, 9.8, 8.8], [11.2, 10.1, 9.9], [9.7, 9.5, 9.0], [10.9, 10.6, 9.1], [10.1, 9.2, 9.4]];
 * mauchlyTest(y, { X: "~1" }).statistic; // W
 * ```
 */
export declare function mauchlyTest(y: MatrixInput, options?: MauchlyTestOptions): MauchlyTestResult;
