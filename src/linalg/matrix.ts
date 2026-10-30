// Shared linear algebra helpers: matrix input/output format and validation.
//
// Matrices in the public API are arrays of rows (number[][], as in chisqTest; rows may also be Float64Array).
// Internally, computation uses column-major Float64Array as in LAPACK (most traversals run along contiguous columns).
// An array of rows cannot express the column count of a 0-row matrix, so a 0-row matrix is treated as 0x0.

/**
 * A matrix given as an array of rows. Each row may be a plain array or a `Float64Array`;
 * all rows must have the same length. A matrix with zero rows is treated as 0 x 0.
 *
 * @category Linear algebra
 */
export type MatrixInput = readonly (readonly number[] | Float64Array)[];

/**
 * A vector or a matrix (array of rows). Used for arguments that accept either, such as the
 * right-hand side of `backsolve`; a vector is treated as a one-column matrix, as in R.
 *
 * @category Linear algebra
 */
export type VectorOrMatrix = readonly number[] | Float64Array | MatrixInput;

/** Column-major matrix. Element (i, j) is data[i + j * nrow] */
export interface Mat {
  nrow: number;
  ncol: number;
  data: Float64Array;
}

export function newMat(nrow: number, ncol: number): Mat {
  return { nrow, ncol, data: new Float64Array(nrow * ncol) };
}

export function isMatrixInput(x: VectorOrMatrix): x is MatrixInput {
  return x.length > 0 && typeof x[0] !== "number";
}

/** Convert an array of rows to a column-major matrix. Error if the rows differ in length */
export function toMat(x: MatrixInput): Mat {
  const nrow = x.length;
  const ncol = nrow === 0 ? 0 : x[0]!.length;
  const m = newMat(nrow, ncol);
  for (let i = 0; i < nrow; i++) {
    const row = x[i]!;
    if (row.length !== ncol) throw new TypeError("all rows of the matrix must have the same length");
    for (let j = 0; j < ncol; j++) m.data[i + j * nrow] = row[j]!;
  }
  return m;
}

/** A vector becomes a one-column matrix (as R's as.matrix) */
export function toMatOrColumn(x: VectorOrMatrix): Mat {
  if (isMatrixInput(x)) return toMat(x);
  const v = x as readonly number[] | Float64Array;
  return { nrow: v.length, ncol: 1, data: Float64Array.from(v) };
}

/** Convert a column-major matrix back to an array of rows */
export function fromMat(m: Mat): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < m.nrow; i++) {
    const row = new Array<number>(m.ncol);
    for (let j = 0; j < m.ncol; j++) row[j] = m.data[i + j * m.nrow]!;
    out.push(row);
  }
  return out;
}

/** Return column j as an array */
export function column(m: Mat, j: number): number[] {
  return Array.from(m.data.subarray(j * m.nrow, (j + 1) * m.nrow));
}

export function transpose(m: Mat): Mat {
  const t = newMat(m.ncol, m.nrow);
  for (let j = 0; j < m.ncol; j++) {
    for (let i = 0; i < m.nrow; i++) t.data[j + i * m.ncol] = m.data[i + j * m.nrow]!;
  }
  return t;
}

export function hasNonFinite(m: Mat): boolean {
  for (const v of m.data) if (!Number.isFinite(v)) return true;
  return false;
}

export function requireSquare(m: Mat, what = "the matrix"): void {
  if (m.nrow !== m.ncol) throw new TypeError(`${what} must be square (got ${m.nrow} x ${m.ncol})`);
}

/**
 * 0 when the largest absolute value is within [2^-256, 2^256] (or all are 0); otherwise its binary exponent, the
 * power of 2 to divide by to bring the values near 1
 */
export function rangeExponent(data: ArrayLike<number>): number {
  let mx = 0;
  for (let i = 0; i < data.length; i++) mx = Math.max(mx, Math.abs(data[i]!));
  if (mx === 0 || (mx >= 2 ** -256 && mx <= 2 ** 256)) return 0;
  return Math.floor(Math.log2(mx));
}
