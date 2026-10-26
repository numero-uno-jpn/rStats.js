// Agreement and reliability: Cohen's kappa for two raters (irr's kappa2, unweighted or weighted), Fleiss' kappa for
// several raters (irr's kappam.fleiss, with Conger's exact variant), the intraclass correlation (irr's icc) with its
// F test and confidence interval, Cronbach's alpha with Guttman's lambda 6 (psych's alpha), and the partial
// correlation of two variables given the others (psych's partial.r).
//
// Written for rStats.js from oracle/agreement-behaviour.md (no ported code; the source of irr and psych was not
// read). The p-values of the kappas are computed as 2 Φ(−|z|), which keeps small ones that irr's 2 (1 − Φ(|z|))
// loses to cancellation.

import { cor, cov } from "../descriptive/cov.js";
import { pf1, qf1 } from "../distributions/f.js";
import { pnorm } from "../distributions/normal.js";
import { mean, sum, variance } from "../internal/summary.js";
import { solve } from "../linalg/solve.js";
import { formatR } from "./core/simulate.js";
import { matchChoice } from "./power.js";
import { checkConfLevelOpen } from "./types.js";

type Ratings = readonly (readonly number[])[];

/** Columns of a matrix given as an array of rows, after checking that it is rectangular */
function columnsOf(x: Ratings, what: string): number[][] {
  const k = x[0]?.length ?? 0;
  if (x.some((r) => r.length !== k)) throw new TypeError(`'${what}' must be a matrix (rows of equal length)`);
  return Array.from({ length: k }, (_, j) => x.map((r) => r[j]!));
}

function requireComplete(x: Ratings, what: string): void {
  if (x.some((r) => r.some(Number.isNaN))) throw new RangeError(`'${what}' contains missing values`);
}

/** Two-sided normal p-value 2 Φ(−|z|) */
const twoSidedP = (z: number): number => 2 * pnorm(-Math.abs(z));

/** Weighting of the disagreements in {@link kappa2}. */
export type Kappa2Weight = "unweighted" | "equal" | "squared";

/** Options for {@link kappa2}. */
export interface Kappa2Options {
  /**
   * `"unweighted"` (default): only identical ratings agree. `"equal"`: weights `1 − d/(c − 1)` for levels `d` apart
   * (of `c` levels); `"squared"`: `1 − d²/(c − 1)²`. Unambiguous abbreviations are accepted.
   */
  weight?: Kappa2Weight | (string & {});
}

/** Result of {@link kappa2} and {@link kappamFleiss}. */
export interface KappaResult {
  /** The kappa coefficient. */
  value: number;
  /** z statistic of the test of kappa = 0 (absent for Fleiss' exact kappa). */
  statistic?: number;
  /** Two-sided p-value of the z test (absent for Fleiss' exact kappa). */
  pValue?: number;
}

/**
 * Cohen's kappa for two raters, unweighted or weighted, with the z test of kappa = 0. Equivalent to irr's
 * `kappa2(ratings, weight)` (numeric ratings).
 *
 * The levels are the distinct ratings of both raters sorted as R sorts their character forms (so 10 sorts before 2,
 * which matters for the weighted kappas). Rows with a missing value (`NaN`) are dropped. The variance of the test is
 * the one under the null hypothesis; the p-value is computed as 2 Φ(−|z|), so small p-values are more accurate than
 * irr's.
 *
 * @param ratings - An n × 2 matrix (array of rows): the ratings of the two raters for each subject.
 * @param options - See {@link Kappa2Options}.
 *
 * @example
 * ```ts
 * kappa2([[1, 1], [2, 2], [3, 2], [1, 1], [2, 3], [3, 3]]); // { value: 0.49999999999999994, statistic: 1.7320508075688772, pValue: 0.08326451666355043 }
 * ```
 */
