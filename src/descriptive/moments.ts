// Shape and location summaries that R's base lacks, with the definitions of the packages they are checked against:
// skewness and kurtosis (e1071, types 1 to 3), geometricMean, modes, meanAD and cv (DescTools' Gmean, Mode, MeanAD
// and CoefVar). Also scale (R's base).
//
// Written for rStats.js from the published definitions (no ported code). With m_k the central moments (divisor n),
// g1 = m3 / m2^1.5 and g2 = m4 / m2^2 - 3; e1071's type 1 is (g1, g2), type 2 the adjusted estimators of SAS and SPSS
// (Joanes and Gill, The Statistician 47, 1998), type 3 (the default, as in MINITAB and BMDP) b1 = g1 ((n-1)/n)^1.5 and
// b2 = (g2 + 3) ((n-1)/n)^2 - 3. The central moments are summed after subtracting the double-double mean.

import { values, type NaRmOptions } from "./basic.js";
import { ldexp, meanDD, mean as meanOf, scaleToUnit, variance } from "../internal/summary.js";
import { median } from "./basic.js";
import type { Sample } from "../htest/types.js";
import { maxOf } from "../internal/extremes.js";

/**
 * Options for {@link skewness} and {@link kurtosis}.
 *
 * @category Descriptive statistics
 */
export interface MomentOptions {
  /** e1071's type: 1, 2 or 3. Default `3`. */
  type?: 1 | 2 | 3;
}

/**
 * Central sums sum (x - mean)^2, ^3, ^4 of values without NaN, of the data scaled by a power of 2 (exact) first, so
 * that neither the deviations nor their powers overflow or underflow (R returns NaN there). The sums are those of the
 * scaled deviations; only the scale-free ratios of skewness and kurtosis are taken from them. Deviations that are
 * still tiny next to the values are scaled up as well.
 */
function centralSums(values: readonly number[]): [number, number, number] {
  const xs = scaleToUnit([values]).groups[0]!;
  const m = meanDD(xs);
  const dev = xs.map((v) => v - m[0] - m[1]);
  let mx = 0;
  for (const d of dev) mx = Math.max(mx, Math.abs(d));
  const f = mx > 0 && (mx < 2 ** -120 || mx > 2 ** 120) ? 2 ** -Math.floor(Math.log2(mx)) : 1;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  for (const dv of dev) {
    const d = dv * f;
    const d2 = d * d;
    s2 += d2;
    s3 += d2 * d;
    s4 += d2 * d2;
  }
  return [s2, s3, s4];
}

function checkType(type: number): void {
  if (![1, 2, 3].includes(type)) throw new RangeError("Invalid 'type' argument.");
}

/**
 * Sample skewness. Equivalent to `e1071::skewness()` in R. Missing values are dropped; `{ type: 1 }` is jStat's
 * skewness.
 *
 * @example
 * ```ts
 * skewness([1, 2, 3, 10]);              // 0.6614
 * skewness([1, 2, 3, 10], { type: 2 }); // 1.7636
 * ```
 *
 * @category Descriptive statistics
 */
export function skewness(x: Sample, options: MomentOptions = {}): number {
  const type = options.type ?? 3;
  checkType(type);
  const xs = values(x, true)!;
  const n = xs.length;
  const [s2, s3] = centralSums(xs);
  const g1 = (Math.sqrt(n) * s3) / s2 ** 1.5;
  if (type === 1) return g1;
  if (type === 2) {
    if (n < 3) throw new RangeError("Need at least 3 complete observations.");
    return (g1 * Math.sqrt(n * (n - 1))) / (n - 2);
  }
  return g1 * (1 - 1 / n) ** 1.5;
}

/**
 * Sample excess kurtosis. Equivalent to `e1071::kurtosis()` in R. Missing values are dropped; `{ type: 1 }` is
 * jStat's kurtosis.
 *
 * @example
 * ```ts
 * kurtosis([1, 2, 3, 10]);              // -1.7454
 * kurtosis([1, 2, 3, 10], { type: 1 }); // -0.7696
 * ```
 *
 * @category Descriptive statistics
 */
