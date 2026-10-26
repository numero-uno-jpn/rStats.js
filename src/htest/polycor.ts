// Polychoric and polyserial correlations, two-step estimates (polycor's polychor and polyserial with their defaults
// ML = FALSE, std.err = FALSE).
//
// Written for rStats.js from oracle/polycor-behaviour.md (no ported code; the source of polycor and mvtnorm was not
// read). Polychoric: the thresholds are the normal quantiles of the cumulative margins, and rho minimises the
// negative log-likelihood of the table under a bivariate normal cut at those thresholds (cell probabilities from
// pbvnorm), by Brent's method on [−0.9999, 0.9999]. Polyserial: the ad hoc estimate from the correlation of x with the
// category codes, scaled by the normal densities at the thresholds.

import { pbvnorm } from "../distributions/bvnorm.js";
import { dnorm, qnorm } from "../distributions/normal.js";
import { pearsonDD } from "./cor.js";
import { sum, variance } from "../internal/summary.js";
import { optimize } from "../numerics/integrate.js";
import { formatR } from "./core/simulate.js";

/** Result of {@link polychor} and {@link polyserial}. */
export interface PolycorResult {
  /** The correlation (`NaN` where polycor returns NA). */
  rho: number;
  /** polycor's warnings, in order. */
  warnings: string[];
}

const BOUND = 0.9999;

/** Normal quantiles of the cumulative proportions of the counts, without the last (which would be +Inf) */
function thresholds(counts: readonly number[]): number[] {
  const n = sum(counts);
  const out: number[] = [];
  let c = 0;
  for (let i = 0; i < counts.length - 1; i++) {
    c += counts[i]!;
    out.push(qnorm(c / n));
  }
  return out;
}

const sortedDistinct = (v: readonly number[]): number[] => [...new Set(v)].sort((a, b) => a - b);

/** "1 row with zero marginal removed", "2 rows with zero marginals removed" */
const removedWarning = (k: number, what: "row" | "column"): string =>
  k === 1 ? `1 ${what} with zero marginal removed` : `${k} ${what}s with zero marginals removed`;

/**
 * Polychoric correlation of two ordinal variables, the two-step estimate: thresholds from the margins, then the
 * maximum-likelihood correlation given them. Equivalent to polycor's `polychor(x, y)` or `polychor(table)` with
 * `ML = FALSE`.
 *
 * Given `x` and `y`, the table has the sorted distinct values of `x` as rows and those of `y` as columns (pairs with
 * a missing value are not counted). Rows and columns with a zero margin are removed with a warning; with fewer than
 * two rows or columns left, `rho` is `NaN`.
 *
 * @param table - A contingency table (array of rows of counts).
 *
 * @example
 * ```ts
 * polychor([[20, 8, 1], [5, 30, 9], [2, 6, 25]]).rho; // 0.785882312445335
 * ```
 */
export function polychor(table: readonly (readonly number[])[]): PolycorResult;
/**
 * Polychoric correlation of two ordinal variables given as vectors of category codes (see the table form).
 *
 * @param x - Categories of the first variable.
 * @param y - Categories of the second variable, the same length.
 */
