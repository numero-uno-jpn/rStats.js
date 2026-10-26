// Polychoric and polyserial correlations (polycor's polychor and polyserial): the two-step estimates (the defaults
// ML = FALSE, std.err = FALSE), the maximum-likelihood estimates (ML = TRUE) and the standard errors (std.err = TRUE).
//
// Written for rStats.js from oracle/polycor-behaviour.md (no ported code; the source of polycor and mvtnorm was not
// read). Polychoric: the thresholds are the normal quantiles of the cumulative margins, and rho minimises the
// negative log-likelihood of the table under a bivariate normal cut at those thresholds (cell probabilities from
// pbvnorm), by Brent's method on [−0.9999, 0.9999]. Polyserial: the ad hoc estimate from the correlation of x with the
// category codes, scaled by the normal densities at the thresholds.
//
// With ML or stdErr, the likelihood is maximised exactly (R's optimisers stop about 1e-4 short of the maximum): by
// Newton's method from the two-step values with the analytic gradient and Hessian of the log-likelihood, halving the
// step while the log-likelihood decreases. The variances are the inverse of the negative analytic Hessian at the
// maximum. The polychoric chi-square is evaluated so that the saturated tables (where it is a few times 1e-6) keep
// their relative accuracy: with ε = N P / n − 1 per cell, Σ n log(n / (N P)) = Σ n (ε − log(1 + ε)) + N Σ P over the
// empty cells, since the probabilities add up to 1.

import { pbvnorm } from "../distributions/bvnorm.js";
import { dnorm, pnorm, qnorm } from "../distributions/normal.js";
import { pearsonDD } from "./cor.js";
import { mean, sum, variance } from "../internal/summary.js";
import { optimize } from "../numerics/integrate.js";
import { solve } from "../linalg/solve.js";
import { formatR } from "./core/simulate.js";

/** Result of {@link polychor} and {@link polyserial}. */
export interface PolycorResult {
  /** The correlation (`NaN` where polycor returns NA). */
  rho: number;
  /** polycor's warnings, in order. */
  warnings: string[];
}

/** Options of {@link polychor} and {@link polyserial}. */
export interface PolycorOptions {
  /**
   * Estimate the correlation and the thresholds together by maximum likelihood (polycor's `ML = TRUE`), instead of
   * the two-step estimate. Default `false`.
   */
  ML?: boolean;
  /**
   * Also return the variances of the estimates, the chi-square test of bivariate normality and the thresholds
   * (polycor's `std.err = TRUE`). Without `ML`, the correlation is the maximum-likelihood one given the two-step
   * thresholds. Default `false`.
   */
  stdErr?: boolean;
}

/** Result of {@link polychor} with `stdErr`. */
export interface PolychorStdErrResult extends PolycorResult {
  /**
   * Variances and covariances of the estimates (the inverse of the negative Hessian of the log-likelihood at the
   * maximum), in the order rho, the row thresholds, the column thresholds; 1 × 1 (rho alone) without `ML`.
   */
  var: number[][];
  /** Chi-square statistic of the test of bivariate normality. */
  chisq: number;
  /** Its degrees of freedom, r c − r − c. */
  df: number;
  /** The number of observations (the total of the table). */
  n: number;
  /** The row thresholds (the estimates with `ML`, the two-step ones otherwise). */
  rowCuts: number[];
  /** The column thresholds. */
  colCuts: number[];
}

/** Result of {@link polyserial} with `stdErr`. */
export interface PolyserialStdErrResult extends PolycorResult {
  /** Variances and covariances of the estimates, in the order rho, the thresholds; 1 × 1 (rho alone) without `ML`. */
  var: number[][];
  /** Chi-square statistic of the test of bivariate normality (polycor's, on a binned table). */
  chisq: number;
  /** Its degrees of freedom, 3 s − 1 for s categories. */
  df: number;
  /** The number of observations used. */
  n: number;
  /** The thresholds of the ordinal variable (the estimates with `ML`, the two-step ones otherwise). */
  cuts: number[];
}

type Table = readonly (readonly number[])[];

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

