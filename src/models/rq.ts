// Quantile regression. The linear-programming formulation follows Koenker and Bassett (1978)
// and the primal-dual interior-point method of Portnoy and Koenker (1997).
// This implementation is independently derived from those published equations and public numerical output.

import { reported } from "../internal/warnings.js";
import { qr } from "../linalg/qr.js";
import { parseFormula } from "./formula.js";
import { design, type DesignContrast } from "./modelMatrix.js";
import type { DataFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";

export type RqMethod = "br" | "fn";

export interface RqOptions {
  tau?: number | Sample;
  method?: RqMethod;
  weights?: Sample | string;
  contrasts?: Record<string, DesignContrast>;
  levels?: Record<string, readonly string[]>;
  maxit?: number;
  eps?: number;
}

export interface RqModel {
  formula: string;
  x: number[][];
  y: number[];
  weights: number[];
  rows: number[];
  columnNames: string[];
  tau: number[];
  method: RqMethod;
}

export interface RqResult {
  coefficients: Record<string, number | number[]>;
  fittedValues: number[] | number[][];
  residuals: number[] | number[][];
  rho: number | number[];
  converged: boolean;
  iterations: number;
  warnings: string[];
  model: RqModel;
}

function solveLinear(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(m[i]![k]!) > Math.abs(m[pivot]![k]!)) pivot = i;
    let rowScale = 1;
    for (let j = 0; j < n; j++) rowScale = Math.max(rowScale, Math.abs(m[pivot]![j]!));
    if (!(Math.abs(m[pivot]![k]!) > Number.EPSILON * rowScale)) {
      throw new RangeError("singular design matrix");
    }
    [m[k], m[pivot]] = [m[pivot]!, m[k]!];
    const d = m[k]![k]!;
    for (let j = k; j <= n; j++) m[k]![j]! /= d;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = m[i]![k]!;
      if (f === 0) continue;
      for (let j = k; j <= n; j++) m[i]![j]! -= f * m[k]![j]!;
    }
  }
  return m.map((row) => row[n]!);
}

function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

function applyA(x: readonly number[][], p: number, z: readonly number[]): number[] {
  const n = x.length;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let v = z[2 * p + i]! - z[2 * p + n + i]!;
    for (let j = 0; j < p; j++) v += x[i]![j]! * (z[j]! - z[p + j]!);
    out[i] = v;
  }
  return out;
}

function applyAT(x: readonly number[][], p: number, y: readonly number[]): number[] {
  const n = x.length;
  const out = new Array<number>(2 * p + 2 * n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      const v = x[i]![j]! * y[i]!;
      out[j]! += v;
      out[p + j]! -= v;
    }
    out[2 * p + i] = y[i]!;
    out[2 * p + n + i] = -y[i]!;
  }
  return out;
}

/** Solve (diag(d) + X diag(b) X')v = rhs using the p-dimensional Woodbury identity. */
function solveSchur(x: readonly number[][], b: readonly number[], d: readonly number[], rhs: readonly number[]): number[] {
  const n = x.length;
  const p = b.length;
  const dinv = d.map((v) => 1 / v);
  const u = Array.from({ length: n }, (_, i) => dinv[i]! * rhs[i]!);
  const small = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const projected = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      const xj = x[i]![j]!;
      projected[j]! += xj * u[i]!;
      for (let k = 0; k < p; k++) small[j]![k]! += xj * dinv[i]! * x[i]![k]!;
    }
  }
  for (let j = 0; j < p; j++) {
    if (!(b[j]! > 0)) throw new RangeError("singular design matrix");
    small[j]![j]! += 1 / b[j]!;
  }
  const correction = solveLinear(small, projected);
  for (let i = 0; i < n; i++) {
    let v = u[i]!;
    for (let j = 0; j < p; j++) v -= dinv[i]! * x[i]![j]! * correction[j]!;
    u[i] = v;
  }
  return u;
}

interface NewtonStep { dx: number[]; ds: number[]; dy: number[] }

function direction(
  x: readonly number[][], y: readonly number[], tau: number, z: readonly number[], s: readonly number[],
  dual: readonly number[], rp: readonly number[], rd: readonly number[], rc: readonly number[],
): NewtonStep {
  const n = y.length;
  const p = x[0]!.length;
  const q = z.map((v, i) => (-rc[i]! + v * rd[i]!) / s[i]!);
  const aq = applyA(x, p, q);
  const ratio = z.map((v, i) => v / s[i]!);
  const d = new Array<number>(n);
  const b = new Array<number>(p);
  for (let i = 0; i < n; i++) d[i] = ratio[2 * p + i]! + ratio[2 * p + n + i]!;
  for (let j = 0; j < p; j++) b[j] = ratio[j]! + ratio[p + j]!;
  const rhs = rp.map((v, i) => -v - aq[i]!);
  const dy = solveSchur(x, b, d, rhs);
  const at = applyAT(x, p, dy);
  const dx = q.map((v, i) => v + ratio[i]! * at[i]!);
  const ds = rd.map((v, i) => -v - at[i]!);
  return { dx, ds, dy };
}

