// Maximum-likelihood factor analysis, R's factanal(), with the varimax and promax rotations. Written for rStats.js
// from the specification oracle/factanal-behaviour.md (no R code was read or used): the uniquenesses minimise the
// likelihood criterion by L-BFGS-B (this library's optim), the loadings come from the eigendecomposition of the
// scaled correlation matrix, and the rotations are Kaiser's varimax (normalised) and Hendrickson and White's promax.

import { pchisq } from "../distributions/chisq.js";
import { eigen } from "../linalg/eigen.js";
import { qr, qrCoef } from "../linalg/qr.js";
import { solve } from "../linalg/solve.js";
import { svd } from "../linalg/svd.js";
import { optim } from "../optim/optim.js";
import { twoSum } from "../special/dd.js";
import { cov } from "./cov.js";

/** Rotations of {@link factanal} */
export type FactanalRotation = "varimax" | "promax" | "none";

/** Options of {@link factanal} */
export interface FactanalOptions {
  /** A covariance (or correlation) matrix to analyse instead of the data `x` (pass `null` as `x`). */
  covmat?: readonly (readonly number[])[];
  /** The number of observations behind `covmat` (for the test statistic). Default: unknown. */
  nObs?: number;
  /** Default `"varimax"`. */
  rotation?: FactanalRotation;
  control?: {
    /** Lower bound of the uniquenesses. Default 0.005. */
    lower?: number;
    /** Starting uniquenesses. Default `(1 - factors / (2p)) / diag(solve(S))`. */
    start?: readonly number[];
  };
}

/** Result of {@link factanal} */
export interface FactanalResult {
  uniquenesses: number[];
  /** The (rotated) loadings, p rows by `factors` columns, columns sorted by decreasing sum of squares, each column's sum positive */
  loadings: number[][];
  /** The rotation matrix (absent for `rotation: "none"` and for one factor) */
  rotmat?: number[][];
  /** The likelihood-ratio statistic (NaN without n.obs or with no degrees of freedom) */
  STATISTIC: number;
  dof: number;
  /** Its upper chi-squared tail probability (NaN as STATISTIC) */
  PVAL: number;
  converged: boolean;
  /** The minimised criterion */
  objective: number;
  /** optim's counts of function and gradient evaluations */
  counts: [number, number];
}

/** Sum rounded once (R's long double accumulation, here double-double) */
function sumOnce(xs: readonly number[]): number {
  let hi = 0;
  let lo = 0;
  for (const x of xs) {
    const [s, e] = twoSum(hi, x);
    hi = s;
    lo += e;
  }
  return hi + lo;
}

const colSumsOf = (m: readonly (readonly number[])[], f: (v: number) => number): number[] =>
  m[0]!.map((_, j) => sumOnce(m.map((r) => f(r[j]!))));

/** The scaled matrix D S D with D = diag(1/sqrt(psi)) */
function scaled(S: readonly (readonly number[])[], psi: readonly number[]): number[][] {
  const d = psi.map((v) => 1 / Math.sqrt(v));
  return S.map((row, i) => row.map((v, j) => d[i]! * v * d[j]!));
}

/** Loadings at psi: diag(sqrt(psi)) V diag(sqrt(max(e - 1, 0))) from the first q eigenvectors of D S D */
function loadingsAt(S: readonly (readonly number[])[], psi: readonly number[], q: number): number[][] {
  const E = eigen(scaled(S, psi), { symmetric: true });
  const w = E.values.slice(0, q).map((e) => Math.sqrt(Math.max(e - 1, 0)));
  return E.vectors!.map((row, i) => row.slice(0, q).map((v, k) => Math.sqrt(psi[i]!) * (v * w[k]!)));
}

/** Columns sorted by decreasing sum of squares, each made to have a positive sum; `rot` (if any) permuted and signed alike */
function sortLoadings(L: number[][], rot?: number[][]): { L: number[][]; rot?: number[][] } {
  const ssq = colSumsOf(L, (v) => v * v);
  const order = ssq.map((_, j) => j).sort((a, b) => ssq[b]! - ssq[a]! || a - b);
  let out = L.map((r) => order.map((j) => r[j]!));
  let R = rot?.map((r) => order.map((j) => r[j]!));
  const sign = colSumsOf(out, (v) => v).map((s) => (s < 0 ? -1 : 1));
  out = out.map((r) => r.map((v, j) => (sign[j]! < 0 ? -v : v)));
  R = R?.map((r) => r.map((v, j) => (sign[j]! < 0 ? -v : v)));
  return R === undefined ? { L: out } : { L: out, rot: R };
}

const matMul = (A: readonly (readonly number[])[], B: readonly (readonly number[])[]): number[][] =>
  A.map((row) => B[0]!.map((_, j) => {
    let s = 0;
    for (let k = 0; k < row.length; k++) s += row[k]! * B[k]![j]!;
    return s;
  }));
const transpose = (A: readonly (readonly number[])[]): number[][] => A[0]!.map((_, j) => A.map((r) => r[j]!));