const isVector = (v: unknown): v is readonly number[] => Array.isArray(v) || ArrayBuffer.isView(v);

/** Φ(hi) − Φ(lo) for lo ≤ hi, from the upper tails when both are positive (no cancellation near 1) */
const normalInterval = (lo: number, hi: number): number =>
  lo > 0 ? pnorm(lo, { lowerTail: false }) - pnorm(hi, { lowerTail: false }) : pnorm(hi) - pnorm(lo);

/** v standardised to mean 0 and sample standard deviation 1 */
function standardise(v: readonly number[]): number[] {
  const m = mean(v);
  const centred = v.map((x) => x - m);
  const sd = Math.sqrt(variance(centred));
  return centred.map((x) => x / sd);
}

/** ε − log(1 + ε) without cancellation for small ε */
function excessOverLog1p(e: number): number {
  if (Math.abs(e) >= 0.1) return e - Math.log1p(e);
  let term = e;
  let total = 0;
  for (let k = 2; k < 40; k++) {
    term *= -e;
    const add = term / k;
    total += add;
    if (Math.abs(add) <= 1e-17 * Math.abs(total)) break;
  }
  return -total;
}

/** A log-likelihood with its gradient and Hessian in the free parameters */
interface LogLikelihood {
  value: number;
  gradient: number[];
  hessian: number[][];
}

const zeroMatrix = (p: number): number[][] => Array.from({ length: p }, () => new Array<number>(p).fill(0));

/** Adds the log of a probability with the given gradient and Hessian, n times, to the log-likelihood */
function addLogTerm(acc: LogLikelihood, n: number, p: number, grad: readonly number[], hess: readonly (readonly number[])[]): void {
  acc.value += n * Math.log(p);
  const k = grad.length;
  for (let a = 0; a < k; a++) {
    acc.gradient[a]! += (n * grad[a]!) / p;
    for (let b = 0; b < k; b++) acc.hessian[a]![b]! += n * (hess[a]![b]! / p - (grad[a]! * grad[b]!) / (p * p));
  }
}

/**
 * Derivatives of F(h, k) = Φ2(h, k; ρ) at a corner of a rectangle (the formulas of the behaviour file), in
 * ρ (r), h and k; the terms with an infinite bound vanish.
 */
interface CornerDerivatives {
  r: number;
  h: number;
  k: number;
  rr: number;
  rh: number;
  rk: number;
  hh: number;
  hk: number;
  kk: number;
}

const NO_DERIVATIVES: CornerDerivatives = { r: 0, h: 0, k: 0, rr: 0, rh: 0, rk: 0, hh: 0, hk: 0, kk: 0 };

function cornerDerivatives(h: number, k: number, rho: number): CornerDerivatives {
  if (h === -Infinity || k === -Infinity || (h === Infinity && k === Infinity)) return NO_DERIVATIVES;
  if (h === Infinity) return { ...NO_DERIVATIVES, k: dnorm(k), kk: -k * dnorm(k) };
  if (k === Infinity) return { ...NO_DERIVATIVES, h: dnorm(h), hh: -h * dnorm(h) };
  const s2 = (1 - rho) * (1 + rho);
  const s = Math.sqrt(s2);
  const q = h * h - 2 * rho * h * k + k * k;
  const density = Math.exp(-q / (2 * s2)) / (2 * Math.PI * s);
  const u = (k - rho * h) / s;
  const v = (h - rho * k) / s;
  const dh = dnorm(h);
  const dk = dnorm(k);
  return {
    r: density,
    h: dh * pnorm(u),
    k: dk * pnorm(v),
    rr: density * (rho / s2 + (h * k * s2 - rho * q) / (s2 * s2)),
    rh: (-density * (h - rho * k)) / s2,
    rk: (-density * (k - rho * h)) / s2,
    hh: -h * dh * pnorm(u) - (rho / s) * dh * dnorm(u),
    hk: density,
    kk: -k * dk * pnorm(v) - (rho / s) * dk * dnorm(v),
  };
}

/**
 * Log-likelihood of a contingency table under the bivariate normal cut at the thresholds (extended by ±Inf), with
 * its derivatives in ρ alone, or in (ρ, the row thresholds, the column thresholds) with `freeCuts`.
 */
