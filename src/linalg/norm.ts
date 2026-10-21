// Matrix norms (R's norm).
//
// Computed with the same definitions as the LAPACK 3.12.0 reference SRC/dlange.f (NaN if any NaN).
// The Frobenius norm divides by the largest absolute value before squaring and summing, to avoid overflow and underflow
// (dlange does the same via dlassq). LAPACK is modified BSD; see THIRD_PARTY_NOTICES.md.
// Accepted type values follow observed R output (a single character, case-insensitive;
// "1" is the same as "O", "E" the same as "F").

import { toMat, type Mat, type MatrixInput } from "./matrix.js";
import { svdValues } from "./svd.js";

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
export function norm(x: MatrixInput, options: NormOptions = {}): number {
  const m = toMat(x);
  const type = options.type ?? "O";
  if (type.length !== 1) throw new RangeError(`type must be a single character (got "${type}")`);
  switch (type.toUpperCase()) {
    case "O":
    case "1":
      return oneNorm(m);
    case "I":
      return infNorm(m);
    case "F":
    case "E":
      return frobenius(m);
    case "M":
      return maxAbs(m);
    case "2":
      return twoNorm(m);
    default:
      throw new RangeError(`type must be one of "O", "I", "F", "M" and "2" (got "${type}")`);
  }
}

/** NaN if any value is NaN, otherwise the maximum (as DISNAN in dlange) */
function maxOf(acc: number, v: number): number {
  return Number.isNaN(acc) || Number.isNaN(v) ? NaN : Math.max(acc, v);
}

export function oneNorm(m: Mat): number {
  let r = 0;
  for (let j = 0; j < m.ncol; j++) {
    let s = 0;
    for (let i = 0; i < m.nrow; i++) s += Math.abs(m.data[i + j * m.nrow]!);
    r = maxOf(r, s);
  }
  return r;
}

export function infNorm(m: Mat): number {
  const s = new Float64Array(m.nrow);
  for (let j = 0; j < m.ncol; j++) {
    for (let i = 0; i < m.nrow; i++) s[i]! += Math.abs(m.data[i + j * m.nrow]!);
  }
  let r = 0;
  for (const v of s) r = maxOf(r, v);
  return r;
}

export function maxAbs(m: Mat): number {
  let r = 0;
  for (const v of m.data) r = maxOf(r, Math.abs(v));
  return r;
}

export function frobenius(m: Mat): number {
  const scale = maxAbs(m);
  if (scale === 0 || !Number.isFinite(scale)) return scale;
  let s = 0;
  for (const v of m.data) {
    const u = v / scale;
    s += u * u;
  }
  return scale * Math.sqrt(s);
}

/** Largest singular value. NaN if any NaN, error if any Inf (from R's output) */
function twoNorm(m: Mat): number {
  if (m.nrow === 0 || m.ncol === 0) return 0;
  if (m.data.some(Number.isNaN)) return NaN;
  if (m.data.some((v) => !Number.isFinite(v))) throw new RangeError("the matrix contains infinite values");
  return svdValues(m)[0]!;
}
