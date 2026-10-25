import type { Sample } from "../htest/types.js";
/** A vector (plain array) or a matrix (array of rows). */
export type Operand = number | Sample | readonly (readonly number[])[];
type Matrix = number[][];
/**
 * Matrix product. Equivalent to R's `x %*% y`: a vector is taken as a row or a column so that the product is
 * defined (two vectors give their inner product as a 1 x 1 matrix).
 *
 * @example
 * ```ts
 * matMul([[1, 2], [3, 4]], [[5], [6]]); // [[17], [39]]
 * ```
 */
export declare function matMul(x: Operand, y: Operand): Matrix;
/** Element-wise sum with R's recycling (R's `x + y`). */
export declare function add(x: Operand, y: Operand): number[] | Matrix;
/** Element-wise difference with R's recycling (R's `x - y`). */
export declare function subtract(x: Operand, y: Operand): number[] | Matrix;
/** Element-wise product with R's recycling (R's `x * y`); the matrix product is {@link matMul}. */
export declare function multiply(x: Operand, y: Operand): number[] | Matrix;
/** Element-wise quotient with R's recycling (R's `x / y`). */
export declare function divide(x: Operand, y: Operand): number[] | Matrix;
/**
 * Outer product of two vectors: the matrix of `fun(x[i], y[j])`. Equivalent to R's `outer()`; `fun` is `"*"`
 * (default), `"+"`, `"-"`, `"/"`, `"^"` or a function of two numbers.
 */
export declare function outer(x: Sample, y: Sample, fun?: "*" | "+" | "-" | "/" | "^" | ((a: number, b: number) => number)): Matrix;
/** Transpose. Equivalent to R's `t()`: a vector becomes a 1-row matrix. */
export declare function t(x: Operand): Matrix;
/** Options for {@link diag}. */
export interface DiagOptions {
    nrow?: number;
    ncol?: number;
}
/**
 * R's `diag()`, with its three meanings: the diagonal of a matrix (as a vector); the diagonal matrix of a vector of
 * length 2 or more (its values recycled along the diagonal of an `nrow` x `ncol` matrix when given); and for a single
 * number n, the n x n identity matrix (with `nrow`/`ncol`, a matrix with that number on the diagonal).
 *
 * @example
 * ```ts
 * diag([[1, 2], [3, 4]]); // [1, 4]
 * diag([2, 3]);           // [[2, 0], [0, 3]]
 * diag(3);                // 3 x 3 identity
 * ```
 */
export declare function diag(x: Operand, options?: DiagOptions): number[] | Matrix;
/** Combine vectors and matrices as columns. Equivalent to R's `cbind()` (vectors recycled to the number of rows). */
export declare function cbind(...args: Operand[]): Matrix;
/** Combine vectors and matrices as rows. Equivalent to R's `rbind()`. */
export declare function rbind(...args: Operand[]): Matrix;
/** Options for {@link matrix}. */
export interface MatrixOptions {
    nrow?: number;
    ncol?: number;
    /** Fill by rows instead of by columns (R's default). Default `false`. */
    byrow?: boolean;
}
/**
 * Build a matrix from data, recycled to fill it. Equivalent to R's `matrix()`: filled by columns unless `byrow`.
 *
 * @example
 * ```ts
 * matrix([1, 2, 3, 4, 5, 6], { nrow: 2 }); // [[1, 3, 5], [2, 4, 6]]
 * matrix(0, { nrow: 2, ncol: 3 });         // zeros
 * ```
 */
export declare function matrix(data: number | Sample, options?: MatrixOptions): Matrix;
/** Kronecker product. Equivalent to R's `kronecker()` (two vectors give a vector). */
export declare function kronecker(x: Operand, y: Operand): number[] | Matrix;
/** Options for {@link seq}. */
export interface SeqOptions {
    /** Increment. */
    by?: number;
    /** Desired length. */
    lengthOut?: number;
}
/**
 * Regular sequences. Equivalent to R's `seq()`: `seq(from, to)` steps by ±1; `by` steps by the increment, up to
 * `to`; `lengthOut` gives that many values, both ends exact. `from` or `to` may be omitted (`undefined`) when the
 * other two are given; `seq(n)` alone is `1, 2, ..., n`.
 *
 * @example
 * ```ts
 * seq(0, 1, { by: 0.25 });     // [0, 0.25, 0.5, 0.75, 1]
 * seq(0, 1, { lengthOut: 3 }); // [0, 0.5, 1]
 * ```
 */
export declare function seq(from?: number, to?: number, options?: SeqOptions): number[];
export {};
