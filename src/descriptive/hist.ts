// Histogram counts and pretty break points: R's hist (with plot = FALSE), pretty and ecdf.
//
// Written for rStats.js (no ported code). pretty follows the description in R's ?pretty: the interval is split into
// about n cells whose width is 1, 2, 5 or 10 times a power of 10, choosing among them with the biases high.u.bias
// (towards larger units) and u5.bias (towards 5 over 2), then the end points are moved out to multiples of the unit
// and at least min.n cells are kept; the details (the small-range rule, the 1e-10 rounding allowance) were checked
// against R's output. hist computes the number of cells by Sturges' rule (or Scott's, Freedman-Diaconis', or as
// given), takes pretty break points over the range, and counts with R's fuzz of 1e-7 times a typical cell width, so
// that values on a break are not lost to rounding.

import { median, range, sd } from "./basic.js";
import { IQR, quantile } from "./quantile.js";
import { seqLength } from "../internal/seq.js";
import type { Sample } from "../htest/types.js";

/** Options for {@link pretty}. */
export interface PrettyOptions {
  /** Desired number of intervals. Default `5`. */
  n?: number;
  /** Minimal number of intervals. Default `n / 3` rounded down. */
  minN?: number;
  /** Factor applied to the cell when the range is very small. Default `0.75`. */
  shrinkSml?: number;
  /** Bias towards larger units. Default `1.5`. */
  highUBias?: number;
  /** Bias towards 5 over 2 times a power of 10. Default `0.5 + 1.5 * highUBias`. */
  u5Bias?: number;
}

/**
 * About n + 1 equally spaced "round" values (1, 2 or 5 times a power of 10) covering the range of `x`. Equivalent to
 * R's `pretty()`.
 *
 * @example
 * ```ts
 * pretty([0.3, 9.6]); // [0, 2, 4, 6, 8, 10]
 * ```
 */
export function pretty(x: Sample, options: PrettyOptions = {}): number[] {
  const finite = Array.from(x).filter(Number.isFinite);
  if (finite.length === 0) return [];
  const n = options.n ?? 5;
  const minN = options.minN ?? Math.floor(n / 3);
  const shrink = options.shrinkSml ?? 0.75;
  const h = options.highUBias ?? 1.5;
  const h5 = options.u5Bias ?? 0.5 + 1.5 * h;
  let lo = Math.min(...finite);
  let up = Math.max(...finite);
  const dx = up - lo;
  let cell: number;
  let small: boolean;
  if (dx === 0 && up === 0) {
    cell = 1;
    small = true;
  } else {
    cell = Math.max(Math.abs(lo), Math.abs(up));
    // a range below about 3 eps * cell (times the number of cells) counts as small
    const bound = (1 + (h5 >= 1.5 * h + 0.5 ? 1 / (1 + h) : 1.5 / (1 + h5))) * Math.max(1, n) * Number.EPSILON;
    small = dx < cell * bound * 3;
  }
  if (small) {
    if (cell > 10) cell = 9 + cell / 10;
    cell *= shrink;
    if (minN > 1) cell /= minN;
  } else {
    cell = Number.isFinite(dx) ? (n > 1 ? dx / n : dx) : n >= 2 ? up / n - lo / n : dx;
  }
  const tiny = 2 ** -20 * 2.2250738585072014e-308;
  if (cell < tiny) cell = tiny;
  else if (cell > Number.MAX_VALUE / 1.25) cell = Number.MAX_VALUE / 1.25;
  const base = 10 ** Math.floor(Math.log10(cell));
  let unit = base;
  // step up to 2, 5 and 10 times the base while the larger unit is close enough (with the biases)
  if (2 * base - cell < h * (cell - unit)) {
    unit = 2 * base;
    if (5 * base - cell < h5 * (cell - unit)) {
      unit = 5 * base;
      if (10 * base - cell < h * (cell - unit)) unit = 10 * base;
    }
  }
  const eps = 1e-10;
  let ns = Math.floor(lo / unit + eps);
  let nu = Math.ceil(up / unit - eps);
  while (ns * unit > lo + eps * unit) ns--;
  while (!Number.isFinite(ns * unit)) ns++;
  while (nu * unit < up - eps * unit) nu++;
  while (!Number.isFinite(nu * unit)) nu--;
  let k = Math.trunc(0.5 + nu - ns);
  if (k < minN) {
    k = minN - k;
    if (lo === 0 && ns === 0 && up !== 0) nu += k;
    else if (up === 0 && nu === 0 && lo !== 0) ns -= k;
    else if (ns >= 0) {
      nu += Math.floor(k / 2);
      ns -= Math.floor(k / 2) + (k % 2);
    } else {
      ns -= Math.floor(k / 2);
      nu += Math.floor(k / 2) + (k % 2);
    }
    k = minN;
  }
  if (ns * unit < lo) lo = ns * unit;
  if (nu * unit > up) up = nu * unit;
  const s = seqLength(lo, up, k + 1);
  // values that are 0 up to the rounding of the sequence are set to 0
  const delta = Math.abs(up - lo) / k;
  return k > 0 ? s.map((v) => (Math.abs(v) < 1e-14 * delta ? 0 : v)) : s;
}

/** Options for {@link hist}. */
export interface HistOptions {
  /**
   * Break points, a number of cells (a suggestion for pretty), or a rule: `"Sturges"` (default), `"Scott"` or
   * `"FD"` (Freedman-Diaconis).
   */
  breaks?: readonly number[] | number | "Sturges" | "Scott" | "FD" | "Freedman-Diaconis";
  /** Cells closed on the right, (a, b] (default `true`). */
  right?: boolean;
  /** Close the first cell on the left (the last on the right when `right` is false). Default `true`. */
  includeLowest?: boolean;
}

