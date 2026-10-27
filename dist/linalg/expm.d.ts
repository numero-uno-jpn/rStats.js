import { type MatrixInput } from "./matrix.js";
/**
 * Methods of {@link expm}.
 *
 * @category Linear algebra
 */
export type ExpmMethod = "Higham08.b" | "Higham08" | "Pade" | "Taylor" | "PadeO" | "TaylorO";
/**
 * Options for {@link expm}.
 *
 * @category Linear algebra
 */
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
 * Matrix exponential. Equivalent to `expm::expm(x, method, order)` in R. The methods are `"Higham08.b"` (the
 * default), `"Higham08"`, `"Pade"`, `"Taylor"`, `"PadeO"` and `"TaylorO"`.
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
 * expm([[0, -1], [1, 0]]); // [[0.5403023059, -0.8414709848], [0.8414709848, 0.5403023059]] (cos 1 and sin 1)
 * ```
 *
 * @category Linear algebra
 */
export declare function expm(x: MatrixInput, options?: ExpmOptions): number[][];