function polychoricLogLik(tab: Table, rowCuts: readonly number[], colCuts: readonly number[], rho: number, freeCuts: boolean): LogLikelihood {
  const r = tab.length;
  const c = tab[0]!.length;
  const p = freeCuts ? r + c - 1 : 1;
  const acc: LogLikelihood = { value: 0, gradient: new Array<number>(p).fill(0), hessian: zeroMatrix(p) };
  const rowParam = (i: number): number => (freeCuts && i >= 1 && i <= r - 1 ? i : -1);
  const colParam = (j: number): number => (freeCuts && j >= 1 && j <= c - 1 ? r - 1 + j : -1);
  const corners = rowCuts.map((h) => colCuts.map((k) => cornerDerivatives(h, k, rho)));
  const terms: number[] = [];
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const count = tab[i]![j]!;
      if (count === 0) continue;
      const prob = pbvnorm([rowCuts[i]!, colCuts[j]!], [rowCuts[i + 1]!, colCuts[j + 1]!], rho);
      const grad = new Array<number>(p).fill(0);
      const hess = zeroMatrix(p);
      for (const [ci, cj, sign] of [[i + 1, j + 1, 1], [i, j + 1, -1], [i + 1, j, -1], [i, j, 1]] as const) {
        const d = corners[ci]![cj]!;
        const a = rowParam(ci);
        const b = colParam(cj);
        grad[0]! += sign * d.r;
        hess[0]![0]! += sign * d.rr;
        if (a >= 0) {
          grad[a]! += sign * d.h;
          hess[0]![a]! += sign * d.rh;
          hess[a]![0]! += sign * d.rh;
          hess[a]![a]! += sign * d.hh;
        }
        if (b >= 0) {
          grad[b]! += sign * d.k;
          hess[0]![b]! += sign * d.rk;
          hess[b]![0]! += sign * d.rk;
          hess[b]![b]! += sign * d.kk;
        }
        if (a >= 0 && b >= 0) {
          hess[a]![b]! += sign * d.hk;
          hess[b]![a]! += sign * d.hk;
        }
      }
      addLogTerm(acc, count, prob, grad, hess);
      terms.push(count * Math.log(prob));
    }
  }
  acc.value = sum(terms);
  return acc;
}

/**
 * Log-likelihood of the polyserial model: Σ_i [log φ(z_i) + log(Φ(τ_hi) − Φ(τ_lo))] with τ = (c − ρ z_i)/sqrt(1 − ρ²)
 * at the thresholds around the category of observation i (0-based `category`), with its derivatives in ρ alone, or in
 * (ρ, the thresholds) with `freeCuts`.
 */
function polyserialLogLik(z: readonly number[], category: readonly number[], cuts: readonly number[], rho: number, freeCuts: boolean): LogLikelihood {
  const p = freeCuts ? cuts.length + 1 : 1;
  const acc: LogLikelihood = { value: 0, gradient: new Array<number>(p).fill(0), hessian: zeroMatrix(p) };
  const s2 = (1 - rho) * (1 + rho);
  const s = Math.sqrt(s2);
  const s3 = s2 * s;
  const grad = new Array<number>(p);
  const hess = zeroMatrix(p);
  const terms: number[] = [];
  // adds sign × the derivatives of Φ(τ) at threshold index m (parameter m + 1)
  const addBound = (m: number, zi: number, sign: number): void => {
    const c = cuts[m]!;
    const t = (c - rho * zi) / s;
    const dens = dnorm(t);
    const tr = (rho * c - zi) / s3;
    const tc = 1 / s;
    const trr = c / s3 + (3 * rho * (rho * c - zi)) / (s3 * s2);
    const trc = rho / s3;
    grad[0]! += sign * dens * tr;
    hess[0]![0]! += sign * dens * (trr - t * tr * tr);
    if (freeCuts) {
      const a = m + 1;
      grad[a]! += sign * dens * tc;
      const mixed = sign * dens * (trc - t * tr * tc);
      hess[0]![a]! += mixed;
      hess[a]![0]! += mixed;
      hess[a]![a]! += sign * dens * (-t * tc * tc);
    }
  };
  for (let i = 0; i < z.length; i++) {
    const zi = z[i]!;
    const j = category[i]!;
    grad.fill(0);
    for (const row of hess) row.fill(0);
    const hi = j < cuts.length ? (cuts[j]! - rho * zi) / s : Infinity;
    const lo = j > 0 ? (cuts[j - 1]! - rho * zi) / s : -Infinity;
    if (j < cuts.length) addBound(j, zi, 1);
    if (j > 0) addBound(j - 1, zi, -1);
    addLogTerm(acc, 1, normalInterval(lo, hi), grad, hess);
    terms.push(Math.log(normalInterval(lo, hi)), dnorm(zi, { log: true }));
  }
  acc.value = sum(terms);
  return acc;
}

