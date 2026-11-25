// Tobit regression: AER's tobit, a formula entry point to survreg with the response censored at fixed limits.
// Behaviour: oracle/tobit-betareg-loglin-behaviour.md (clean room: from AER's documentation and the output of R; no
// source of R or of a package was read). Written for rStats.js.
import { pchisq } from "../distributions/chisq.js";
import { parseFormula } from "./formula.js";
import { design, type DesignContrast } from "./modelMatrix.js";
import type { DataFrame } from "./modelFrame.js";
import { survreg, type SurvregDistribution, type SurvregResult, type SurvregControl } from "./survreg.js";
import type { Sample } from "../htest/types.js";

/**
 * Options for {@link tobit}.
 * @category Regression models
 */
export interface TobitOptions {
  /** Left limit: responses at or below it are left censored at it (default 0; `-Infinity` for none). */
  left?: number;
  /** Right limit: responses at or above it are right censored at it (default `Infinity`, none). */
  right?: number;
  /**
   * The error distribution (survreg's): `"gaussian"` (default, the classical tobit model), `"logistic"`, `"t"`,
   * `"extreme"`, or one for positive responses (`"weibull"`, `"exponential"`, `"rayleigh"`, `"lognormal"` /
   * `"loggaussian"`, `"loglogistic"`), where the limits are on the scale of the response.
   */
  dist?: SurvregDistribution;
  /** Degrees of freedom of the t distribution (default 4, at least 3). R's tobit takes it as `parms`. */
  df?: number;
  /** Case weights, one per row of `data` (positive), or the name of a column of `data`. */
  weights?: Sample | string;
  /** A contrast per factor of the formula (default treatment contrasts). */
  contrasts?: Record<string, DesignContrast>;
  /** Iteration control, as {@link survreg}'s. */
  control?: SurvregControl;
}

/**
 * Result of {@link tobit}: {@link survreg}'s result with the coefficients named after the formula's terms, and the
 * censoring.
 * @category Regression models
 */
export interface TobitResult extends SurvregResult {
  /** The formula. */
  formula: string;
  /** The limits used. */
  left: number;
  right: number;
  /** Observations: total, left censored, uncensored, right censored. */
  counts: { total: number; left: number; uncensored: number; right: number };
}

/**
 * Tobit regression: a linear model for a response censored at a left and/or right limit, fitted by maximum likelihood
 * with {@link survreg} on the response clipped to [left, right]. Equivalent to R's `AER::tobit()`.
 *
 * A response at or below `left` is left censored at `left`, at or above `right` right censored at `right`. The
 * classical tobit model is the default (left censoring at 0, gaussian errors). `loglik` holds the log-likelihoods of
 * the intercept-only model and of the model (McFadden's R² is `1 - loglik[1] / loglik[0]`), and `chi`, `chiDf`, `chiP`
 * their likelihood-ratio test.
 * @example
 * ```ts
 * const fit = tobit("y ~ x", { y: [0, 0, 1.2, 0.4, 2.5, 0, 3.1, 1.8], x: [1, 2, 3, 2, 5, 1, 6, 4] });
 * fit.counts; // { total: 8, left: 3, uncensored: 5, right: 0 }
 * ```
 * @category Regression models
 */
export function tobit(formula: string, data: DataFrame, options: TobitOptions = {}): TobitResult {
  const left = options.left ?? 0, right = options.right ?? Infinity;
  if (Number.isNaN(left) || Number.isNaN(right) || !(left < right)) throw new RangeError("all(left < right) is not TRUE");
  const parsed = parseFormula(formula);
  if (parsed.response === undefined) throw new TypeError("the formula must have a response");
  const designOptions: Parameters<typeof design>[2] = {};
  if (options.weights !== undefined) designOptions.weights = options.weights;
  if (options.contrasts !== undefined) designOptions.contrasts = options.contrasts;
  const d = design(parsed, data, designOptions);
  const y = d.y;
  if (y === undefined) throw new TypeError("the response must be numeric");
  const intercept = d.terms.intercept;
  const x = d.x.map((row) => (intercept ? row.slice(1) : row.slice()));
  // the clipped response as interval2 data: left censored (-Inf, left], right censored [right, Inf), exact y
  const lo: number[] = [], hi: number[] = [];
  let nLeft = 0, nRight = 0;
  for (const v of y) {
    if (v <= left) { lo.push(-Infinity); hi.push(left); nLeft++; }
    else if (v >= right) { lo.push(right); hi.push(Infinity); nRight++; }
    else { lo.push(v); hi.push(v); }
  }
  const sOptions: Parameters<typeof survreg>[3] = { type: "interval2", time2: hi, dist: options.dist ?? "gaussian", intercept };
  if (options.df !== undefined) sOptions.df = options.df;
  if (d.frame.weights !== undefined) sOptions.weights = d.frame.weights;
  if (options.control !== undefined) sOptions.control = options.control;
  const fit = survreg(lo, undefined, x, sOptions);
  const names = d.colNames.slice();
  const rowNames = [...names, ...fit.tableRowNames.slice(names.length)];
  return {
    ...fit, coefNames: names, tableRowNames: rowNames, formula, left, right,
    counts: { total: y.length, left: nLeft, uncensored: y.length - nLeft - nRight, right: nRight },
    warnings: [...d.warnings, ...fit.warnings],
  };
}

