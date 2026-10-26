import type { Sample } from "../htest/types.js";
import type { DataFrame } from "../models/modelFrame.js";
/**
 * A vector (plain array) or a matrix (array of rows).
 *
 * @category Linear algebra
 */
export type Operand = number | Sample | readonly (readonly number[])[];
/**
 * Matrix product. Equivalent to R's `%*%`. A vector is taken as a row or a column so that the product is defined
 * (two vectors give their inner product as a 1 x 1 matrix).
 *
 * @example
 * ```ts
 * matMul([[1, 2], [3, 4]], [[5], [6]]); // [[17], [39]]
 * matMul([1, 2, 3], [4, 5, 6]);         // [[32]]
 * ```
 *
 * @category Linear algebra
 */
export declare function matMul(x: Operand, y: Operand): number[][];
/**
 * Element-wise sum with R's recycling (a shorter vector is recycled down the columns of a matrix). Equivalent to
 * R's `+`.
 *
 * @example
 * ```ts
 * add([[1, 2], [3, 4]], [10, 20]); // [[11, 12], [23, 24]]
 * add([1, 2, 3], 2);             // [3, 4, 5]
 * ```
 *
 * @category Linear algebra
 */
export declare function add(x: Operand, y: Operand): number[] | number[][];
/**
 * Element-wise difference with R's recycling (a shorter vector is recycled down the columns of a matrix). Equivalent to
 * R's `-`.
 *
 * @example
 * ```ts
 * subtract([[1, 2], [3, 4]], [10, 20]); // [[-9, -8], [-17, -16]]
 * subtract([1, 2, 3], 2);             // [-1, 0, 1]
 * ```
 *
 * @category Linear algebra
 */
export declare function subtract(x: Operand, y: Operand): number[] | number[][];
/**
 * Element-wise product with R's recycling (a shorter vector is recycled down the columns of a matrix). Equivalent to
 * R's `*`. The matrix product is {@link matMul}.
 *
 * @example
 * ```ts
 * multiply([[1, 2], [3, 4]], [10, 20]); // [[10, 20], [60, 80]]
 * multiply([1, 2, 3], 2);             // [2, 4, 6]
 * ```
 *
 * @category Linear algebra
 */
export declare function multiply(x: Operand, y: Operand): number[] | number[][];
/**
 * Element-wise quotient with R's recycling (a shorter vector is recycled down the columns of a matrix). Equivalent to
 * R's `/`.
 *
 * @example
 * ```ts
 * divide([[1, 2], [3, 4]], [10, 20]); // [[0.1, 0.2], [0.15, 0.2]]
 * divide([1, 2, 3], 2);             // [0.5, 1, 1.5]
 * ```
 *
 * @category Linear algebra
 */
export declare function divide(x: Operand, y: Operand): number[] | number[][];
/**
 * Outer product of two vectors: the matrix of `fun(x[i], y[j])`. Equivalent to R's `outer()`. `fun` is `"*"`
 * (default), `"+"`, `"-"`, `"/"`, `"^"` or a function of two numbers.
 *
 * @example
 * ```ts
 * outer([1, 2], [1, 2, 3]);      // [[1, 2, 3], [2, 4, 6]]
 * outer([1, 2], [1, 2, 3], "+"); // [[2, 3, 4], [3, 4, 5]]
 * ```
 *
 * @category Linear algebra
 */
export declare function outer(x: Sample, y: Sample, fun?: "*" | "+" | "-" | "/" | "^" | ((a: number, b: number) => number)): number[][];
/**
 * Transpose. Equivalent to R's `t()`. A vector becomes a 1-row matrix.
 *
 * @example
 * ```ts
 * t([[1, 2, 3], [4, 5, 6]]); // [[1, 4], [2, 5], [3, 6]]
 * t([1, 2]);                 // [[1, 2]]
 * ```
 *
 * @category Linear algebra
 */
export declare function t(x: Operand): number[][];
/**
 * Options for {@link diag}.
 *
 * @category Linear algebra
 */
export interface DiagOptions {
    /** Number of rows of the matrix built from a vector or a number (R's `nrow`). Default: the length of the vector. */
    nrow?: number;
    /** Number of columns of the matrix built from a vector or a number (R's `ncol`). Default: `nrow`. */
    ncol?: number;
}
/**
 * Matrix diagonals, diagonal matrices and identity matrices. Equivalent to R's `diag()`. It has three meanings: the
 * diagonal of a matrix (as a vector); the diagonal matrix of a vector of length 2 or more (its values recycled along the diagonal of an `nrow` x `ncol` matrix when given); and for a single
 * number n, the n x n identity matrix (with `nrow`/`ncol`, a matrix with that number on the diagonal).
 *
 * @example
 * ```ts
 * diag([[1, 2], [3, 4]]); // [1, 4]
 * diag([2, 3]);           // [[2, 0], [0, 3]]
 * diag(3);                // [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
 * ```
 *
 * @category Linear algebra
 */
