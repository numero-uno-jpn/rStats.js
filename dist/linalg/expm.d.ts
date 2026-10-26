import { type Mat, type MatrixInput } from "./matrix.js";
/** Methods of {@link expm}. */
export type ExpmMethod = "Higham08.b" | "Higham08" | "Pade" | "Taylor" | "PadeO" | "TaylorO";
/** Options for {@link expm}. */
export interface ExpmOptions {
    /**
     * `"Higham08.b"` (default): Higham's scaling and squaring with Padé approximants after balancing (LAPACK's
     * `dgebal`, permutation then scaling). `"Higham08"`: the same without balancing. `"Pade"` and `"Taylor"` (and
     * `"PadeO"`, `"TaylorO"`, which compute the same): scaling and squaring with a diagonal Padé approximant or a
     * Taylor polynomial of degree `order` (Shapira and Firth's code in the expm package).
     */
    method?: ExpmMethod;
    /**
     * Degree of the Padé approximant or the Taylor polynomial (a positive integer), used only by `"Pade"`, `"Taylor"`,
     * `"PadeO"` and `"TaylorO"`. Default: 8.
     */
    order?: number;
}
/**
 * Matrix exponential. Equivalent to R's `expm::expm(x, method, order)` with methods `"Higham08.b"` (the default),
 * `"Higham08"`, `"Pade"`, `"Taylor"`, `"PadeO"` and `"TaylorO"`.
 *
 * `"Higham08.b"` and `"Higham08"` use the scaling and squaring method with Padé approximants of degree 3, 5, 7, 9 or
 * 13 (Higham 2005), with or without balancing first, and throw if a linear system of the method is computationally
 * singular. The other methods use scaling and squaring with a Taylor polynomial or a diagonal Padé approximant of
 * degree `order` (the Padé quotient by the conjugate gradient squared method, as expm does).
 *
 * @param x A square matrix (array of rows).
 * @param options See {@link ExpmOptions}.
 * @returns `exp(x)` as an array of rows.
 *
 * @example
 * ```ts
 * expm([[0, 1], [0, 0]]); // [[1, 1], [0, 1]]
 * expm([[0, -1], [1, 0]]); // [[cos 1, -sin 1], [sin 1, cos 1]] (up to rounding)
 * ```
 */
export declare function expm(x: MatrixInput, options?: ExpmOptions): number[][];
/**
 * Balancing (dgebal) with job "P" (permute only) or "S" (scale only); A is overwritten. Indices are 0-based:
 * scale[i] holds the index of the row and column interchanged with i for i < ilo and i > ihi, and the scaling factor
 * for ilo <= i <= ihi
 */
export declare function gebal(job: "P" | "S", A: Mat): {
    ilo: number;
    ihi: number;
    scale: Float64Array;
};
