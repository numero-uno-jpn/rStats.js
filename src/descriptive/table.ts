// Counting and binning: R's tabulate, table (for one vector), unique, cut (codes) and findInterval.
//
// Written for rStats.js. cut's generation of breaks from a number of intervals follows R's behaviour: equal spacing
// over the range, ends widened by 1/1000 of the range, and a special case for a zero range. NaN stands for R's NA:
// unique keeps one NaN; table counts it according to `useNA`; cut and findInterval return NaN for it.

import { seqLength } from "../internal/seq.js";
import type { Sample } from "../htest/types.js";

/**
 * Counts of the integers 1..nbins in `bin` (values truncated towards 0; others and NaN are not counted).
 * Equivalent to R's `tabulate()`; `nbins` defaults to max(1, bin).
 */
export function tabulate(bin: Sample, nbins?: number): number[] {
  const b = Array.from(bin).map((v) => Math.trunc(v));
  const nb = nbins ?? Math.max(1, ...b.filter((v) => !Number.isNaN(v)));
  const out = new Array<number>(Math.max(0, nb)).fill(0);
  for (const v of b) if (v >= 1 && v <= nb) out[v - 1]!++;
  return out;
}

/** Options for {@link table}. */
export interface TableOptions {
  /** Count missing values: `"no"` (default), `"ifany"` (when there are some) or `"always"`. */
  useNA?: "no" | "ifany" | "always";
}

/**
 * Frequency table of the distinct values. Equivalent to R's `table()` for one numeric vector: `values` in increasing
 * order (NaN last when counted) with their `counts`.
 *
 * @example
 * ```ts
 * table([3, 1, 3, 2, 3]); // { values: [1, 2, 3], counts: [1, 1, 3] }
 * ```
 */
export function table(x: Sample, options: TableOptions = {}): { values: number[]; counts: number[] } {
  const useNA = options.useNA ?? "no";
  const xs = Array.from(x);
  const map = new Map<number, number>();
  let nas = 0;
  for (const v of xs) {
    if (Number.isNaN(v)) nas++;
    else map.set(v === 0 ? 0 : v, (map.get(v === 0 ? 0 : v) ?? 0) + 1);
  }
  const values = Array.from(map.keys()).sort((a, b) => a - b);
  const counts = values.map((v) => map.get(v)!);
  if (useNA === "always" || (useNA === "ifany" && nas > 0)) {
    values.push(NaN);
    counts.push(nas);
  }
  return { values, counts };
}

/** Distinct values in order of first appearance (one NaN at most). Equivalent to R's `unique()`. */
export function unique(x: Sample): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const v of Array.from(x)) {
    const k = v === 0 ? 0 : v; // -0 and 0 are the same value
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

/** Options for {@link cut}. */
export interface CutOptions {
  /** Intervals closed on the right, (a, b] (default `true`); otherwise [a, b). */
  right?: boolean;
  /** Close the first interval on the left (or the last on the right when `right` is false). Default `false`. */
  includeLowest?: boolean;
}

/**
 * Interval numbers (1-based) of the values, or NaN outside the breaks. Equivalent to R's `cut(..., labels = FALSE)`.
 *
 * @param breaks The break points, or a number of intervals (at least 2): then equal intervals over the range of `x`,
 *   widened by 1/1000 of the range at each end, as R does.
 */
export function cut(x: Sample, breaks: number | readonly number[], options: CutOptions = {}): number[] {
  const right = options.right ?? true;
  const includeLowest = options.includeLowest ?? false;
  const xs = Array.from(x);
  let br: number[];
  if (typeof breaks === "number" || breaks.length === 1) {
    const k = typeof breaks === "number" ? breaks : breaks[0]!;
    if (!(k >= 2)) throw new RangeError("invalid number of intervals");
    const nb = Math.trunc(k + 1);
    const finite = xs.filter((v) => !Number.isNaN(v));
    const lo = Math.min(...finite);
    const hi = Math.max(...finite);
    let dx = hi - lo;
    if (dx === 0) {
      dx = lo !== 0 ? Math.abs(lo) : 1;
      br = seqLength(lo - dx / 1000, hi + dx / 1000, nb);
    } else {
      br = seqLength(lo, hi, nb);
      br[0] = lo - dx / 1000;
      br[nb - 1] = hi + dx / 1000;
    }
  } else br = [...breaks].sort((a, b) => a - b);
  if (new Set(br).size < br.length) throw new RangeError("'breaks' are not unique");
  return binCode(xs, br, right, includeLowest);
}

/** Interval codes as R's .bincode */
function binCode(xs: readonly number[], br: readonly number[], right: boolean, includeLowest: boolean): number[] {
  const nb = br.length;
  return xs.map((v) => {
    if (Number.isNaN(v)) return NaN;
    // first index i with br[i] >= v (right) or br[i] > v (left)
    let lo = 0;
    let hi = nb;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (right ? br[mid]! < v : br[mid]! <= v) lo = mid + 1;
      else hi = mid;
    }
    let code = lo; // v in (br[code - 1], br[code]] (right) or [br[code - 1], br[code]) (left)
    if (includeLowest) {
      if (right && v === br[0]) code = 1;
      if (!right && v === br[nb - 1]) code = nb - 1;
    }
    return code >= 1 && code <= nb - 1 ? code : NaN;
  });
}

/** Options for {@link findInterval}. */
export interface FindIntervalOptions {
  /** Treat the last interval as closed on the right (with `leftOpen`, the first as closed on the left). */
  rightmostClosed?: boolean;
  /** Map results below 1 to 1 and above N - 1 to N - 1. */
  allInside?: boolean;
  /** Intervals (v_i, v_(i+1)] instead of [v_i, v_(i+1)). */
  leftOpen?: boolean;
}

/**
 * For each value, the number of break points at or below it (the interval index). Equivalent to R's
 * `findInterval()`; `vec` must be non-decreasing.
 */
export function findInterval(x: Sample, vec: readonly number[], options: FindIntervalOptions = {}): number[] {
  const n = vec.length;
  for (let i = 1; i < n; i++) {
    if (!(vec[i]! >= vec[i - 1]!)) throw new RangeError("'vec' must be sorted non-decreasingly and not contain NAs");
  }
  if (vec.some(Number.isNaN)) throw new RangeError("'vec' must be sorted non-decreasingly and not contain NAs");
  const { rightmostClosed = false, allInside = false, leftOpen = false } = options;
  return Array.from(x).map((v) => {
    if (Number.isNaN(v)) return NaN;
    // count of vec <= v (or < v when left-open)
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (leftOpen ? vec[mid]! < v : vec[mid]! <= v) lo = mid + 1;
      else hi = mid;
    }
    let i = lo;
    if (rightmostClosed && n > 0) {
      if (!leftOpen && i === n && v === vec[n - 1]) i = n - 1;
      if (leftOpen && i === 0 && v === vec[0]) i = 1;
    }
    if (allInside) i = Math.min(Math.max(i, 1), n - 1);
    return i;
  });
}
