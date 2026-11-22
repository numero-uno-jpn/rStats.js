// Canonical correlation from the cross-product matrices and their symmetric whitening decompositions.

import { eigen } from "../linalg/eigen.js";
import { svd } from "../linalg/svd.js";
import { qr } from "../linalg/qr.js";
import { fromMat, toMatOrColumn, type VectorOrMatrix } from "../linalg/matrix.js";
import { mean } from "../internal/summary.js";

/** Options for canonical correlation.
 * @category Linear models and ANOVA
 */
export interface CancorOptions {
  xcenter?: boolean | readonly number[];
  ycenter?: boolean | readonly number[];
  tol?: number;
  xNames?: readonly string[];
  yNames?: readonly string[];
}
/** Result of canonical correlation.
 * @category Linear models and ANOVA
 */
export interface CancorResult {
  cor: number[] | number;
  xcoef: { rows: string[] | string | null; cols: null; values: number[][] };
  ycoef: { rows: string[] | string | null; cols: null; values: number[][] };
  xcenter: number[] | number;
  ycenter: number[] | number;
}
function cross(a: number[][], b: number[][] = a): number[][] {
  const out = Array.from({ length: a[0]?.length ?? 0 }, () => new Array<number>(b[0]?.length ?? 0).fill(0));
  for (let i = 0; i < a.length; i++) for (let j = 0; j < a[i]!.length; j++) for (let k = 0; k < (b[0]?.length ?? 0); k++) out[j]![k]! += a[i]![j]! * b[i]![k]!;
  return out;
}
function mul(a: number[][], b: number[][]): number[][] {
  const out = Array.from({ length: a.length }, () => new Array<number>(b[0]?.length ?? 0).fill(0));
  for (let i = 0; i < a.length; i++) for (let k = 0; k < (a[0]?.length ?? 0); k++) for (let j = 0; j < (b[0]?.length ?? 0); j++) out[i]![j]! += a[i]![k]! * b[k]![j]!;
  return out;
}
function inverseSqrt(a: number[][], tol: number): number[][] {
  const e = eigen(a, { symmetric: true });
  const max = Math.max(0, ...e.values);
  const keep = e.values.map((v, i) => v > max * tol ? i : -1).filter((i) => i >= 0);
  if (keep.length !== a.length) throw new RangeError("rank reduction failed in canonical correlation");
  const q = e.vectors!;
  const out = Array.from({ length: a.length }, () => new Array<number>(a.length).fill(0));
  for (const k of keep) for (let i = 0; i < a.length; i++) for (let j = 0; j < a.length; j++) out[i]![j]! += q[i]![k]! * q[j]![k]! / Math.sqrt(e.values[k]!);
  return out;
}
function centerArg(arg: boolean | readonly number[] | undefined, a: number[][], name: string): number[] {
  if (arg === false) return new Array<number>(a[0]!.length).fill(0);
  if (Array.isArray(arg)) {
    if (arg.length !== a[0]!.length || !arg.every(Number.isFinite)) throw new RangeError(`${name} must be a finite vector with one value per column`);
    return Array.from(arg);
  }
  return a[0]!.map((_, j) => mean(a.map((r) => r[j]!)));
}
function namesOrDefault(names: readonly string[] | undefined, p: number, prefix: string): string[] {
  if (names !== undefined && names.length !== p) throw new RangeError(`${prefix}Names must match the number of columns`);
  return names === undefined ? Array.from({ length: p }, (_, i) => `${prefix}${i + 1}`) : Array.from(names);
}

/**
 * Canonical correlation analysis. Equivalent to R's `stats::cancor()`. Coefficients use the unscaled cross-products, with deterministic paired signs.
 *
 * @param x First data matrix or vector.
 * @param y Second data matrix or vector.
 * @param options Column centering, rank tolerance, and optional column names.
 *
 * @category Linear models and ANOVA
 */
