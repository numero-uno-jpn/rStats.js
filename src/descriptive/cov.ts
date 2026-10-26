// Covariance and correlation of vectors and matrices: R's cov and cor with `method` and `use`.
//
// Written for rStats.js (no ported code). A matrix is an array of rows, its columns the variables. Pearson
// covariances and correlations are computed in double-double (src/internal/summary.ts, src/htest/cor.ts); Spearman's
// are Pearson's of the ranks (ranked after missing values are dropped as `use` says); Kendall's covariance is the
// sum of sign(x_i - x_j) sign(y_i - y_j) over all ordered pairs, as R reports it, and the correlation is tau-b.
// `use` follows R: "everything" (a missing value makes the entry NaN), "all.obs" (missing values are an error),
// "complete.obs" and "na.or.complete" (rows with any missing value are dropped) and "pairwise.complete.obs" (each
// pair of variables uses the rows where both are present).

import { kendall, pearsonDD, type CorMethod } from "../htest/cor.js";
import type { Sample } from "../htest/types.js";
import { covariance } from "../internal/summary.js";
import { rank } from "./rank.js";

export type { CorMethod };

/**
 * Handling of missing values, as R's `use`.
 *
 * @category Descriptive statistics
 */
export type CorUse = "everything" | "all.obs" | "complete.obs" | "na.or.complete" | "pairwise.complete.obs";

/**
 * Options for {@link cov} and {@link cor}.
 *
 * @category Descriptive statistics
 */
export interface CovOptions {
  /** Default `"pearson"`. Unambiguous abbreviations are accepted. */
  method?: CorMethod | (string & {});
  /** Default `"everything"`. Unambiguous abbreviations are accepted. */
  use?: CorUse | (string & {});
}

const METHODS: CorMethod[] = ["pearson", "kendall", "spearman"];
const USES: CorUse[] = ["all.obs", "complete.obs", "pairwise.complete.obs", "everything", "na.or.complete"];

function match<T extends string>(v: string | undefined, all: readonly T[], dflt: T, what: string): T {
  if (v === undefined) return dflt;
  if ((all as readonly string[]).includes(v)) return v as T;
  const hit = all.filter((a) => a.startsWith(v));
  if (v.length === 0 || hit.length !== 1) throw new RangeError(`invalid '${what}' argument`);
  return hit[0]!;
}

type Input = Sample | readonly (readonly number[])[];

function isMatrix(x: Input): x is readonly (readonly number[])[] {
  return x.length > 0 && Array.isArray(x[0]);
}

/** Columns of a matrix (array of rows), or the vector as one column */
function columns(x: Input): number[][] {
  if (!isMatrix(x)) return [Array.from(x as Sample)];
  const ncol = x[0]!.length;
  return Array.from({ length: ncol }, (_, j) => x.map((r) => r[j]!));
}