export function kappa2(ratings: Ratings, options: Kappa2Options = {}): Required<KappaResult> {
  const weight = matchChoice(options.weight, ["unweighted", "equal", "squared"] as const);
  if (ratings.some((r) => r.length !== 2)) throw new TypeError("'ratings' must be a matrix with two columns");
  const rows = ratings.filter((r) => !r.some(Number.isNaN));
  const n = rows.length;
  const first = rows.map((r) => formatR(r[0]!));
  const second = rows.map((r) => formatR(r[1]!));
  // the levels of both raters together, sorted as strings (by code point, as in R's C locale)
  const levels = [...new Set([...first, ...second])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const c = levels.length;
  const index = new Map(levels.map((l, i) => [l, i]));
  const T = Array.from({ length: c }, () => new Array<number>(c).fill(0));
  for (let i = 0; i < n; i++) T[index.get(first[i]!)!]![index.get(second[i]!)!]!++;
  const w = (d: number): number =>
    weight === "unweighted" ? (d === 0 ? 1 : 0) : weight === "equal" ? 1 - d / (c - 1) : 1 - (d * d) / ((c - 1) * (c - 1));
  const W = Array.from({ length: c }, (_, r) => Array.from({ length: c }, (_, s) => w(Math.abs(r - s))));
  const a = T.map((row) => sum(row) / n);
  const b = Array.from({ length: c }, (_, s) => sum(T.map((row) => row[s]!)) / n);
  const terms = (f: (r: number, s: number) => number): number => {
    const t: number[] = [];
    for (let r = 0; r < c; r++) for (let s = 0; s < c; s++) t.push(f(r, s));
    return sum(t);
  };
  const po = terms((r, s) => T[r]![s]! * W[r]![s]!) / n;
  const pe = terms((r, s) => a[r]! * b[s]! * W[r]![s]!);
  const value = (po - pe) / (1 - pe);
  const u = Array.from({ length: c }, (_, r) => sum(b.map((bs, s) => bs * W[r]![s]!)));
  const v = Array.from({ length: c }, (_, s) => sum(a.map((ar, r) => ar * W[r]![s]!)));
  const variance0 = (terms((r, s) => a[r]! * b[s]! * (W[r]![s]! - (u[r]! + v[s]!)) ** 2) - pe * pe) / (n * (1 - pe) ** 2);
  const statistic = value / Math.sqrt(variance0);
  return { value, statistic, pValue: twoSidedP(statistic) };
}

/** Options for {@link kappamFleiss}. */
export interface KappamFleissOptions {
  /** Conger's exact kappa instead of Fleiss' (no test is then given). Default `false`. */
  exact?: boolean;
}

/**
 * Fleiss' kappa for several raters (or Conger's exact kappa), with the z test of kappa = 0 for Fleiss' kappa.
 * Equivalent to irr's `kappam.fleiss(ratings, exact)` (numeric ratings, no missing values).
 *
 * The p-value is computed as 2 Φ(−|z|), so small p-values are more accurate than irr's.
 *
 * @param ratings - An n × m matrix (array of rows): the ratings of the m raters for each of the n subjects.
 * @param options - See {@link KappamFleissOptions}.
 *
 * @example
 * ```ts
 * kappamFleiss([[1, 1, 2], [2, 2, 2], [3, 3, 2], [1, 1, 1], [2, 3, 3]]).value; // 0.3918918918918918
 * ```
 */
export function kappamFleiss(ratings: Ratings, options: KappamFleissOptions = {}): KappaResult {
  const exact = options.exact ?? false;
  const cols = columnsOf(ratings, "ratings");
  requireComplete(ratings, "ratings");
  const n = ratings.length;
  const m = cols.length;
  const levels = [...new Set(ratings.flat())].sort((x, y) => x - y);
  const index = new Map(levels.map((l, j) => [l, j]));
  const L = levels.length;
  // t[i][j]: raters giving subject i level j; q[r][j]: subjects that rater r put in level j
  const t = ratings.map((row) => {
    const counts = new Array<number>(L).fill(0);
    for (const x of row) counts[index.get(x)!]!++;
    return counts;
  });
  const po = sum(t.map((ti) => (sum(ti.map((x) => x * x)) - m) / (m * (m - 1)))) / n;
  const p = Array.from({ length: L }, (_, j) => sum(t.map((ti) => ti[j]!)) / (n * m));
  let pe = sum(p.map((pj) => pj * pj));
  if (exact) {
    const q = cols.map((col) => {
      const counts = new Array<number>(L).fill(0);
      for (const x of col) counts[index.get(x)!]!++;
      return counts.map((cnt) => cnt / n);
    });
    const spread = Array.from({ length: L }, (_, j) => (variance(q.map((qr) => qr[j]!)) * (m - 1)) / m);
    pe -= sum(spread) / (m - 1);
  }
  const value = (po - pe) / (1 - pe);
  if (exact) return { value };
  const pq = sum(p.map((pj) => pj * (1 - pj)));
  const skew = sum(p.map((pj) => pj * (1 - pj) * (1 - pj - pj)));
  const variance0 = (2 / (pq * pq * n * m * (m - 1))) * (pq * pq - skew);
  const statistic = value / Math.sqrt(variance0);
  return { value, statistic, pValue: twoSidedP(statistic) };
}

/** Options for {@link icc}. Unambiguous abbreviations of the choices are accepted. */
export interface IccOptions {
  /** `"oneway"` (default; subjects are the only effect) or `"twoway"` (subjects and raters). */
  model?: "oneway" | "twoway" | (string & {});
  /** Two-way model: `"consistency"` (default) or `"agreement"` (rater differences count as disagreement). */
  type?: "consistency" | "agreement" | (string & {});
  /** `"single"` (default; the reliability of one rater) or `"average"` (of the mean of the k raters). */
  unit?: "single" | "average" | (string & {});
  /** The value of the coefficient under the null hypothesis. Default `0`. */
  r0?: number;
  /** Confidence level of the interval. Default `0.95`. */
  confLevel?: number;
}

/** Result of {@link icc}. */
export interface IccResult {
  /** The intraclass correlation coefficient. */
  value: number;
  /** F statistic of the test of ICC = r0. */
  Fvalue: number;
  df1: number;
  df2: number;
  /** Upper-tail p-value of the F test. */
  pValue: number;
  /** Lower confidence limit. */
  lbound: number;
  /** Upper confidence limit. */
  ubound: number;
}

/**
 * Intraclass correlation coefficient with its F test and confidence interval (McGraw and Wong's forms). Equivalent
 * to irr's `icc(ratings, model, type, unit, r0, conf.level)` (no missing values).
 *
 * @param ratings - An n × k matrix (array of rows): the ratings of the k raters for each of the n subjects.
 * @param options - See {@link IccOptions}.
 *
 * @example
 * ```ts
 * icc([[9, 2, 5, 8], [6, 1, 3, 2], [8, 4, 6, 8], [7, 1, 2, 6], [10, 5, 6, 9], [6, 2, 4, 7]],
 *     { model: "twoway", type: "agreement" }).value; // 0.28976377952755905
 * ```
 */
export function icc(ratings: Ratings, options: IccOptions = {}): IccResult {
  const model = matchChoice(options.model, ["oneway", "twoway"] as const);
  const type = matchChoice(options.type, ["consistency", "agreement"] as const);
  const unit = matchChoice(options.unit, ["single", "average"] as const);
  const r0 = options.r0 ?? 0;
  const confLevel = options.confLevel ?? 0.95;
  checkConfLevelOpen(confLevel);
  const cols = columnsOf(ratings, "ratings");
  requireComplete(ratings, "ratings");
  const n = ratings.length;
  const k = cols.length;
  const alpha = 1 - confLevel;
  // mean squares from sample variances
  const msr = variance(ratings.map((r) => mean(r))) * k;
  const msc = variance(cols.map((c) => mean(c))) * n;
  const msw = mean(ratings.map((r) => variance(r)));
  const ssTotal = variance(ratings.flat()) * (n * k - 1);
  const mse = (ssTotal - msr * (n - 1) - msc * (k - 1)) / ((n - 1) * (k - 1));
  const upper = (F: number, d1: number, d2: number): number => pf1(F, d1, d2, false, false);
  const q = (d1: number, d2: number): number => qf1(1 - alpha / 2, d1, d2, true, false);
  const df1 = n - 1;
  if (model === "oneway" || type === "consistency") {
    const ms = model === "oneway" ? msw : mse;
    const df2 = model === "oneway" ? n * (k - 1) : (n - 1) * (k - 1);
    const ratio = msr / ms;
    const FL = ratio / q(df1, df2);
    const FU = ratio * q(df2, df1);
    const [value, Fvalue, bound] =
      unit === "single"
        ? [(msr - ms) / (msr + (k - 1) * ms), (ratio * (1 - r0)) / (1 + (k - 1) * r0), (f: number) => (f - 1) / (f + k - 1)]
        : [(msr - ms) / msr, ratio * (1 - r0), (f: number) => 1 - 1 / f];
    return { value, Fvalue, df1, df2, pValue: upper(Fvalue, df1, df2), lbound: bound(FL), ubound: bound(FU) };
  }
  // two-way agreement: Satterthwaite's degrees of freedom v for the combination a MSc + b MSe
  const scale = unit === "single" ? k : 1;
  const coefficients = (r: number): [number, number] => [(scale * r) / (n * (1 - r)), 1 + (scale * r * (n - 1)) / (n * (1 - r))];
  const dfOf = (a: number, b: number): number =>
    (a * msc + b * mse) ** 2 / ((a * msc) ** 2 / (k - 1) + (b * mse) ** 2 / ((n - 1) * (k - 1)));
  const value =
    unit === "single" ? (msr - mse) / (msr + (k - 1) * mse + (k / n) * (msc - mse)) : (msr - mse) / (msr + (msc - mse) / n);
  const [a0, b0] = coefficients(r0);
  const Fvalue = msr / (a0 * msc + b0 * mse);
  const df2 = dfOf(a0, b0);
  // the bounds use the coefficients of the estimate, with k in both units
  const [a, b] = [(k * value) / (n * (1 - value)), 1 + (k * value * (n - 1)) / (n * (1 - value))];
  const v = dfOf(a, b);
  const FL = q(df1, v);
  const FU = q(v, df1);
  const [lbound, ubound] =
    unit === "single"
      ? [
          (n * (msr - FL * mse)) / (FL * (k * msc + (k * n - k - n) * mse) + n * msr),
          (n * (FU * msr - mse)) / (k * msc + (k * n - k - n) * mse + n * FU * msr),
        ]
      : [(n * (msr - FL * mse)) / (FL * (msc - mse) + n * msr), (n * (FU * msr - mse)) / (msc - mse + n * FU * msr)];
  return { value, Fvalue, df1, df2, pValue: upper(Fvalue, df1, df2), lbound, ubound };
}

/** Result of {@link cronbachAlpha}. */
export interface CronbachAlphaResult {
  /** Cronbach's alpha from the covariances. */
  rawAlpha: number;
  /** Alpha from the correlations (standardized items). */
  stdAlpha: number;
  /** Guttman's lambda 6, from the squared multiple correlations. */
  G6: number;
  /** Mean correlation between the items. */
  averageR: number;
  /** Raw alpha of the items without each item in turn. */
  alphaDrop: number[];
}

/** Raw alpha of the covariance matrix C restricted to the items `keep` */
function rawAlphaOf(C: readonly (readonly number[])[], keep: readonly number[]): number {
  const k = keep.length;
  const total = sum(keep.flatMap((i) => keep.map((j) => C[i]![j]!)));
  const trace = sum(keep.map((i) => C[i]![i]!));
  return ((1 - trace / total) * k) / (k - 1);
}

/**
 * Cronbach's alpha of a set of items, standardized alpha, Guttman's lambda 6 and the mean inter-item correlation,
 * and alpha with each item dropped. Equivalent to the `total` row and `alpha.drop$raw_alpha` of psych's `alpha(x)`
 * with its defaults (no missing values, no reversed items).
 *
 * @param x - An n × k matrix (array of rows): k items observed on n subjects.
 *
 * @example
 * ```ts
 * cronbachAlpha([[1, 2, 2], [2, 3, 3], [3, 3, 4], [4, 5, 4], [2, 2, 3]]).rawAlpha; // 0.935483870967742
 * ```
 */
export function cronbachAlpha(x: Ratings): CronbachAlphaResult {
  const k = columnsOf(x, "x").length;
  requireComplete(x, "x");
  if (k < 2) throw new RangeError("'x' needs at least two items");
  const C = cov(x) as number[][];
  const R = cor(x) as number[][];
  const items = Array.from({ length: k }, (_, i) => i);
  const sumR = sum(R.flat());
  const Rinv = solve(R);
  const smc = items.map((i) => 1 - 1 / Rinv[i]![i]!);
  return {
    rawAlpha: rawAlphaOf(C, items),
    stdAlpha: ((1 - k / sumR) * k) / (k - 1),
    G6: 1 - (k - sum(smc)) / sumR,
    averageR: (sumR - k) / (k * (k - 1)),
    alphaDrop: items.map((i) => rawAlphaOf(C, items.filter((j) => j !== i))),
  };
}

/**
 * Partial correlation of columns `i` and `j` of `x` given all its other columns. Equivalent to psych's
 * `partial.r(x, c(i, j), others)` (its off-diagonal element; no missing values).
 *
 * @param x - An n × p matrix (array of rows), the variables in the columns.
 * @param i - 0-based column index.
 * @param j - 0-based column index, different from `i`.
 *
 * @example
 * ```ts
 * partialR([[1, 2, 3], [2, 1, 5], [3, 5, 4], [4, 3, 8], [5, 6, 7]], 0, 1); // 0.9804877404385672
 * ```
 */
export function partialR(x: Ratings, i: number, j: number): number {
  const p = columnsOf(x, "x").length;
  requireComplete(x, "x");
  for (const c of [i, j]) {
    if (!Number.isInteger(c) || c < 0 || c >= p) throw new RangeError(`column index ${c} out of range (0 to ${p - 1})`);
  }
  if (i === j) throw new RangeError("'i' and 'j' must be different columns");
  const R = cor(x) as number[][];
  const ab = [i, j];
  const others = Array.from({ length: p }, (_, c) => c).filter((c) => c !== i && c !== j);
  const P = ab.map((r) => ab.map((s) => R[r]![s]!));
  if (others.length > 0) {
    const Rbb = others.map((r) => others.map((s) => R[r]![s]!));
    const Rba = others.map((r) => ab.map((s) => R[r]![s]!));
    const X = solve(Rbb, Rba);
    for (let r = 0; r < 2; r++) {
      for (let s = 0; s < 2; s++) P[r]![s]! -= sum(others.map((o, t) => R[ab[r]!]![o]! * X[t]![s]!));
    }
  }
  return P[0]![1]! / Math.sqrt(P[0]![0]! * P[1]![1]!);
}