function maxStep(v: readonly number[], dv: readonly number[]): number {
  let a = 1;
  for (let i = 0; i < v.length; i++) if (dv[i]! < 0) a = Math.min(a, -v[i]! / dv[i]!);
  return a;
}

/** Weighted quantile regression by a primal-dual path-following LP solver. */
function fitOne(
  x: readonly number[][], y: readonly number[], weights: readonly number[], tau: number, maxit: number, eps: number,
): { beta: number[]; fitted: number[]; residuals: number[]; rho: number; converged: boolean; iterations: number } {
  const n = y.length;
  const p = x[0]!.length;
  if (n === 0 || p === 0) throw new RangeError("the design matrix must have at least one column and one row");
  if (n < p) throw new RangeError("singular design matrix");
  const columnScale = new Array<number>(p).fill(0);
  for (const row of x) for (let j = 0; j < p; j++) columnScale[j] = Math.max(columnScale[j]!, Math.abs(row[j]!));
  if (columnScale.some((v) => !(v > 0) || !Number.isFinite(v))) throw new RangeError("singular design matrix");
  const responseScale = y.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const weightScale = weights.reduce((m, v) => Math.max(m, v), 0);
  const normalizedX = x.map((row) => row.map((v, j) => v / columnScale[j]!));
  if (qr(normalizedX).rank < p) throw new RangeError("singular design matrix");
  const xx = normalizedX.map((row, i) => row.map((v) => v * (weights[i]! / weightScale)));
  const yy = y.map((v, i) => (v / responseScale) * (weights[i]! / weightScale));
  const ww = weights;
  const z = new Array<number>(2 * p + 2 * n).fill(1);
  const s = new Array<number>(2 * p + 2 * n).fill(1);
  const dual = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    z[2 * p + i] = Math.max(yy[i]!, 0) + 1;
    z[2 * p + n + i] = Math.max(-yy[i]!, 0) + 1;
    s[2 * p + i] = tau;
    s[2 * p + n + i] = 1 - tau;
  }
  const c = new Array<number>(2 * p + 2 * n).fill(0);
  for (let i = 0; i < n; i++) {
    c[2 * p + i] = tau;
    c[2 * p + n + i] = 1 - tau;
  }
  const bvec = yy;
  let converged = false;
  let iterations = 0;
  for (let it = 0; it < maxit; it++) {
    iterations = it + 1;
    const az = applyA(xx, p, z);
    const rp = az.map((v, i) => v - bvec[i]!);
    const aty = applyAT(xx, p, dual);
    const rd = aty.map((v, i) => v + s[i]! - c[i]!);
    let mu = 0;
    for (let i = 0; i < z.length; i++) mu += z[i]! * s[i]!;
    mu /= z.length;
    let primalMax = 0, dataMax = 1, dualMax = 0, costMax = 1;
    for (let i = 0; i < rp.length; i++) { primalMax = Math.max(primalMax, Math.abs(rp[i]!)); dataMax = Math.max(dataMax, Math.abs(bvec[i]!)); }
    for (let i = 0; i < rd.length; i++) { dualMax = Math.max(dualMax, Math.abs(rd[i]!)); costMax = Math.max(costMax, Math.abs(c[i]!)); }
    const primalNorm = primalMax / dataMax;
    const dualNorm = dualMax / costMax;
    if (Math.max(primalNorm, dualNorm, mu) <= eps) { converged = true; break; }
    const rcAff = z.map((v, i) => v * s[i]!);
    const aff = direction(xx, yy, tau, z, s, dual, rp, rd, rcAff);
    const alphaP = Math.min(1, maxStep(z, aff.dx));
    const alphaD = Math.min(1, maxStep(s, aff.ds));
    let muAff = 0;
    for (let i = 0; i < z.length; i++) muAff += (z[i]! + alphaP * aff.dx[i]!) * (s[i]! + alphaD * aff.ds[i]!);
    muAff /= z.length;
    const sigma = Math.max(0, Math.min(1, (muAff / mu) ** 3));
    const rc = z.map((v, i) => v * s[i]! + aff.dx[i]! * aff.ds[i]! - sigma * mu);
    const step = direction(xx, yy, tau, z, s, dual, rp, rd, rc);
    const ap = Math.min(1, 0.995 * maxStep(z, step.dx));
    const ad = Math.min(1, 0.995 * maxStep(s, step.ds));
    for (let i = 0; i < z.length; i++) { z[i]! += ap * step.dx[i]!; s[i]! += ad * step.ds[i]!; }
    for (let i = 0; i < n; i++) dual[i]! += ad * step.dy[i]!;
  }
  const beta = z.slice(0, p).map((v, j) => ((v - z[p + j]!) * responseScale) / columnScale[j]!);
  const fitted = x.map((row) => dot(row, beta));
  const residuals = y.map((v, i) => v - fitted[i]!);
  let rho = 0;
  for (let i = 0; i < n; i++) rho += ww[i]! * residuals[i]! * (tau - (residuals[i]! < 0 ? 1 : 0));
  if (!converged) {
    const score = x[0]!.map((_, j) => {
      let v = 0;
      for (let i = 0; i < n; i++) v += weights[i]! * x[i]![j]! * (residuals[i]! < 0 ? tau - 1 : tau);
      return Math.abs(v);
    });
    let norm = 0;
    for (const value of score) norm = Math.max(norm, value);
    if (norm <= 1e-7 * Math.max(1, Math.abs(rho))) converged = true;
  }
  return { beta, fitted, residuals, rho, converged, iterations };
}

