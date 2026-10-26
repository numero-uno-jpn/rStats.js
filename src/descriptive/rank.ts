// Ranks with R's tie methods and placement of missing values (R's rank).
//
// Written for rStats.js (no ported code). Missing values (NaN) are ranked apart: kept as NaN, or given the ranks after
// (or before) all the others in their order of appearance. "random" breaks ties with R's uniform random numbers, one
// per non-missing value, so the result follows setSeed as R's follows set.seed.

import { runif } from "../random/continuous.js";
import type { Sample } from "../htest/types.js";

/**
 * How ties are ranked, as R's `ties.method`.
 *
 * @category Descriptive statistics
 */
export type TiesMethod = "average" | "first" | "last" | "random" | "max" | "min";

/**
 * Options for {@link rank}.
 *
 * @category Descriptive statistics
 */
export interface RankOptions {
  /** Ranks of tied values. Default `"average"`. */
  tiesMethod?: TiesMethod;
  /**
   * Missing values: `"last"` (default, R's `na.last = TRUE`) ranks them after the others, `"first"` (`FALSE`) before
   * them, `"keep"` leaves them `NaN`.
   */
  naLast?: "last" | "first" | "keep";
}

/** Ranks of values without NaN */
function rankValues(x: readonly number[], method: TiesMethod): number[] {
  const n = x.length;
  const r = new Array<number>(n);
  if (method === "first" || method === "last" || method === "random") {
    const u = method === "random" ? runif(n) : [];
    const idx = Array.from({ length: n }, (_, i) => i);
    idx.sort((a, b) => {
      const d = x[a]! - x[b]!;
      if (d !== 0) return d;
      if (method === "first") return a - b;
      if (method === "last") return b - a;
      return u[a]! - u[b]! || a - b;
    });
    idx.forEach((i, k) => (r[i] = k + 1));
    return r;
  }
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a]! - x[b]! || a - b);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && x[idx[j + 1]!] === x[idx[i]!]) j++;
    const v = method === "average" ? (i + j + 2) / 2 : method === "min" ? i + 1 : j + 1;
    for (let k = i; k <= j; k++) r[idx[k]!] = v;
    i = j + 1;
  }
  return r;
}

/**
 * Sample ranks. Equivalent to R's `rank()`.
 *
 * @example
 * ```ts
 * rank([10, 20, 20, 30]);                         // [1, 2.5, 2.5, 4]
 * rank([10, 20, 20, 30], { tiesMethod: "min" });  // [1, 2, 2, 4]
 * ```
 *
 * @category Descriptive statistics
 */
export function rank(x: Sample, options: RankOptions = {}): number[] {
  const method = options.tiesMethod ?? "average";
  if (!["average", "first", "last", "random", "max", "min"].includes(method)) {
    throw new RangeError(`invalid tiesMethod "${method}"`);
  }
  const naLast = options.naLast ?? "last";
  const xs = Array.from(x);
  const present = xs.filter((v) => !Number.isNaN(v));
  const r = rankValues(present, method);
  const nMissing = xs.length - present.length;
  const out: number[] = [];
  let k = 0;
  let m = 0;
  for (const v of xs) {
    if (Number.isNaN(v)) {
      m++;
      out.push(naLast === "keep" ? NaN : naLast === "last" ? present.length + m : m);
    } else {
      out.push(naLast === "first" ? r[k++]! + nMissing : r[k++]!);
    }
  }
  return out;
}