export function cancor(x: VectorOrMatrix, y: VectorOrMatrix, options: CancorOptions = {}): CancorResult {
  const xm = fromMat(toMatOrColumn(x)), ym = fromMat(toMatOrColumn(y));
  if (xm.length !== ym.length) throw new RangeError("x and y must have the same number of rows");
  if (xm.length < 2 || xm[0]!.length === 0 || ym[0]!.length === 0) throw new RangeError("at least two rows and one column are required");
  if (xm.some((r) => r.some((v) => !Number.isFinite(v))) || ym.some((r) => r.some((v) => !Number.isFinite(v)))) {
    throw new RangeError("NA/NaN/Inf in foreign function call (arg 1)");
  }
  const tol = options.tol ?? 1e-7;
  if (!(Number.isFinite(tol) && tol >= 0)) throw new RangeError("'tol' must be a non-negative finite number");
  const xc = centerArg(options.xcenter, xm, "xcenter"), yc = centerArg(options.ycenter, ym, "ycenter");
  const x0 = xm.map((r) => r.map((v, j) => v - xc[j]!));
  const y0 = ym.map((r) => r.map((v, j) => v - yc[j]!));
  const sx = x0[0]!.map((_, j) => { let m = 0; for (const r of x0) m = Math.max(m, Math.abs(r[j]!)); return m || 1; });
  const sy = y0[0]!.map((_, j) => { let m = 0; for (const r of y0) m = Math.max(m, Math.abs(r[j]!)); return m || 1; });
  const xs = x0.map((r) => r.map((v, j) => v / sx[j]!));
  const ys = y0.map((r) => r.map((v, j) => v / sy[j]!));
  const qx = qr(xs, { tol }), qy = qr(ys, { tol });
  if (qx.rank === 0 || qy.rank === 0) throw new RangeError("at least one non-constant column is required in each matrix");
  const px = qx.pivot.slice(0, qx.rank), py = qy.pivot.slice(0, qy.rank);
  const xr = xs.map((r) => px.map((j) => r[j]!)), yr = ys.map((r) => py.map((j) => r[j]!));
  const sxx = cross(xr), syy = cross(yr), sxy = cross(xr, yr);
  const ix = inverseSqrt(sxx, tol), iy = inverseSqrt(syy, tol);
  const k = mul(mul(ix, sxy), iy);
  const dec = svd(k);
  const ncan = Math.min(qx.rank, qy.rank, dec.d.length);
  const u = dec.u!, v = dec.v!;
  let ax: number[][];
  let by: number[][];
  // Convert coefficients from scaled columns back to original units.
  ax = mul(ix, u.map((r) => r.slice(0, ncan))).map((r, i) => r.map((z) => z / sx[px[i]!]!));
  by = mul(iy, v.map((r) => r.slice(0, ncan))).map((r, i) => r.map((z) => z / sy[py[i]!]!));
  for (let j = 0; j < ncan; j++) {
    let ixMax = 0;
    for (let i = 1; i < ax.length; i++) if (Math.abs(ax[i]![j]!) > Math.abs(ax[ixMax]![j]!)) ixMax = i;
    if (ax[ixMax]![j]! < 0) {
      for (const r of ax) r[j] = -r[j]!;
      for (const r of by) r[j] = -r[j]!;
    }
    let cov = 0;
    for (let i = 0; i < xr.length; i++) {
      let xv = 0, yv = 0;
      for (let a = 0; a < ax.length; a++) xv += xr[i]![a]! * ax[a]![j]! * sx[px[a]]!;
      for (let b = 0; b < by.length; b++) yv += yr[i]![b]! * by[b]![j]! * sy[py[b]]!;
      cov += xv * yv;
    }
    if (cov < 0) for (const r of by) r[j] = -r[j]!;
  }
  const xNames = namesOrDefault(options.xNames, xm[0]!.length, "x");
  const yNames = namesOrDefault(options.yNames, ym[0]!.length, "y");
  const xRows = options.xNames === undefined ? null : px.map((i) => xNames[i]!);
  const yRows = options.yNames === undefined ? null : py.map((i) => yNames[i]!);
  const cor = dec.d.slice(0, ncan);
  return {
    cor: cor.length === 1 ? cor[0]! : cor,
    xcoef: { rows: xRows === null ? null : xRows.length === 1 ? xRows[0]! : xRows, cols: null, values: ax },
    ycoef: { rows: yRows === null ? null : yRows.length === 1 ? yRows[0]! : yRows, cols: null, values: by },
    xcenter: xc.length === 1 ? xc[0]! : xc,
    ycenter: yc.length === 1 ? yc[0]! : yc,
  };
}