export function kurtosis(x: Sample, options: MomentOptions = {}): number {
  const type = options.type ?? 3;
  checkType(type);
  const xs = values(x, true)!;
  const n = xs.length;
  const [s2, , s4] = centralSums(xs);
  const r = (n * s4) / (s2 * s2);
  if (type === 1) return r - 3;
  if (type === 2) {
    if (n < 4) throw new RangeError("Need at least 4 complete observations.");
    return (((n + 1) * (r - 3) + 6) * (n - 1)) / ((n - 2) * (n - 3));
  }
  return r * (1 - 1 / n) ** 2 - 3;
}

/**
 * Geometric mean exp(mean(log x)). Equivalent to `DescTools::Gmean()` in R. NaN with a negative value, 0 with a
 * zero.
 *
 * @example
 * ```ts
 * geometricMean([1, 2, 4, 8]); // 2.82842712474619
 * ```
 *
 * @category Descriptive statistics
 */
export function geometricMean(x: Sample, options: NaRmOptions = {}): number {
  const xs = values(x, options.naRm);
  if (xs === undefined) return NaN;
  if (xs.some((v) => v < 0)) return NaN;
  if (xs.includes(0)) return 0;
  return Math.exp(meanOf(xs.map(Math.log)));
}

/**
 * The most frequent values (all of them, in increasing order) and their frequency. Equivalent to
 * `DescTools::Mode()` in R. Missing values are dropped; `value` is `[NaN]` and `frequency` NaN when every value
 * occurs once.
 *
 * @example
 * ```ts
 * modes([1, 2, 2, 3, 3, 4]); // { value: [2, 3], frequency: 2 }
 * ```
 *
 * @category Descriptive statistics
 */
export function modes(x: Sample): {
  /** The most frequent values, in increasing order (`[NaN]` when every value occurs once). */
  value: number[];
  /** How often each of them occurs (NaN when every value occurs once). */
  frequency: number;
} {
  const xs = values(x, true)!;
  const counts = new Map<number, number>();
  for (const v of xs) counts.set(v === 0 ? 0 : v, (counts.get(v === 0 ? 0 : v) ?? 0) + 1);
  let best = 0;
  for (const c of counts.values()) best = Math.max(best, c);
  if (best <= 1) return { value: [NaN], frequency: NaN };
  const value = [...counts.entries()].filter(([, c]) => c === best).map(([v]) => v);
  return { value: value.sort((a, b) => a - b), frequency: best };
}

/**
 * Options for {@link meanAD}.
 *
 * @category Descriptive statistics
 */
export interface MeanADOptions {
  /** Centre: the mean (default) or `"median"`, or a number. */
  center?: "mean" | "median" | number;
}

/**
 * Mean absolute deviation from the centre. Equivalent to `DescTools::MeanAD()` in R. Missing values are dropped.
 *
 * @example
 * ```ts
 * meanAD([1, 2, 3, 10]);                       // 3
 * meanAD([1, 2, 3, 10], { center: "median" }); // 2.5
 * ```
 *
 * @category Descriptive statistics
 */
export function meanAD(x: Sample, options: MeanADOptions = {}): number {
  const c = options.center ?? "mean";
  // the deviations of the values (and a given centre) scaled by a power of 2 (exact), so that they cannot overflow;
  // the mean deviation is scaled back
  const { groups, k } = scaleToUnit([values(x, true)!, typeof c === "number" ? [c] : []]);
  const xs = groups[0]!;
  const center = c === "mean" ? meanOf(xs) : c === "median" ? median(xs) : groups[1]![0]!;
  return ldexp(meanOf(xs.map((v) => Math.abs(v - center))), k);
}

/**
 * Options for {@link cv}.
 *
 * @category Descriptive statistics
 */
export interface CvOptions extends NaRmOptions {
  /** Small-sample correction. Default `false`. */
  unbiased?: boolean;
}