/** Result of {@link hist}. */
export interface HistResult {
  breaks: number[];
  counts: number[];
  /** counts / (n * cell width) */
  density: number[];
  mids: number[];
}

/** Round to 5 significant digits (R's signif(x, 5)) */
function signif5(v: number): number {
  if (v === 0 || !Number.isFinite(v)) return v;
  return Number(v.toPrecision(5));
}

function nclass(x: readonly number[], rule: string): number {
  const n = x.length;
  const [lo, hi] = range(x);
  const r = rule.toLowerCase();
  if (r === "sturges") return Math.ceil(Math.log2(n) + 1);
  if (r === "scott") {
    const h = 3.5 * sd(x) * n ** (-1 / 3);
    return h > 0 ? Math.max(1, Math.ceil((hi - lo) / h)) : 1;
  }
  if (r === "fd" || r === "freedman-diaconis") {
    const xr = x.map(signif5);
    let h = 2 * IQR(xr);
    if (h === 0) {
      let al = 1 / 4;
      while (h === 0 && (al /= 2) >= 1 / 512) {
        const [a, b] = quantile(xr, [al, 1 - al]);
        h = (b! - a!) / (1 - 2 * al);
      }
    }
    if (h === 0) h = 3.5 * sd(x);
    return h > 0 ? Math.ceil(((hi - lo) / h) * n ** (1 / 3)) : 1;
  }
  throw new RangeError("unknown 'breaks' algorithm");
}

/**
 * Histogram counts. Equivalent to R's `hist(x, plot = FALSE)`: break points (by default pretty points over the range
 * with about Sturges' number of cells), counts, densities and cell midpoints. Non-finite values are dropped.
 *
 * @example
 * ```ts
 * hist([1, 2, 2, 3, 3, 3, 4]).counts; // [3, 3, 1] for breaks [1, 2, 3, 4]
 * ```
 */
export function hist(x: Sample, options: HistOptions = {}): HistResult {
  const xs = Array.from(x).filter(Number.isFinite);
  const n = xs.length;
  const right = options.right ?? true;
  let includeLowest = options.includeLowest ?? true;
  let breaks: number[];
  const given = options.breaks ?? "Sturges";
  const asVector = Array.isArray(given) && given.length > 1;
  if (asVector) breaks = [...(given as number[])].sort((a, b) => a - b);
  else {
    includeLowest = true;
    let k = typeof given === "string" ? nclass(xs, given) : Array.isArray(given) ? given[0]! : (given as number);
    if (!(Number.isFinite(k) && k >= 1)) throw new RangeError("invalid number of 'breaks'");
    k = Math.min(k, 1e6);
    breaks = pretty(range(xs), { n: k, minN: 1 });
  }
  const nB = breaks.length;
  const hw = breaks.slice(1).map((b, i) => b - breaks[i]!);
  if (!asVector && hw.some((v) => v <= 0)) throw new RangeError("'breaks' are not strictly increasing");
  const positive = hw.filter((v) => v > 0);
  const diddle =
    1e-7 * (nB > 5 ? median(hw) : nB <= 3 ? range(xs)[1] - range(xs)[0] : Math.min(...positive));
  const fuzzy = breaks.map((b, i) =>
    right
      ? b + (i === 0 ? (includeLowest ? -diddle : diddle) : diddle)
      : b + (i === nB - 1 ? (includeLowest ? diddle : -diddle) : -diddle),
  );
  const counts = new Array<number>(nB - 1).fill(0);
  for (const v of xs) {
    // cell i: (fuzzy[i], fuzzy[i + 1]] (right) or [fuzzy[i], fuzzy[i + 1]) (left)
    let lo = 0;
    let hi = nB;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (right ? fuzzy[mid]! < v : fuzzy[mid]! <= v) lo = mid + 1;
      else hi = mid;
    }
    let code = lo;
    if (includeLowest) {
      if (right && v === fuzzy[0]) code = 1;
      if (!right && v === fuzzy[nB - 1]) code = nB - 1;
    }
    if (code >= 1 && code <= nB - 1) counts[code - 1]!++;
  }
  if (counts.reduce((a, b) => a + b, 0) < n) {
    throw new RangeError("some 'x' not counted; maybe 'breaks' do not span range of 'x'");
  }
  return {
    breaks,
    counts,
    density: counts.map((c, i) => c / (n * hw[i]!)),
    mids: breaks.slice(1).map((b, i) => 0.5 * (b + breaks[i]!)),
  };
}

/**
 * Empirical distribution function of `x`: a function returning the fraction of values at or below its argument.
 * Equivalent to R's `ecdf()`. `NaN` values are dropped.
 *
 * @example
 * ```ts
 * ecdf([3, 1, 2])(2); // 2/3
 * ```
 */
export function ecdf(x: Sample): (q: number) => number {
  const s = Array.from(x)
    .filter((v) => !Number.isNaN(v))
    .sort((a, b) => a - b);
  const n = s.length;
  if (n < 1) throw new RangeError("'x' must have 1 or more non-missing values");
  return (q: number) => {
    if (Number.isNaN(q)) return NaN;
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (s[mid]! <= q) lo = mid + 1;
      else hi = mid;
    }
    return lo / n;
  };
}
