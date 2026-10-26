// Helpers for the linear algebra tests. The fixture format is the same as for hypothesis tests (htest.ts).

import { num } from "./fixture.js";
import type { HTestArg, HTestCase } from "./htest.js";

type Field = HTestCase["expected"][string];

function values(v: Field | HTestArg | undefined): number[] {
  if (v === undefined || typeof v === "boolean") return [];
  if (typeof v === "string") return [num(v)];
  return (v as (string | string[])[]).flat().map((s) => num(s));
}

/** Maximum absolute value of a field (finite values only). Matrix and vector errors are measured relative to this (normwise error). */
export function maxAbsOf(v: Field | HTestArg | undefined): number {
  let m = 0;
  for (const x of values(v)) if (Number.isFinite(x)) m = Math.max(m, Math.abs(x));
  return m;
}

/** Uses the maximum absolute value of expected field `field` as the floor (normwise relative error) */
export const normwise =
  (field: string) =>
  (c: HTestCase): number =>
    maxAbsOf(c.expected[field]);

/** Column 2-norms of a matrix (array of rows) */
export function columnNorms(v: HTestArg | undefined): number[] {
  if (v === undefined || typeof v === "boolean") return [];
  if (typeof v === "string") return [Math.abs(num(v))];
  const rows = (Array.isArray(v[0]) ? v : (v as string[]).map((s) => [s])) as string[][];
  const p = rows[0]?.length ?? 0;
  const out = new Array<number>(p).fill(0);
  for (const r of rows) r.forEach((s, j) => (out[j]! += num(s) ** 2));
  return out.map(Math.sqrt);
}

/** Row 2-norms of a matrix (array of rows). A vector is treated as a one-column matrix. */
export function rowNorms(v: HTestArg | undefined): number[] {
  if (v === undefined || typeof v === "boolean") return [];
  if (typeof v === "string") return [Math.abs(num(v))];
  if (!Array.isArray(v[0])) return (v as string[]).map((s) => Math.abs(num(s)));
  return (v as string[][]).map((r) => Math.sqrt(r.reduce((s, x) => s + num(x) ** 2, 0)));
}

/** Maximum of the finite values (0 if none) */
export const finiteMax = (xs: number[]): number => xs.filter(Number.isFinite).reduce((a, b) => Math.max(a, b), 0);

/**
 * Floor scaled by the condition number. When the order of operations differs from R (OpenBLAS), rounding
 * differences grow with the condition number. The allowed error is
 * "max absolute value of the field × max(tol, factor × ε × cond^power)". cond is the condition number the oracle put in args.
 */
export const condScaled =
  (field: string, tol: number, power: number, factor = 1) =>
  (c: HTestCase): number => {
    const cond = c.args.cond === undefined ? 1 : num(c.args.cond as string);
    return (maxAbsOf(c.expected[field]) * Math.max(tol, factor * Number.EPSILON * cond ** power)) / tol;
  };

/**
 * Columns (1-based) whose vectors are not determined, from their singular values or standard deviations d (same
 * rule as vector_mask in oracle/_linalg.R): a value within 1e-8 (relative to the largest) of another, or at most
 * 1e-13 times the largest. All of them if every value is 0.
 */
export function vectorMask(d: readonly number[]): number[] {
  const s = Math.max(...d.map(Math.abs));
  if (s === 0) return d.map((_, k) => k + 1);
  const gap = (k: number) => (d.length === 1 ? 1 : Math.min(...d.filter((_, j) => j !== k).map((v) => Math.abs(d[k]! - v))) / s);
  return d.flatMap((v, k) => (gap(k) < 1e-8 || Math.abs(v) <= 1e-13 * s ? [k + 1] : []));
}

/**
 * Normalizes the columns of singular/eigenvector matrices (same rule as align_columns in oracle/_linalg.R).
 * Columns listed in mask (1-based) are set to NaN; in the remaining columns, the first component whose absolute
 * value is at least (1 - 1e-8) times the maximum is made positive. The same column of partner (v for u) is flipped too.
 */
export function alignColumns(m: number[][], mask: readonly number[], partner?: number[][]): void {
  const ncol = m[0]?.length ?? 0;
  for (let k = 0; k < ncol; k++) {
    if (mask.includes(k + 1)) {
      for (const r of m) r[k] = NaN;
      if (partner && k < (partner[0]?.length ?? 0)) for (const r of partner) r[k] = NaN;
      continue;
    }
    const a = m.map((r) => Math.abs(r[k]!));
    const top = Math.max(...a);
    const i = a.findIndex((v) => v >= top * (1 - 1e-8));
    if (m[i]![k]! < 0) {
      for (const r of m) r[k] = -r[k]!;
      if (partner && k < (partner[0]?.length ?? 0)) for (const r of partner) r[k] = -r[k]!;
    }
  }
  if (partner) for (const k of mask) if (k > ncol) for (const r of partner) if (k <= r.length) r[k - 1] = NaN;
}

/**
 * Normalizes the columns of complex eigenvector matrices (same rule as align_complex in oracle/_linalg.R).
 * Columns listed in mask (1-based) are set to NaN; each remaining column is multiplied by a phase so that the
 * first component whose modulus is at least (1 - 1e-8) times the maximum becomes a positive real number.
 */
export function alignComplexColumns(re: number[][], im: number[][], mask: readonly number[]): void {
  const ncol = re[0]?.length ?? 0;
  for (let k = 0; k < ncol; k++) {
    if (mask.includes(k + 1)) {
      for (const r of re) r[k] = NaN;
      for (const r of im) r[k] = NaN;
      continue;
    }
    const mod = re.map((r, i) => Math.hypot(r[k]!, im[i]![k]!));
    const top = Math.max(...mod);
    const i0 = mod.findIndex((v) => v >= top * (1 - 1e-8));
    const cr = re[i0]![k]! / mod[i0]!;
    const ci = -im[i0]![k]! / mod[i0]!;
    re.forEach((r, i) => {
      const a = r[k]!;
      const b = im[i]![k]!;
      r[k] = a * cr - b * ci;
      im[i]![k] = a * ci + b * cr;
    });
    im[i0]![k] = 0;
  }
}