/**
 * Coefficient of variation sd / mean (sample standard deviation). Equivalent to `DescTools::CoefVar()` in R.
 *
 * @example
 * ```ts
 * cv([2, 4, 4, 4, 5, 5, 7, 9]); // 0.4276
 * ```
 *
 * @category Descriptive statistics
 */
export function cv(x: Sample, options: CvOptions = {}): number {
  const xs = values(x, options.naRm);
  if (xs === undefined) return NaN;
  const n = xs.length;
  // sd and mean of the values scaled by a power of 2 (exact): their ratio has no units
  const xu = scaleToUnit([xs]).groups[0]!;
  let res = Math.sqrt(variance(xu)) / meanOf(xu);
  if (options.unbiased) res *= 1 - 1 / (4 * (n - 1)) + (res * res) / n + 1 / (2 * (n - 1) ** 2);
  return res;
}

/**
 * Options for {@link scale}.
 *
 * @category Descriptive statistics
 */
export interface ScaleOptions {
  /** Subtract the column means (`true`, default), nothing (`false`) or the given values. */
  center?: boolean | readonly number[];
  /**
   * Divide by the root mean square of each (centred) column, sqrt(sum v^2 / (n - 1)) (`true`, default: the standard
   * deviation when centred), by nothing (`false`) or by the given values.
   */
  scale?: boolean | readonly number[];
}

/**
 * Centre and scale the columns of a matrix (array of rows; a vector is one column). Equivalent to R's `scale()`.
 * `center` and `scale` report the values used (R's attributes), when any.
 *
 * @example
 * ```ts
 * scale([1, 2, 3]); // { scaled: [[-1], [0], [1]], center: [2], scale: [1] }
 * ```
 *
 * @category Descriptive statistics
 */
export function scale(
  x: Sample | readonly (readonly number[])[],
  options: ScaleOptions = {},
): {
  /** The centred and scaled matrix, as an array of rows (R's returned matrix). */
  scaled: number[][];
  /** The values subtracted from each column (R's `scaled:center` attribute); absent with `center: false`. */
  center?: number[];
  /** The values each column was divided by (R's `scaled:scale` attribute); absent with `scale: false`. */
  scale?: number[];
} {
  const rows: number[][] =
    x.length > 0 && Array.isArray(x[0]) ? (x as readonly (readonly number[])[]).map((r) => [...r]) : Array.from(x as Sample, (v) => [v]);
  const nc = rows[0]?.length ?? 0;
  const col = (j: number): number[] => rows.map((r) => r[j]!);
  const result: { scaled: number[][]; center?: number[]; scale?: number[] } = { scaled: rows };
  const c = options.center ?? true;
  if (c !== false) {
    const center = c === true ? Array.from({ length: nc }, (_, j) => meanOf(col(j).filter((v) => !Number.isNaN(v)))) : [...c];
    if (center.length !== nc) throw new RangeError("length of 'center' must equal the number of columns of 'x'");
    for (const r of rows) for (let j = 0; j < nc; j++) r[j] = r[j]! - center[j]!;
    result.center = center;
  }
  const s = options.scale ?? true;
  if (s !== false) {
    const sc =
      s === true
        ? Array.from({ length: nc }, (_, j) => {
            const v = col(j).filter((t) => !Number.isNaN(t));
            let ss = 0;
            for (const t of v) ss += t * t;
            const mx = maxOf(v.map(Math.abs));
            if ((ss === Infinity || ss < 2 ** -960) && mx > 0 && mx < Infinity) {
              // The squares overflow or underflow (R's scale returns Inf or 0): sum the squares of the values divided
              // by the largest
              ss = 0;
              for (const t of v) ss += (t / mx) ** 2;
              return Math.sqrt(ss / Math.max(1, v.length - 1)) * mx;
            }
            return Math.sqrt(ss / Math.max(1, v.length - 1));
          })
        : [...s];
    if (sc.length !== nc) throw new RangeError("length of 'scale' must equal the number of columns of 'x'");
    for (const r of rows) for (let j = 0; j < nc; j++) r[j] = r[j]! / sc[j]!;
    result.scale = sc;
  }
  return result;
}