/** Newton step (−H)⁻¹ g in the free parameters (0 elsewhere); gradient ascent scaled by the diagonal if not an ascent direction */
function newtonStep(at: LogLikelihood, free: readonly number[]): number[] {
  const step = new Array<number>(at.gradient.length).fill(0);
  const g = free.map((a) => at.gradient[a]!);
  const negH = free.map((a) => free.map((b) => -at.hessian[a]![b]!));
  let d: number[] | undefined;
  try {
    d = solve(negH, g);
  } catch {
    d = undefined;
  }
  if (d === undefined || !d.every(Number.isFinite) || sum(d.map((v, k) => v * g[k]!)) <= 0) {
    d = g.map((v, k) => v / Math.max(Math.abs(negH[k]![k]!), 1));
  }
  free.forEach((a, k) => (step[a] = d[k]!));
  return step;
}

/** The log-likelihood is no lower than `than`, up to its rounding */
const noLowerThan = (value: number, than: number): boolean => value >= than - 1e-12 * Math.abs(than);

/**
 * Newton iterations with step halving from theta, the correlation (first parameter) kept in [−0.9999, 0.9999] and
 * fixed with `bounded`. Reaching the bound with the step pointing outwards fixes the correlation there.
 */
function newtonIterations(
  evaluate: (theta: readonly number[]) => LogLikelihood,
  start: readonly number[],
  startBounded: boolean,
): { theta: number[]; at: LogLikelihood; bounded: boolean } {
  let theta = [...start];
  let at = evaluate(theta);
  let bounded = startBounded;
  const all = theta.map((_, k) => k);
  for (let iter = 0; iter < 200; iter++) {
    const free = bounded ? all.slice(1) : all;
    if (free.length === 0) break;
    const step = newtonStep(at, free);
    if (!bounded && Math.abs(theta[0]!) === BOUND && step[0]! * theta[0]! > 0) {
      bounded = true;
      continue;
    }
    let scale = Math.abs(theta[0]! + step[0]!) > BOUND ? (Math.sign(step[0]!) * BOUND - theta[0]!) / step[0]! : 1;
    let accepted = false;
    for (let halving = 0; halving < 60; halving++) {
      const next = theta.map((v, k) => v + scale * step[k]!);
      if (scale * step[0]! !== 0 && Math.abs(next[0]!) >= BOUND * (1 - 1e-15)) next[0] = Math.sign(next[0]!) * BOUND;
      const nextAt = evaluate(next);
      if (noLowerThan(nextAt.value, at.value)) {
        const moved = Math.max(...next.map((v, k) => Math.abs(v - theta[k]!) / Math.max(1, Math.abs(theta[k]!))));
        theta = next;
        at = nextAt;
        accepted = moved > 1e-12;
        break;
      }
      scale /= 2;
    }
    if (!accepted) break;
  }
  return { theta, at, bounded };
}

/**
 * Maximises a log-likelihood whose first parameter is the correlation, kept in [−0.9999, 0.9999], by Newton's method
 * with step halving. If the likelihood increases up to the bound, the correlation stays there (`bounded`) and the
 * other parameters are maximised given it. Where the likelihood rises along a flat ridge towards the bound (cells
 * whose probability goes to 0 have no cases), the iterations stall short of it: the point reached is compared with
 * the maximum given the correlation at the bound on that side, and the bound is taken if it is no lower.
 */