export function polychor(x: readonly number[], y: readonly number[]): PolycorResult;
export function polychor(x: readonly number[] | readonly (readonly number[])[], y?: readonly number[]): PolycorResult {
  let tab: number[][];
  if (y === undefined) {
    const t = x as readonly (readonly number[])[];
    if (!t.every((r) => Array.isArray(r) || ArrayBuffer.isView(r))) throw new TypeError("give a table (array of rows) or two vectors");
    const k = t[0]?.length ?? 0;
    if (t.some((r) => r.length !== k)) throw new TypeError("the table must have rows of equal length");
    tab = t.map((r) => Array.from(r));
  } else {
    const xs = x as readonly number[];
    if (xs.length !== y.length) throw new RangeError("'x' and 'y' must have the same length");
    const keep = xs.map((v, i) => !Number.isNaN(v) && !Number.isNaN(y[i]!));
    const xv = xs.filter((_, i) => keep[i]);
    const yv = y.filter((_, i) => keep[i]);
    const rows = new Map(sortedDistinct(xv).map((v, i) => [v, i]));
    const cols = new Map(sortedDistinct(yv).map((v, j) => [v, j]));
    tab = Array.from({ length: rows.size }, () => new Array<number>(cols.size).fill(0));
    xv.forEach((v, i) => tab[rows.get(v)!]![cols.get(yv[i]!)!]!++);
  }
  const warnings: string[] = [];
  const rowSums = tab.map((r) => sum(r));
  const zeroRows = rowSums.filter((s) => s === 0).length;
  if (zeroRows > 0) {
    warnings.push(removedWarning(zeroRows, "row"));
    tab = tab.filter((_, i) => rowSums[i] !== 0);
  }
  const colSums = (tab[0] ?? []).map((_, j) => sum(tab.map((r) => r[j]!)));
  const zeroCols = colSums.filter((s) => s === 0).length;
  if (zeroCols > 0) {
    warnings.push(removedWarning(zeroCols, "column"));
    tab = tab.map((r) => r.filter((_, j) => colSums[j] !== 0));
  }
  const r = tab.length;
  const c = tab[0]?.length ?? 0;
  if (r < 2) warnings.push("the table has fewer than 2 rows");
  if (c < 2) warnings.push("the table has fewer than 2 columns");
  if (r < 2 || c < 2) return { rho: NaN, warnings };
  const rowCuts = [-Infinity, ...thresholds(tab.map((row) => sum(row))), Infinity];
  const colCuts = [-Infinity, ...thresholds(tab[0]!.map((_, j) => sum(tab.map((row) => row[j]!)))), Infinity];
  const negLogLik = (rho0: number): number => {
    const rho = Math.max(-BOUND, Math.min(BOUND, rho0));
    const terms: number[] = [];
    for (let i = 0; i < r; i++) {
      for (let j = 0; j < c; j++) {
        const p = pbvnorm([rowCuts[i]!, colCuts[j]!], [rowCuts[i + 1]!, colCuts[j + 1]!], rho);
        terms.push(tab[i]![j]! * Math.log(p));
      }
    }
    return -sum(terms);
  };
  return { rho: optimize(negLogLik, -BOUND, BOUND).optimum, warnings };
}

/**
 * Polyserial correlation of a numeric variable and an ordinal one, the two-step (ad hoc) estimate. Equivalent to
 * polycor's `polyserial(x, y)` with `ML = FALSE`.
 *
 * Pairs with a missing value are dropped. The categories of `y` are its sorted distinct values, coded 1, 2, ...;
 * with fewer than two, `rho` is `NaN`. An estimate beyond ±0.9999 is set to ±0.9999 with a warning.
 *
 * @param x - The numeric variable.
 * @param y - Categories of the ordinal variable, the same length.
 *
 * @example
 * ```ts
 * polyserial([0.2, -1.1, 0.8, 1.5, -0.3, 0.1, -0.9, 2.0], [1, 1, 2, 3, 2, 2, 1, 2]).rho; // 0.8085111526489707
 * ```
 */
export function polyserial(x: readonly number[], y: readonly number[]): PolycorResult {
  if (x.length !== y.length) throw new RangeError("'x' and 'y' must have the same length");
  const keep = x.map((v, i) => !Number.isNaN(v) && !Number.isNaN(y[i]!));
  const xv = x.filter((_, i) => keep[i]);
  const yv = y.filter((_, i) => keep[i]);
  const n = xv.length;
  const levels = sortedDistinct(yv);
  if (levels.length < 2) return { rho: NaN, warnings: ["y has fewer than 2 levels"] };
  const code = new Map(levels.map((v, i) => [v, i + 1]));
  const yc = yv.map((v) => code.get(v)!);
  const counts = levels.map(() => 0);
  for (const v of yc) counts[v - 1]!++;
  const cuts = thresholds(counts);
  const warnings: string[] = [];
  let rho = (Math.sqrt((n - 1) / n) * Math.sqrt(variance(yc)) * pearsonDD(xv, yc)[0]) / sum(cuts.map((t) => dnorm(t)));
  if (Math.abs(rho) > BOUND) {
    const bounded = Math.sign(rho) * BOUND;
    warnings.push(`initial correlation inadmissible, ${formatR(rho)}, set to ${formatR(bounded)}`);
    rho = bounded;
  }
  return { rho, warnings };
}