/**
 * Fit a linear conditional quantile model. Uses the formula/model-matrix interface of other regression models.
 *
 * @param formula A formula such as `y ~ x`.
 * @param data A data frame of columns.
 * @param options Quantile, algorithm, and prior weights.
 * @example
 * ```ts
 * rq("y ~ x", { x: [1, 2, 3, 4], y: [2, 1, 4, 3] }, { tau: 0.5 });
 * ```
 * @category Regression
 */
export function rq(formula: string, data: DataFrame, options: RqOptions = {}): RqResult {
  const tauValues = typeof options.tau === "number" ? [options.tau] : options.tau === undefined ? [0.5] : Array.from(options.tau);
  if (tauValues.length === 0 || tauValues.some((v) => !(v > 0 && v < 1) || !Number.isFinite(v))) {
    throw new RangeError("tau must contain values strictly between 0 and 1");
  }
  const method = options.method ?? "br";
  if (method !== "br" && method !== "fn") throw new RangeError("method must be 'br' or 'fn'");
  const maxit = options.maxit ?? 100;
  const eps = options.eps ?? 1e-10;
  if (!Number.isInteger(maxit) || maxit < 1) throw new RangeError("maxit must be a positive integer");
  if (!(eps > 0) || !Number.isFinite(eps)) throw new RangeError("eps must be positive and finite");
  const d = design(parseFormula(formula), data, {
    ...(options.weights === undefined ? {} : { weights: options.weights }),
    ...(options.contrasts === undefined ? {} : { contrasts: options.contrasts }),
    ...(options.levels === undefined ? {} : { levels: options.levels }),
  });
  if (d.y === undefined) throw new TypeError("the formula must have a numeric response");
  const weights = d.frame.weights ?? new Array<number>(d.y.length).fill(1);
  if (weights.some((v) => !Number.isFinite(v) || v < 0)) throw new RangeError("weights must be non-negative and finite");
  const kept = d.y.map((v, i) => i).filter((i) => weights[i]! > 0);
  if (kept.length < d.x[0]!.length) throw new RangeError("singular design matrix");
  const x = kept.map((i) => d.x[i]!);
  const y = kept.map((i) => d.y![i]!);
  const w = kept.map((i) => weights[i]!);
  if (x.some((row) => row.some((v) => !Number.isFinite(v))) || y.some((v) => !Number.isFinite(v))) {
    throw new RangeError("x and y must contain only finite values");
  }
  const fits = tauValues.map((tau) => fitOne(x, y, w, tau, maxit, eps));
  const coefficients: Record<string, number | number[]> = {};
  d.colNames.forEach((name, j) => {
    coefficients[name] = tauValues.length === 1 ? fits[0]!.beta[j]! : fits.map((fit) => fit.beta[j]!);
  });
  const model: RqModel = { formula, x, y, weights: w, rows: kept.map((i) => d.frame.rows[i]!), columnNames: d.colNames, tau: tauValues, method };
  const warnings = [...d.warnings];
  if (fits.some((fit) => !fit.converged)) warnings.push("quantile regression did not converge within the iteration limit");
  const fittedValues = tauValues.length === 1 ? fits[0]!.fitted : fits.map((fit) => fit.fitted);
  const residuals = tauValues.length === 1 ? fits[0]!.residuals : fits.map((fit) => fit.residuals);
  const rho = tauValues.length === 1 ? fits[0]!.rho : fits.map((fit) => fit.rho);
  return reported("rq", {
    coefficients, fittedValues, residuals, rho, converged: fits.every((fit) => fit.converged),
    iterations: fits.reduce((m, fit) => Math.max(m, fit.iterations), 0), warnings, model,
  });
}

/** Predict conditional quantiles for new observations. */
export function rqPredict(fit: RqResult, newdata: DataFrame): number[] | number[][] {
  const rhs = fit.model.formula.slice(fit.model.formula.indexOf("~") + 1);
  const parsed = parseFormula("~ " + rhs);
  const d = design(parsed, newdata, { anyResponse: true, dropUnusedLevels: true });
  const matrix = d.x;
  const coefs = fit.model.tau.map((_, k) => fit.model.columnNames.map((name) => {
    const v = fit.coefficients[name]!;
    return Array.isArray(v) ? v[k]! : v;
  }));
  const values = coefs.map((beta) => matrix.map((row) => dot(row, beta)));
  return values.length === 1 ? values[0]! : values;
}