/**
 * Result of {@link tobitSummary}.
 * @category Regression models
 */
export interface TobitSummaryResult {
  /** Row names of the table: the coefficients, then `Log(scale)` (when the scale is estimated). */
  names: string[];
  estimate: number[];
  se: number[];
  z: number[];
  p: number[];
  /** The scale. */
  scale: number;
  /** Log-likelihood of the model and its degrees of freedom (coefficients and scale). */
  loglik: number;
  df: number;
  /** Observations: total, left censored, uncensored, right censored. */
  counts: { total: number; left: number; uncensored: number; right: number };
  /**
   * Wald test of the coefficients other than the intercept: `b' V⁻¹ b`, on the number of coefficients minus 1 degrees
   * of freedom (as R; without an intercept R tests all coefficients on one degree of freedom too few). `null` for the
   * intercept-only model.
   */
  wald: { statistic: number; df: number; p: number } | null;
  iter: number;
  dist: SurvregDistribution;
}

/**
 * Summary of a {@link tobit} fit: the Wald table with the scale and the Wald test of the regression. Equivalent to
 * R's `summary()` of an `AER::tobit()` fit.
 * @example
 * ```ts
 * const fit = tobit("y ~ x", { y: [0, 0, 1.2, 0.4, 2.5, 0, 3.1, 1.8], x: [1, 2, 3, 2, 5, 1, 6, 4] });
 * tobitSummary(fit).wald; // { statistic, df: 1, p }
 * ```
 * @category Regression models
 */
export function tobitSummary(fit: TobitResult): TobitSummaryResult {
  const p = fit.coefficients.length;
  const keep = fit.coefNames.map((nm, j) => (nm === "(Intercept)" ? -1 : j)).filter((j) => j >= 0 && Number.isFinite(fit.coefficients[j]!));
  let wald: TobitSummaryResult["wald"] = null;
  if (keep.length > 0 && p > 1) {
    const V = keep.map((a) => keep.map((b) => fit.var[a]![b]!));
    const b = keep.map((j) => fit.coefficients[j]!);
    const sol = solveSymmetric(V, b);
    const statistic = b.reduce((s, v, i) => s + v * sol[i]!, 0);
    const df = p - 1;
    wald = { statistic, df, p: pchisq(statistic, df, { lowerTail: false }) };
  }
  return {
    names: fit.tableRowNames.slice(), estimate: fit.value.slice(), se: fit.se.slice(), z: fit.z.slice(), p: fit.p.slice(),
    scale: fit.scale[0]!, loglik: fit.loglik[1], df: fit.df, counts: { ...fit.counts }, wald, iter: fit.iter, dist: fit.dist,
  };
}

// Solves V s = b for a symmetric positive definite V (Cholesky); NaN when V is not.
function solveSymmetric(V: number[][], b: number[]): number[] {
  const n = b.length, L = V.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = V[i]![j]!;
    for (let k = 0; k < j; k++) s -= L[i]![k]! * L[j]![k]!;
    if (i === j) { if (!(s > 0)) return new Array<number>(n).fill(NaN); L[i]![i] = Math.sqrt(s); }
    else L[i]![j] = s / L[j]![j]!;
  }
  const z = new Array<number>(n);
  for (let i = 0; i < n; i++) { let s = b[i]!; for (let k = 0; k < i; k++) s -= L[i]![k]! * z[k]!; z[i] = s / L[i]![i]!; }
  const s = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) { let t = z[i]!; for (let k = i + 1; k < n; k++) t -= L[k]![i]! * s[k]!; s[i] = t / L[i]![i]!; }
  return s;
}