function maximiseLogLik(evaluate: (theta: readonly number[]) => LogLikelihood, start: readonly number[]): { theta: number[]; at: LogLikelihood; bounded: boolean } {
  const found = newtonIterations(evaluate, [Math.max(-BOUND, Math.min(BOUND, start[0]!)), ...start.slice(1)], false);
  if (found.bounded || found.theta[0] === 0) return found;
  const atBound = newtonIterations(evaluate, [Math.sign(found.theta[0]!) * BOUND, ...found.theta.slice(1)], true);
  return noLowerThan(atBound.at.value, found.at.value) ? atBound : found;
}

/** (−H)⁻¹, symmetrised; all infinite at the bound of the correlation (not a maximum, as R's 1 × 1 variance there) or where −H is singular */
function inverseNegHessian(hessian: readonly (readonly number[])[], bounded: boolean): number[][] {
  const infinite = (): number[][] => hessian.map((row) => row.map(() => Infinity));
  if (bounded) return infinite();
  let inv: number[][];
  try {
    inv = solve(hessian.map((row) => row.map((v) => -v)));
  } catch {
    return infinite();
  }
  return inv.map((row, a) => row.map((v, b) => (v + inv[b]![a]!) / 2));
}

const inadmissibleWarning = (rho: number): string => `inadmissible correlation set to ${rho > 0 ? "0.9999" : "-0.9999"}`;

/**
 * Polychoric correlation of two ordinal variables. By default the two-step estimate: thresholds from the margins,
 * then the maximum-likelihood correlation given them. Equivalent to `polycor::polychor()` in R. It takes `x` and `y`
 * or a table, as `polychor(x, y)` or `polychor(table)`.
 *
 * Given `x` and `y`, the table has the sorted distinct values of `x` as rows and those of `y` as columns (pairs with
 * a missing value are not counted). Rows and columns with a zero margin are removed with a warning; with fewer than
 * two rows or columns left, `rho` is `NaN` (and the result has no other fields).
 *
 * With `ML`, the correlation and the thresholds are estimated together by maximum likelihood; with `stdErr`, the
 * result also has their variances, the chi-square test of bivariate normality and the thresholds (with `stdErr`
 * alone, the correlation is maximised given the two-step thresholds). The exact maximum is returned (R's optimisers
 * stop about 1e-4 short of it). If the likelihood increases up to |rho| = 0.9999, `rho` is ±0.9999 with a warning.
 *
 * @param table - A contingency table (array of rows of counts).
 * @param options - `ML` and `stdErr` (see {@link PolycorOptions}).
 *
 * @example
 * ```ts
 * polychor([[20, 8, 1], [5, 30, 9], [2, 6, 25]]).rho; // 0.785882312445335
 * polychor([[20, 8, 1], [5, 30, 9], [2, 6, 25]], { ML: true }).rho; // 0.7911463316235798
 * ```
 */
export function polychor(table: readonly (readonly number[])[], options: PolycorOptions & { stdErr: true }): PolychorStdErrResult;
export function polychor(table: readonly (readonly number[])[], options?: PolycorOptions): PolycorResult;
/**
 * Polychoric correlation of two ordinal variables given as vectors of category codes (see the table form).
 *
 * @param x - Categories of the first variable.
 * @param y - Categories of the second variable, the same length.
 * @param options - `ML` and `stdErr` (see {@link PolycorOptions}).
 */