/** Varimax rotation (normalised, eps 1e-5, at most 1000 iterations) */
function varimax(L: readonly (readonly number[])[]): { loadings: number[][]; rotmat: number[][] } {
  const k = L[0]!.length;
  const p = L.length;
  const len = L.map((r) => Math.sqrt(sumOnce(r.map((v) => v * v))));
  const X = L.map((r, i) => r.map((v) => v / len[i]!));
  const Xt = transpose(X);
  let T: number[][] = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => (i === j ? 1 : 0)));
  let total = 0;
  for (let it = 0; it < 1000; it++) {
    const Z = matMul(X, T);
    const css = Z[0]!.map((_, j) => {
      let s = 0;
      for (let i = 0; i < p; i++) s += Z[i]![j]! * Z[i]![j]!;
      return s;
    });
    const W = Z.map((r) => r.map((z, j) => z ** 3 - (z * css[j]!) / p));
    const B = matMul(Xt, W);
    const sv = svd(B);
    T = matMul(sv.u!, transpose(sv.v!));
    const previous = total;
    total = sumOnce(sv.d);
    if (total < previous * (1 + 1e-5)) break;
  }
  const Z = matMul(X, T);
  return { loadings: Z.map((r, i) => r.map((v) => v * len[i]!)), rotmat: T };
}

/** Promax rotation (m = 4) */
function promax(L: readonly (readonly number[])[]): { loadings: number[][]; rotmat: number[][] } {
  const v = varimax(L);
  const X = v.loadings;
  const Q = X.map((r) => r.map((x) => x * Math.abs(x) ** 3));
  const U0 = qrCoef(qr(X), Q) as number[][];
  const d = solve(matMul(transpose(U0), U0)).map((r, i) => r[i]!);
  const U = U0.map((r) => r.map((u, j) => u * Math.sqrt(d[j]!)));
  return { loadings: matMul(X, U), rotmat: matMul(v.rotmat, U) };
}

/**
 * Maximum-likelihood factor analysis of a data matrix (rows are observations) or, with `options.covmat`, of a
 * covariance matrix. Equivalent to R's `factanal()` with `rotation` `"varimax"`, `"promax"` or `"none"`.
 *
 * @param x The data matrix (array of rows), or `null` with `options.covmat`.
 * @param factors The number of factors.
 *
 * @example
 * ```ts
 * const fa = factanal(x, 2); // x: an n x 6 data matrix
 * fa.uniquenesses; fa.loadings; fa.PVAL;
 * ```
 */
export function factanal(x: readonly (readonly number[])[] | null, factors: number, options: FactanalOptions = {}): FactanalResult {
  let cv: number[][];
  let nObs: number;
  if (options.covmat !== undefined) {
    cv = options.covmat.map((r) => r.slice());
    nObs = options.nObs ?? NaN;
  } else {
    if (x === null) throw new TypeError("neither 'x' nor 'covmat' supplied");
    cv = cov(x as number[][]) as number[][];
    nObs = x.length;
  }
  const p = cv.length;
  if (p < 3) throw new RangeError("factor analysis requires at least three variables");
  const q = factors;
  if (!Number.isInteger(q) || q < 1) throw new RangeError("'factors' must be a positive integer");
  const dof = ((p - q) ** 2 - p - q) / 2;
  if (dof < 0) throw new RangeError(`${q} ${q === 1 ? "factor is" : "factors are"} too many for ${p} variables`);
  const sds = cv.map((r, i) => Math.sqrt(r[i]!));
  const S = cv.map((r, i) => r.map((v, j) => v / (sds[i]! * sds[j]!)));

  const lower = options.control?.lower ?? 0.005;
  const start = options.control?.start?.slice() ?? (solve(S) as number[][]).map((r, i) => (1 - q / (2 * p)) / r[i]!);
  const objective = (psi: number[]): number => {
    const e = eigen(scaled(S, psi), { symmetric: true, onlyValues: true }).values.slice(q);
    return -(sumOnce(e.map((v) => Math.log(v) - v)) - q + p);
  };
  const gradient = (psi: number[]): number[] => {
    const L = loadingsAt(S, psi, q);
    return psi.map((v, i) => {
      let s = 0;
      for (let k = 0; k < q; k++) s += L[i]![k]! * L[i]![k]!;
      return (s + v - S[i]![i]!) / (v * v);
    });
  };
  const fit = optim(start, objective, {
    gr: gradient,
    method: "L-BFGS-B",
    lower,
    upper: 1,
    control: { fnscale: 1, parscale: new Array<number>(p).fill(0.01) },
  });
  if (fit.convergence !== 0) throw new Error("unable to optimize from this starting value");
  const psi = fit.par;
  let L = sortLoadings(loadingsAt(S, psi, q)).L;
  let rotmat: number[][] | undefined;
  const rotation = options.rotation ?? "varimax";
  if (rotation !== "none" && q >= 2) {
    const r = rotation === "varimax" ? varimax(L) : promax(L);
    const sorted = sortLoadings(r.loadings, r.rotmat);
    L = sorted.L;
    rotmat = sorted.rot;
  } else if (rotation !== "varimax" && rotation !== "promax" && rotation !== "none") {
    throw new RangeError(`unknown rotation '${String(rotation)}'`);
  }
  let STATISTIC = NaN;
  let PVAL = NaN;
  if (!Number.isNaN(nObs) && dof > 0) {
    STATISTIC = (nObs - 1 - (2 * p + 5) / 6 - (2 * q) / 3) * fit.value;
    PVAL = pchisq(STATISTIC, dof, { lowerTail: false });
  }
  const out: FactanalResult = {
    uniquenesses: psi,
    loadings: L,
    STATISTIC,
    dof,
    PVAL,
    converged: true,
    objective: fit.value,
    counts: fit.counts,
  };
  if (rotmat !== undefined) out.rotmat = rotmat;
  return out;
}
