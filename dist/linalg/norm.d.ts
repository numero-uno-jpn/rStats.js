import { type Mat, type MatrixInput } from "./matrix.js";
/**
 * Matrix norm type for {@link norm}: `"O"`/`"1"` (one norm), `"I"` (infinity norm), `"F"`/`"E"` (Frobenius),
 * `"M"` (maximum modulus) or `"2"` (spectral norm). Case-insensitive, as in R.
 */
export type NormType = "O" | "o" | "1" | "I" | "i" | "F" | "f" | "E" | "e" | "M" | "m" | "2";
/** Options for {@link norm}. */
export interface NormOptions {
    /**
     * Which norm to compute (a single character, case-insensitive). Default: `"O"`.
     * - `"O"` or `"1"`: one norm, the maximum absolute column sum
     * - `"I"`: infinity norm, the maximum absolute row sum
     * - `"F"` or `"E"`: Frobenius norm
     * - `"M"`: the maximum absolute value of the elements
     * - `"2"`: spectral norm, the largest singular value
     */
    type?: NormType | (string & {});
}
/**
 * Matrix norm. Equivalent to R's `norm()`.
 *
 * Returns `NaN` if the matrix contains `NaN`. For `type: "2"`, an infinite element is an error.
 *
 * @param x A matrix (array of rows).
 * @param options See {@link NormOptions}.
 * @returns The norm of `x`.
 */
export declare function norm(x: MatrixInput, options?: NormOptions): number;
export declare function oneNorm(m: Mat): number;
export declare function infNorm(m: Mat): number;
export declare function maxAbs(m: Mat): number;
export declare function frobenius(m: Mat): number;