export function polychor(x: readonly number[], y: readonly number[], options: PolycorOptions & { stdErr: true }): PolychorStdErrResult;
export function polychor(x: readonly number[], y: readonly number[], options?: PolycorOptions): PolycorResult;
export function polychor(
  x: readonly number[] | Table,
  yOrOptions?: readonly number[] | PolycorOptions,
  maybeOptions?: PolycorOptions,
): PolycorResult | PolychorStdErrResult {
  let tab: number[][];
  let options: PolycorOptions;
  if (!isVector(yOrOptions)) {
    const t = x as Table;
    if (!t.every(isVector)) throw new TypeError("give a table (array of rows) or two vectors");
    const k = t[0]?.length ?? 0;
    if (t.some((r) => r.length !== k)) throw new TypeError("the table must have rows of equal length");
    tab = t.map((r) => Array.from(r));
    options = yOrOptions ?? {};
  } else {
    const xs = x as readonly number[];
    const y = yOrOptions;
    if (xs.length !== y.length) throw new RangeError("'x' and 'y' must have the same length");
    const keep = xs.map((v, i) => !Number.isNaN(v) && !Number.isNaN(y[i]!));
    const xv = xs.filter((_, i) => keep[i]);
    const yv = y.filter((_, i) => keep[i]);
    const rows = new Map(sortedDistinct(xv).map((v, i) => [v, i]));
    const cols = new Map(sortedDistinct(yv).map((v, j) => [v, j]));
    tab = Array.from({ length: rows.size }, () => new Array<number>(cols.size).fill(0));
    xv.forEach((v, i) => tab[rows.get(v)!]![cols.get(yv[i]!)!]!++);
    options = maybeOptions ?? {};
  }
  const { ML = false, stdErr = false } = options;
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
        // an empty cell contributes 0, also where its probability underflows to 0
        if (tab[i]![j]! === 0) continue;
        const p = pbvnorm([rowCuts[i]!, colCuts[j]!], [rowCuts[i + 1]!, colCuts[j + 1]!], rho);
        terms.push(tab[i]![j]! * Math.log(p));
      }
    }
    return -sum(terms);
  };
  const twoStep = optimize(negLogLik, -BOUND, BOUND).optimum;
  if (!ML && !stdErr) return { rho: twoStep, warnings };

  // maximum likelihood: θ = (ρ, the inner row thresholds, the inner column thresholds) with ML, ρ alone otherwise
  const extend = (cuts: readonly number[]): number[] => [-Infinity, ...cuts, Infinity];
  const innerRow = rowCuts.slice(1, r);
  const innerCol = colCuts.slice(1, c);
  const evaluate = (theta: readonly number[]): LogLikelihood =>
    ML
      ? polychoricLogLik(tab, extend(theta.slice(1, r)), extend(theta.slice(r)), theta[0]!, true)
      : polychoricLogLik(tab, rowCuts, colCuts, theta[0]!, false);
  const { theta, at, bounded } = maximiseLogLik(evaluate, ML ? [twoStep, ...innerRow, ...innerCol] : [twoStep]);
  const rho = theta[0]!;
  if (bounded) warnings.push(inadmissibleWarning(rho));
  if (!stdErr) return { rho, warnings };

  const fittedRow = ML ? extend(theta.slice(1, r)) : rowCuts;
  const fittedCol = ML ? extend(theta.slice(r)) : colCuts;
  const n = sum(tab.map((row) => sum(row)));
  // chisq = 2 (−ℓ + Σ n_ij log((n_ij + 1e-6)/n)) = 2 Σ [n log(1 + 1e-6/n) + n (ε − log(1 + ε))] + 2 n Σ_{empty} P
  const terms: number[] = [];
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const count = tab[i]![j]!;
      const prob = pbvnorm([fittedRow[i]!, fittedCol[j]!], [fittedRow[i + 1]!, fittedCol[j + 1]!], rho);
      if (count === 0) terms.push(n * prob);
      else terms.push(count * Math.log1p(1e-6 / count), count * excessOverLog1p((n * prob) / count - 1));
    }
  }
  return {
    rho,
    warnings,
    var: inverseNegHessian(at.hessian, bounded),
    chisq: 2 * sum(terms),
    df: r * c - r - c,
    n,
    rowCuts: fittedRow.slice(1, r),
    colCuts: fittedCol.slice(1, c),
  };
}