function compute(x: Input, y: Input | undefined, options: CovOptions, correlation: boolean): number | number[][] {
  const method = match(options.method, METHODS, "pearson", "method");
  const use = match(options.use, USES, "everything", "use");
  if (y === undefined && !isMatrix(x)) throw new TypeError("supply both 'x' and 'y' or a matrix-like 'x'");
  const cx = columns(x);
  const cy = y === undefined ? cx : columns(y);
  const n = cx[0]?.length ?? 0;
  if (cy.some((c) => c.length !== n)) throw new RangeError("incompatible dimensions");
  const all = [...cx, ...cy];
  if (use === "all.obs" && all.some((c) => c.some(Number.isNaN))) throw new RangeError("missing observations in cov/cor");
  if (!correlation && use === "pairwise.complete.obs" && method !== "pearson") {
    throw new RangeError("cannot handle 'pairwise.complete.obs'");
  }
  let keepRows: boolean[] | undefined;
  if (use === "complete.obs" || use === "na.or.complete") {
    keepRows = Array.from({ length: n }, (_, i) => all.every((c) => !Number.isNaN(c[i]!)));
    if (!keepRows.some(Boolean)) {
      if (use === "complete.obs") throw new RangeError("no complete element pairs");
      return y === undefined || isMatrix(x) || isMatrix(y) ? cx.map(() => cy.map(() => NaN)) : NaN;
    }
  }
  const prep = (c: number[]): number[] => {
    const v = keepRows === undefined ? c : c.filter((_, i) => keepRows![i]);
    // ranks for Spearman, missing values kept in place (pairwise ranks are taken per pair below)
    return method === "spearman" && use !== "pairwise.complete.obs" ? rank(v, { naLast: "keep" }) : v;
  };
  const px = cx.map(prep);
  const py = y === undefined ? px : cy.map(prep);
  const entry = (a: number[], b: number[]): number => {
    let u = a;
    let v = b;
    if (use === "pairwise.complete.obs") {
      const ok = a.map((t, i) => !Number.isNaN(t) && !Number.isNaN(b[i]!));
      u = a.filter((_, i) => ok[i]);
      v = b.filter((_, i) => ok[i]);
      if (method === "spearman") {
        u = rank(u);
        v = rank(v);
      }
    } else if (u.some(Number.isNaN) || v.some(Number.isNaN)) return NaN;
    // fewer than 2 observations (for "pairwise.complete.obs", in this pair): NaN, as in R, for every method
    if (u.length < 2) return NaN;
    if (method === "kendall") {
      if (correlation) return kendall(u, v).tau;
      return 2 * kendall(u, v).s;
    }
    if (correlation) return pearsonDD(u, v)[0];
    return covariance(u, v);
  };
  const out = px.map((a) => py.map((b) => entry(a, b)));
  // as in R, the correlation matrix of x alone has 1 on the diagonal, whatever the column holds, unless fewer than 2
  // observations are used (then it is all NaN)
  const used = keepRows === undefined ? n : keepRows.filter(Boolean).length;
  if (correlation && y === undefined && use !== "pairwise.complete.obs" && used >= 2) out.forEach((r, i) => (r[i] = 1));
  return (y === undefined ? false : !isMatrix(x) && !isMatrix(y)) ? out[0]![0]! : out;
}

/**
 * Covariance of two vectors, or covariance matrix of the columns of a matrix (or between the columns of `x` and `y`).
 * Equivalent to R's `cov()`.
 *
 * @example
 * ```ts
 * cov([1, 2, 3, 4], [2, 4, 5, 9]);       // 3.6666666666666665
 * cov([[1, 2], [2, 4], [3, 5], [4, 9]]); // [[1.6666666666666667, 3.6666666666666665], [3.6666666666666665, 8.666666666666666]]
 * ```
 *
 * @category Descriptive statistics
 */
export function cov(x: Sample, y: Sample, options?: CovOptions): number;
export function cov(x: Sample | readonly (readonly number[])[], y?: Sample | readonly (readonly number[])[], options?: CovOptions): number | number[][];
export function cov(x: Sample | readonly (readonly number[])[], y?: Sample | readonly (readonly number[])[] | CovOptions, options: CovOptions = {}): number | number[][] {
  if (y !== undefined && !Array.isArray(y) && !ArrayBuffer.isView(y)) return compute(x, undefined, y as CovOptions, false);
  return compute(x, y as Input | undefined, options, false);
}

/**
 * Correlation of two vectors, or correlation matrix of the columns of a matrix (or between the columns of `x` and
 * `y`). Equivalent to R's `cor()`. Pearson correlations are computed in double-double, so they can be slightly more
 * accurate than R's (exactly 1 for perfectly correlated data).
 *
 * @example
 * ```ts
 * cor([1, 2, 3, 4], [2, 4, 5, 9]);                         // 0.9647638212377322
 * cor([1, 2, 3, 4], [2, 4, 5, 9], { method: "spearman" }); // 1
 * ```
 *
 * @category Descriptive statistics
 */
export function cor(x: Sample, y: Sample, options?: CovOptions): number;
export function cor(x: Sample | readonly (readonly number[])[], y?: Sample | readonly (readonly number[])[], options?: CovOptions): number | number[][];
export function cor(x: Sample | readonly (readonly number[])[], y?: Sample | readonly (readonly number[])[] | CovOptions, options: CovOptions = {}): number | number[][] {
  if (y !== undefined && !Array.isArray(y) && !ArrayBuffer.isView(y)) return compute(x, undefined, y as CovOptions, true);
  return compute(x, y as Input | undefined, options, true);
}