export declare function diag(x: Operand, options?: DiagOptions): number[] | number[][];
/**
 * Combine vectors and matrices as columns. Equivalent to R's `cbind()`. Vectors are recycled to the number of rows.
 * Given data frames (objects of columns), puts their columns side by side, as R's `cbind()` of data frames: all must
 * have the same number of rows, and a column name may occur only once.
 *
 * @example
 * ```ts
 * cbind([1, 2], [3, 4]);      // [[1, 3], [2, 4]]
 * cbind([[1, 2], [3, 4]], 0); // [[1, 2, 0], [3, 4, 0]]
 * ```
 *
 * @category Linear algebra
 */
export declare function cbind(...args: Operand[]): number[][];
export declare function cbind(...frames: DataFrame[]): DataFrame;
/**
 * Combine vectors and matrices as rows. Equivalent to R's `rbind()`. Given data frames (objects of columns), stacks
 * their rows, as R's `rbind()` of data frames: all must have the same column names, matched by name (the result has
 * the first frame's column order).
 *
 * @example
 * ```ts
 * rbind([1, 2], [3, 4]);           // [[1, 2], [3, 4]]
 * rbind([[1, 2], [3, 4]], [5, 6]); // [[1, 2], [3, 4], [5, 6]]
 * ```
 *
 * @category Linear algebra
 */
export declare function rbind(...args: Operand[]): number[][];
export declare function rbind(...frames: DataFrame[]): DataFrame;
/**
 * Options for {@link matrix}.
 *
 * @category Linear algebra
 */
export interface MatrixOptions {
    /**
     * Number of rows (R's `nrow`). Default: the length of the data divided by `ncol` (rounded up), or the length of
     * the data when `ncol` is not given either.
     */
    nrow?: number;
    /**
     * Number of columns (R's `ncol`). Default: the length of the data divided by `nrow` (rounded up), or 1 when `nrow`
     * is not given either.
     */
    ncol?: number;
    /** Fill by rows instead of by columns (R's default). Default `false`. */
    byrow?: boolean;
}
/**
 * Build a matrix from data, recycled to fill it. Equivalent to R's `matrix()`. Filled by columns unless `byrow`.
 *
 * @example
 * ```ts
 * matrix([1, 2, 3, 4, 5, 6], { nrow: 2 }); // [[1, 3, 5], [2, 4, 6]]
 * matrix(0, { nrow: 2, ncol: 3 });         // [[0, 0, 0], [0, 0, 0]]
 * ```
 *
 * @category Linear algebra
 */
export declare function matrix(data: number | Sample, options?: MatrixOptions): number[][];
/**
 * Kronecker product. Equivalent to R's `kronecker()`. Two vectors give a vector.
 *
 * @example
 * ```ts
 * kronecker([[1, 2], [3, 4]], [[1, 1]]); // [[1, 1, 2, 2], [3, 3, 4, 4]]
 * kronecker([1, 2], [1, 10]);           // [1, 10, 2, 20]
 * ```
 *
 * @category Linear algebra
 */
export declare function kronecker(x: Operand, y: Operand): number[] | number[][];
/**
 * Options for {@link seq}.
 *
 * @category Linear algebra
 */
export interface SeqOptions {
    /** Increment. */
    by?: number;
    /** Desired length. */
    lengthOut?: number;
}
/**
 * Regular sequences. Equivalent to R's `seq()`. `seq(from, to)` steps by ±1; `by` steps by the increment, up to
 * `to`; `lengthOut` gives that many values, both ends exact. `from` or `to` may be omitted (`undefined`) when the
 * other two are given; `seq(n)` alone is `1, 2, ..., n`.
 *
 * @example
 * ```ts
 * seq(0, 1, { by: 0.25 });     // [0, 0.25, 0.5, 0.75, 1]
 * seq(0, 1, { lengthOut: 3 }); // [0, 0.5, 1]
 * ```
 *
 * @category Linear algebra
 */
export declare function seq(from?: number, to?: number, options?: SeqOptions): number[];