/** polycor's chi-square for the polyserial model: the standardised codes and z binned, against the bivariate normal */
function polyserialChisq(codes: readonly number[], z: readonly number[], cuts: readonly number[], rho: number): number {
  const n = codes.length;
  const quartiles = [qnorm(0.25), qnorm(0.5), qnorm(0.75)];
  // classes of intervals closed on the right
  const classOf = (v: number, bounds: readonly number[]): number => bounds.filter((b) => b < v).length;
  const rowsBinned = standardise(codes).map((v) => classOf(v, cuts));
  const colsBinned = standardise(z).map((v) => classOf(v, quartiles));
  const counts = Array.from({ length: cuts.length + 1 }, () => new Array<number>(4).fill(0));
  rowsBinned.forEach((a, i) => counts[a]![colsBinned[i]!]!++);
  const rowBounds = [-Infinity, ...cuts, Infinity];
  const colBounds = [-Infinity, ...quartiles, Infinity];
  const terms: number[] = [];
  counts.forEach((row, i) =>
    row.forEach((count, j) => {
      if (count === 0) return;
      const prob = pbvnorm([rowBounds[i]!, colBounds[j]!], [rowBounds[i + 1]!, colBounds[j + 1]!], rho);
      terms.push(count * Math.log((count + 1e-6) / (prob * n)));
    }),
  );
  return 2 * sum(terms);
}

/**
 * Polyserial correlation of a numeric variable and an ordinal one. By default the two-step (ad hoc) estimate.
 * Equivalent to `polycor::polyserial(x, y)` in R.
 *
 * Pairs with a missing value are dropped. The categories of `y` are its sorted distinct values, coded 1, 2, ...;
 * with fewer than two, `rho` is `NaN` (and the result has no other fields). A two-step estimate beyond ±0.9999 is set
 * to ±0.9999 with a warning.
 *
 * With `ML`, the correlation and the thresholds are estimated together by maximum likelihood; with `stdErr`, the
 * result also has their variances, polycor's chi-square test of bivariate normality and the thresholds (with `stdErr`
 * alone, the correlation is maximised given the two-step thresholds). The exact maximum is returned (R's optimisers
 * stop about 1e-4 short of it). If the likelihood increases up to |rho| = 0.9999, `rho` is ±0.9999 with a warning.
 *
 * @param x - The numeric variable.
 * @param y - Categories of the ordinal variable, the same length.
 * @param options - `ML` and `stdErr` (see {@link PolycorOptions}).
 *
 * @example
 * ```ts
 * polyserial([0.2, -1.1, 0.8, 1.5, -0.3, 0.1, -0.9, 2.0], [1, 1, 2, 3, 2, 2, 1, 2]).rho; // 0.8085111526489707
 * ```
 */
export function polyserial(x: readonly number[], y: readonly number[], options: PolycorOptions & { stdErr: true }): PolyserialStdErrResult;
export function polyserial(x: readonly number[], y: readonly number[], options?: PolycorOptions): PolycorResult;
export function polyserial(x: readonly number[], y: readonly number[], options: PolycorOptions = {}): PolycorResult | PolyserialStdErrResult {
  if (x.length !== y.length) throw new RangeError("'x' and 'y' must have the same length");
  const { ML = false, stdErr = false } = options;
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
  if (!ML && !stdErr) return { rho, warnings };

  // maximum likelihood: θ = (ρ, the thresholds) with ML, ρ alone otherwise
  const z = standardise(xv);
  const category = yc.map((v) => v - 1);
  const evaluate = (theta: readonly number[]): LogLikelihood =>
    polyserialLogLik(z, category, ML ? theta.slice(1) : cuts, theta[0]!, ML);
  const { theta, at, bounded } = maximiseLogLik(evaluate, ML ? [rho, ...cuts] : [rho]);
  if (bounded) warnings.push(inadmissibleWarning(theta[0]!));
  if (!stdErr) return { rho: theta[0]!, warnings };

  const fittedCuts = ML ? theta.slice(1) : cuts;
  const s = levels.length;
  return {
    rho: theta[0]!,
    warnings,
    var: inverseNegHessian(at.hessian, bounded),
    // at the estimates with ML, at the two-step values otherwise (as polycor)
    chisq: polyserialChisq(yc, z, fittedCuts, ML ? theta[0]! : rho),
    df: 4 * s - s - 1,
    n,
    cuts: fittedCuts,
  };
}
