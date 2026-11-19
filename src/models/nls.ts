// Nonlinear least-squares fitting and its public summaries.
// Independently derived from Bates & Watts (1988), Bates & Chambers (1992),
// Golub & Pereyra (1973), and oracle/nls-behaviour.md. No R or PORT source was used.

import { pt1, qt1 } from "../distributions/t.js";
import { pf1, qf1 } from "../distributions/f.js";
import { reported } from "../internal/warnings.js";
import type { DataFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";
import {
  differentiateNls,
  evaluateNlsExpression,
  evaluateNlsWithGradient,
  parseNlsFormula,
  type NlsExpr,
} from "./nlsFormula.js";

/** Algorithm used to fit a nonlinear least-squares model.
 *
 * @category Regression
 */
export type NlsAlgorithm = "default" | "plinear" | "port";

/** Convergence controls for nonlinear least squares.
 *
 * @category Regression
 */
export interface NlsControl {
  maxiter?: number;
  tol?: number;
  minFactor?: number;
  warnOnly?: boolean;
  scaleOffset?: number;
}

/** Options for {@link nls}.
 *
 * @category Regression
 */
export interface NlsOptions {
  start?: Record<string, number>;
  algorithm?: NlsAlgorithm;
  weights?: Sample | string;
  lower?: number | readonly number[] | Record<string, number>;
  upper?: number | readonly number[] | Record<string, number>;
  control?: NlsControl;
}

/** Internal and public fitted-model quantities.
 *
 * @category Regression
 */
export interface NlsModel {
  formula: string;
  response: string;
  parameterNames: string[];
  coefficients: Record<string, number>;
  fitted: number[];
  residuals: number[];
  y: number[];
  weights: number[];
  rows: number[];
  data: Record<string, number[]>;
  expression: NlsExpr;
  deviance: number;
  sigma: number;
  dfResidual: number;
  nobs: number;
  covariance: number[][];
  correlation: number[][];
  converged: boolean;
  iterations: number;
  algorithm: NlsAlgorithm;
  warnings: string[];
  exactFit: boolean;
}

/** Result returned by {@link nls}.
 *
 * @category Regression
 */
export interface NlsResult extends NlsModel {}

/** Result returned by {@link nlsSummary}.
 *
 * @category Regression
 */
export interface NlsSummaryResult {
  coefficients: { rows: string[]; cols: string[]; values: number[][] };
  sigma: number;
  df: [number, number];
  deviance: number;
  nobs: number;
  warnings: string[];
}

/** Options for {@link nlsPredict}.
 *
 * @category Regression
 */
export interface NlsPredictOptions {
  newdata: DataFrame;
}

/** Options for {@link nlsConfint}.
 *
 * @category Regression
 */
export interface NlsConfintOptions {
  method?: "profile" | "wald";
  level?: number;
  parm?: readonly string[];
}

/** Result returned by {@link nlsConfint}.
 *
 * @category Regression
 */
export interface NlsConfintResult {
  rows: string[];
  cols: [string, string];
  values: [number, number][];
  warnings: string[];
}

/** Result returned by {@link nlsAnova}.
 *
 * @category Regression
 */
export interface NlsAnovaResult {
  table: {
    Model: string[];
    "Res.Df": number[];
    "Res.Sum Sq": number[];
    "Df": (number | "NA")[];
    "Sum Sq": (number | "NA")[];
    "F value": (number | "NA")[];
    "Pr(>F)": (number | "NA")[];
  };
  warnings: string[];
}

function column(data: DataFrame, name: string): number[] {
  const value = data[name];
  if (value === undefined) throw new Error("data column '" + name + "' was not found");
  const out = Array.from(value as ArrayLike<number>, Number);
  if (!out.every(x => typeof x === "number")) throw new TypeError("column '" + name + "' must be numeric");
  return out;
}

function expressionVariables(expr: NlsExpr, out = new Set<string>()): Set<string> {
  if (expr.type === "variable") out.add(expr.name);
  else if (expr.type === "unary") expressionVariables(expr.value, out);
  else if (expr.type === "binary") { expressionVariables(expr.left, out); expressionVariables(expr.right, out); }
  else if (expr.type === "call") expr.args.forEach(x => expressionVariables(x, out));
  return out;
}

function initialValue(name: string, x: number[], y: number[]): number {
  const ymin = Math.min(...y), ymax = Math.max(...y), xMin = Math.min(...x), xMax = Math.max(...x);
  const range = Math.max(xMax - xMin, 1);
  const lower = name.toLowerCase();
  if (name === "Asym" || name === "Vm" || name === "B") return ymax;
  if (name === "R0" || name === "A") return ymin;
  if (name === "Drop") return Math.max(ymax - ymin, 1e-3);
  if (name === "K") {
    const target = (ymin + ymax) / 2;
    let best = 0;
    for (let i = 1; i < y.length; i++) if (Math.abs(y[i]! - target) < Math.abs(y[best]! - target)) best = i;
    return Math.max(Math.abs(x[best]!), 1e-6);
  }
  if (name === "xmid" || name === "c0") return (xMin + xMax) / 2;
  if (name === "scal") return range / 4;
  if (name === "b2") return 2;
  if (name === "b3") return 0.6;
  if (name === "lrc") return -1;
  if (name === "lrc1") return 0;
  if (name === "lrc2") return -1.5;
  if (name === "lKe") return -2.5;
  if (name === "lKa") return 0.5;
  if (name === "lCl") return -3;
  if (name === "lrc" || lower.startsWith("lr")) return -1;
  if (name === "pwr") return 1.5;
  if (name === "A1") return ymax * 0.7;
  if (name === "A2") return ymax * 0.3;
  return 1;
}

function solve(A0: number[][], b0: number[]): number[] {
  const n = b0.length;
  if (A0.length !== n || A0.some(row => row.length !== n)) throw new Error("least-squares system has incompatible dimensions");
  const A = A0.map(row => [...row]), b = [...b0];
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i]![k]!) > Math.abs(A[pivot]![k]!)) pivot = i;
    const scale = Math.max(...A.map(row => Math.max(...row.map(Math.abs))), 1);
    if (!(Math.abs(A[pivot]![k]!) > Number.EPSILON * scale * n * 32)) throw new Error("singular gradient matrix; parameters are not locally identifiable");
    [A[k], A[pivot]] = [A[pivot]!, A[k]!];
    [b[k], b[pivot]] = [b[pivot]!, b[k]!];
    const d = A[k]![k]!;
    for (let j = k; j < n; j++) A[k]![j] = A[k]![j]! / d;
    b[k] = b[k]! / d;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = A[i]![k]!;
      for (let j = k; j < n; j++) A[i]![j] = A[i]![j]! - f * A[k]![j]!;
      b[i] = b[i]! - f * b[k]!;
    }
  }
  return b;
}

function inverse(A: number[][]): number[][] {
  const n = A.length;
  const columns = Array.from({ length: n }, (_, j) => solve(A, Array.from({ length: n }, (_, i) => i === j ? 1 : 0)));
  return Array.from({ length: n }, (_, i) => columns.map(col => col[i]!));
}

function normalEquations(J: number[][], residuals: number[], weights: number[]): { matrix: number[][]; rhs: number[] } {
  const p = J[0]?.length ?? 0;
  const matrix = Array.from({ length: p }, () => Array(p).fill(0) as number[]);
  const rhs = Array(p).fill(0) as number[];
  for (let i = 0; i < J.length; i++) {
    const w = weights[i]!;
    for (let a = 0; a < p; a++) {
      rhs[a] = rhs[a]! + w * J[i]![a]! * residuals[i]!;
      for (let b = 0; b < p; b++) matrix[a]![b] = matrix[a]![b]! + w * J[i]![a]! * J[i]![b]!;
    }
  }
  return { matrix, rhs };
}

function evaluate(
  expr: NlsExpr,
  dataRows: Record<string, number>[],
  y: number[],
  weights: number[],
  names: string[],
  values: number[],
  algorithm: NlsAlgorithm,
): { fitted: number[]; residuals: number[]; jacobian: number[][]; objective: number; coefficients: Record<string, number> } {
  const parameters: Record<string, number> = {};
  names.forEach((name, i) => { parameters[name] = values[i]!; });
  const fitted: number[] = [], residuals: number[] = [], jacobian: number[][] = [];
  let objective = 0;
  for (let i = 0; i < y.length; i++) {
    const row = dataRows[i]!;
    const evaluated = evaluateNlsWithGradient(expr, row, parameters, names);
    const f = algorithm === "plinear" ? values[values.length - 1]! * evaluated.value : evaluated.value;
    const g = algorithm === "plinear"
      ? [...evaluated.gradient.map(v => values[values.length - 1]! * v), evaluated.value]
      : evaluated.gradient;
    const r = y[i]! - f;
    if (!Number.isFinite(f) || !Number.isFinite(r) || g.some(v => !Number.isFinite(v))) {
      throw new Error("non-finite model value or gradient; check the formula domain and starting values");
    }
    fitted.push(f); residuals.push(r); jacobian.push(g);
    objective += weights[i]! * r * r;
  }
  return { fitted, residuals, jacobian, objective, coefficients: parameters };
}

function evaluateProfiled(
  expr: NlsExpr, rows: Record<string, number>[], y: number[], weights: number[],
  names: string[], values: number[],
): { fitted: number[]; residuals: number[]; jacobian: number[][]; objective: number; linear: number } {
  const parameters: Record<string, number> = {};
  names.forEach((name, i) => { parameters[name] = values[i]!; });
  const basis: number[] = [], rawGradient: number[][] = [];
  for (const row of rows) {
    const result = evaluateNlsWithGradient(expr, row, parameters, names);
    basis.push(result.value); rawGradient.push(result.gradient);
  }
  let numerator = 0, denominator = 0;
  for (let i = 0; i < y.length; i++) {
    numerator += weights[i]! * basis[i]! * y[i]!;
    denominator += weights[i]! * basis[i]! * basis[i]!;
  }
  if (!(denominator > 0)) throw new Error("plinear basis is identically zero");
  const linear = numerator / denominator;
  const fitted = basis.map(v => linear * v);
  const residuals = y.map((v, i) => v - fitted[i]!);
  const projection = names.map((_, j) => {
    let sum = 0;
    for (let i = 0; i < y.length; i++) sum += weights[i]! * basis[i]! * rawGradient[i]![j]!;
    return sum / denominator;
  });
  const jacobian = rawGradient.map((gradient, i) =>
    gradient.map((v, j) => linear * (v - basis[i]! * projection[j]!)));
  const objective = residuals.reduce((s, r, i) => s + weights[i]! * r * r, 0);
  return { fitted, residuals, jacobian, objective, linear };
}

function makeBounds(
  bound: NlsOptions["lower"] | NlsOptions["upper"],
  names: string[],
  fallback: number,
): number[] {
  if (bound === undefined) return names.map(() => fallback);
  if (typeof bound === "number") return names.map(() => bound);
  if (Array.isArray(bound)) {
    if (bound.length !== names.length) throw new RangeError("bound vector length must equal the number of parameters");
    return [...bound];
  }
  const record = bound as Record<string, number>;
  return names.map(name => record[name] ?? fallback);
}

function fitCore(
  expr: NlsExpr, rows: Record<string, number>[], y: number[], weights: number[],
  names: string[], start: number[], algorithm: NlsAlgorithm,
  lower: number[], upper: number[], control: Required<NlsControl>,
): { values: number[]; fitted: number[]; residuals: number[]; jacobian: number[][]; objective: number; iterations: number; converged: boolean; linear?: number } {
  let values = [...start];
  const warnings: string[] = [];
  let current = algorithm === "plinear"
    ? evaluateProfiled(expr, rows, y, weights, names, values)
    : evaluate(expr, rows, y, weights, names, values, algorithm);
  let converged = false, iterations = 0;
  for (; iterations < control.maxiter; iterations++) {
    const { matrix, rhs } = normalEquations(current.jacobian, current.residuals, weights);
    let delta: number[];
    try {
      const scales = matrix.map((row, i) => Math.sqrt(Math.max(row[i]!, Number.MIN_VALUE)));
      const scaledMatrix = matrix.map((row, i) => row.map((value, j) => value / (scales[i]! * scales[j]!)));
      const scaledRhs = rhs.map((value, i) => value / scales[i]!);
      delta = solve(scaledMatrix, scaledRhs).map((value, i) => value / scales[i]!);
    } catch (error) {
      throw new Error("singular gradient: " + (error instanceof Error ? error.message : String(error)));
    }
    const projectedDelta = delta.map((value, i) => {
      if (algorithm !== "port") return value;
      const boundTolerance = 16 * Number.EPSILON * Math.max(1, Math.abs(values[i]!));
      if (values[i]! <= lower[i]! + boundTolerance && value < 0) return 0;
      if (values[i]! >= upper[i]! - boundTolerance && value > 0) return 0;
      return value;
    });
    const scaledGradientNorm = Math.max(0, ...rhs.map((value, i) =>
      projectedDelta[i] === 0 ? 0 : Math.abs(value) / (Math.sqrt(Math.max(matrix[i]![i]!, Number.MIN_VALUE))
        * (Math.sqrt(current.objective) + control.scaleOffset + Number.EPSILON))));
    const stepNorm = Math.max(0, ...projectedDelta.map((v, i) => Math.abs(v) / (1 + Math.abs(values[i]!))));
    const stepTolerance = Math.max(1e-12, Math.sqrt(control.tol) * 0.001);
    if (scaledGradientNorm <= Math.max(control.tol * 100, 1e-13)
      && stepNorm <= stepTolerance) {
      converged = true; break;
    }
    let alpha = 1, accepted = false;
    while (alpha >= control.minFactor) {
      const candidate = values.map((v, i) => Math.min(upper[i]!, Math.max(lower[i]!, v + alpha * delta[i]!)));
      if (candidate.every((v, i) => v === values[i])) { alpha /= 2; continue; }
      try {
        const trial = algorithm === "plinear"
          ? evaluateProfiled(expr, rows, y, weights, names, candidate)
          : evaluate(expr, rows, y, weights, names, candidate, algorithm);
        const candidateStepNorm = alpha * stepNorm;
        const roundingAllowance = 4 * Number.EPSILON * Math.max(1, current.objective);
        if (trial.objective < current.objective
          || (candidateStepNorm <= stepTolerance * 10 && trial.objective <= current.objective + roundingAllowance)) {
          values = candidate; current = trial; accepted = true; break;
        }
      } catch { /* A trial outside the function domain is rejected and the step is reduced. */ }
      alpha /= 2;
    }
    if (!accepted) {
      if (stepNorm <= stepTolerance * 10) {
        converged = true; break;
      }
      break;
    }
  }
  if (!converged && iterations >= control.maxiter) iterations = control.maxiter;
  if (!converged && !control.warnOnly) throw new Error("number of iterations exceeded; nonlinear fit did not converge");
  const final = algorithm === "plinear"
    ? evaluateProfiled(expr, rows, y, weights, names, values)
    : evaluate(expr, rows, y, weights, names, values, algorithm);
  return { values, ...final, iterations, converged };
}

function covarianceFromJacobian(J: number[][], weights: number[], sigma2: number): number[][] {
  const p = J[0]?.length ?? 0;
  const matrix = Array.from({ length: p }, () => Array(p).fill(0) as number[]);
  for (let i = 0; i < J.length; i++) {
    for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) {
      matrix[a]![b] = matrix[a]![b]! + weights[i]! * J[i]![a]! * J[i]![b]!;
    }
  }
  return inverse(matrix).map(row => row.map(v => v * sigma2));
}

function corrFromCovariance(cov: number[][]): number[][] {
  return cov.map((row, i) => row.map((v, j) => {
    const d = Math.sqrt(Math.max(0, cov[i]![i]! * cov[j]![j]!));
    return d === 0 ? Number.NaN : v / d;
  }));
}

/**
 * Nonlinear least-squares regression. Equivalent to R's `nls()`.
 *
 * Fits a user-specified nonlinear mean function by Gauss-Newton, variable projection, or bound-constrained
 * least squares. Formula expressions are parsed safely and differentiated symbolically.
 *
 * @param formula Response and nonlinear mean expression.
 * @param data Numeric data columns.
 * @param options Starting values, algorithm, weights, and convergence controls.
 * @returns The fitted coefficients, residuals, covariance, and convergence diagnostics.
 *
 * @example
 * ```ts
 * const data = { conc: [0.02, 0.06, 0.11, 0.22, 0.56, 1.1], rate: [76, 97, 123, 159, 191, 207] };
 * const fit = nls("rate ~ Vm * conc / (K + conc)", data, { start: { Vm: 200, K: 0.05 } });
 * fit.coefficients;
 * ```
 *
 * @category Regression
 */
export function nls(formula: string, data: DataFrame, options: NlsOptions = {}): NlsResult {
  const parsed = parseNlsFormula(formula);
  const rawY = column(data, parsed.response);
  const n = rawY.length;
  if (Object.values(data).some(col => col.length !== n)) throw new RangeError("all data columns must have the same length");
  const variables = [...expressionVariables(parsed.expression)];
  const dataNames = new Set(Object.keys(data));
  const startNames = options.start ? Object.keys(options.start) : [];
  const inferredNames = variables.filter(name => !dataNames.has(name));
  const parameterNames = options.start ? startNames : inferredNames;
  if (parameterNames.length === 0) throw new Error("no free parameters were found in the formula");
  if (!options.start && !/\bSS(?:asymp|asympOff|asympOrig|biexp|fol|fpl|gompertz|logis|micmen|weibull)\s*\(/.test(formula)) {
    throw new Error("start must be supplied for a formula without a self-starting model");
  }
  if (options.start && Object.keys(options.start).length !== new Set(Object.keys(options.start)).size) {
    throw new Error("starting parameter names must be unique");
  }
  if (options.start && Object.values(options.start).some(v => !Number.isFinite(v))) throw new RangeError("starting values must be finite");
  let start = options.start ? parameterNames.map(name => options.start![name]!) : parameterNames.map(name => initialValue(name, rawY, column(data, variables.find(v => dataNames.has(v)) ?? parsed.response)));
  if (!options.start && /\bSSmicmen\s*\(/.test(formula)) {
    const predictorName = variables.find(name => dataNames.has(name));
    if (predictorName) {
      const x = column(data, predictorName);
      const pairs = rawY.map((value, i) => [x[i]!, value] as const)
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0);
      const u = pairs.map(([a]) => 1 / a), v = pairs.map(([, b]) => 1 / b);
      const meanU = u.reduce((sum, value) => sum + value, 0) / u.length;
      const meanV = v.reduce((sum, value) => sum + value, 0) / v.length;
      const slope = u.reduce((sum, value, i) => sum + (value - meanU) * (v[i]! - meanV), 0)
        / u.reduce((sum, value) => sum + (value - meanU) ** 2, 0);
      const intercept = meanV - slope * meanU;
      if (intercept > 0 && slope > 0) {
        for (let i = 0; i < parameterNames.length; i++) {
          if (parameterNames[i] === "Vm") start[i] = 1 / intercept;
          if (parameterNames[i] === "K") start[i] = slope / intercept;
        }
      }
    }
  }
  if (start.some(v => !Number.isFinite(v))) throw new RangeError("could not obtain finite starting values");

  const weightRaw = typeof options.weights === "string"
    ? column(data, options.weights)
    : options.weights === undefined ? Array(n).fill(1) as number[] : Array.from(options.weights);
  if (weightRaw.length !== n) throw new RangeError("weights must have one value per observation");
  if (weightRaw.some(w => !Number.isFinite(w) || w < 0)) throw new RangeError("weights must be finite and non-negative");

  const predictorNames = variables.filter(name => dataNames.has(name));
  const dataColumns: Record<string, number[]> = {};
  for (const name of predictorNames) dataColumns[name] = column(data, name);
  const rows: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(rawY[i]!) || weightRaw[i] === 0) continue;
    if (predictorNames.some(name => !Number.isFinite(dataColumns[name]![i]!))) continue;
    rows.push(i);
  }
  const p = parameterNames.length + (options.algorithm === "plinear" ? 1 : 0);
  if (rows.length <= p) throw new Error("number of observations must exceed the number of parameters");
  const y = rows.map(i => rawY[i]!);
  const weights = rows.map(i => weightRaw[i]!);
  const dataRows = rows.map(i => Object.fromEntries(predictorNames.map(name => [name, dataColumns[name]![i]!])) as Record<string, number>);
  const algorithm = options.algorithm ?? "default";
  if (algorithm !== "default" && algorithm !== "plinear" && algorithm !== "port") throw new Error("unsupported algorithm: " + String(algorithm));
  const names = parameterNames;
  const lower = makeBounds(options.lower, names, -Infinity);
  const upper = makeBounds(options.upper, names, Infinity);
  if (algorithm !== "port" && (options.lower !== undefined || options.upper !== undefined)) {
    throw new Error("lower and upper bounds are supported only by algorithm 'port'");
  }
  if (lower.some((v, i) => Number.isNaN(v) || v > upper[i]!) || start.some((v, i) => v < lower[i]! || v > upper[i]!)) {
    throw new RangeError("starting values must be within ordered lower and upper bounds");
  }
  const ctl = options.control ?? {};
  const control: Required<NlsControl> = {
    maxiter: ctl.maxiter ?? 100,
    tol: ctl.tol ?? 1e-12,
    minFactor: ctl.minFactor ?? 1 / 1024,
    warnOnly: ctl.warnOnly ?? false,
    scaleOffset: ctl.scaleOffset ?? 0,
  };
  if (!(control.maxiter >= 1 && Number.isInteger(control.maxiter))) throw new RangeError("maxiter must be a positive integer");
  if (!(control.tol > 0 && Number.isFinite(control.tol))) throw new RangeError("tol must be positive and finite");
  if (!(control.minFactor > 0 && control.minFactor <= 1)) throw new RangeError("minFactor must be in (0, 1]");
  if (!(control.scaleOffset >= 0 && Number.isFinite(control.scaleOffset))) throw new RangeError("scaleOffset must be non-negative and finite");

  const fitted = fitCore(parsed.expression, dataRows, y, weights, parameterNames, start, algorithm, lower, upper, control);
  const coefficientNames = algorithm === "plinear" ? [...parameterNames, ".lin"] : parameterNames;
  const coefficients: Record<string, number> = {};
  parameterNames.forEach((name, i) => { coefficients[name] = fitted.values[i]!; });
  if (algorithm === "plinear") coefficients[".lin"] = fitted.linear!;
  const dfResidual = rows.length - coefficientNames.length;
  const sigma = Math.sqrt(fitted.objective / dfResidual);
  const exactFit = fitted.objective === 0;
  let fullJacobian = fitted.jacobian;
  if (algorithm === "plinear") {
    const parameters = Object.fromEntries(parameterNames.map((name, i) => [name, fitted.values[i]!]));
    fullJacobian = dataRows.map(row => {
      const result = evaluateNlsWithGradient(parsed.expression, row, parameters, parameterNames);
      return [...result.gradient.map(v => coefficients[".lin"]! * v), result.value];
    });
  }
  const covariance = exactFit ? coefficientNames.map(() => coefficientNames.map(() => Number.NaN))
    : covarianceFromJacobian(fullJacobian, weights, sigma * sigma);
  const warnings = fitted.converged ? [] : ["number of iterations exceeded; nonlinear fit did not converge"];
  return reported("nls", {
    formula, response: parsed.response, parameterNames: coefficientNames, coefficients,
    fitted: fitted.fitted, residuals: fitted.residuals, y, weights, rows, data: dataColumns,
    expression: parsed.expression, deviance: fitted.objective, sigma, dfResidual, nobs: rows.length,
    covariance, correlation: corrFromCovariance(covariance), converged: fitted.converged,
    iterations: fitted.iterations, algorithm, warnings, exactFit,
  });
}

/**
 * Summary of a nonlinear least-squares fit. Equivalent to R's `summary.nls()`.
 *
 * @param fit A fitted nonlinear model.
 * @returns The coefficient table, residual scale, and residual degrees of freedom.
 *
 * @example
 * ```ts
 * const data = { conc: [0.02, 0.06, 0.11, 0.22, 0.56, 1.1], rate: [76, 97, 123, 159, 191, 207] };
 * const fit = nls("rate ~ Vm * conc / (K + conc)", data, { start: { Vm: 200, K: 0.05 } });
 * nlsSummary(fit);
 * ```
 *
 * @category Regression
 */
export function nlsSummary(fit: NlsResult): NlsSummaryResult {
  const rows = fit.parameterNames;
  const values = rows.map((name, i) => {
    const estimate = fit.coefficients[name]!;
    const se = Math.sqrt(fit.covariance[i]![i]!);
    const t = estimate / se;
    const p = 2 * pt1(Math.abs(t), fit.dfResidual, false, false);
    return [estimate, se, t, p];
  });
  return reported("nlsSummary", {
    coefficients: { rows, cols: ["Estimate", "Std. Error", "t value", "Pr(>|t|)"], values },
    sigma: fit.sigma, df: [fit.parameterNames.length, fit.dfResidual], deviance: fit.deviance,
    nobs: fit.nobs, warnings: [...fit.warnings],
  }, fit);
}

/**
 * Covariance matrix of a nonlinear least-squares fit. Equivalent to R's `vcov.nls()`.
 *
 * @param fit A fitted nonlinear model.
 * @returns The covariance matrix in coefficient order.
 *
 * @example
 * ```ts
 * const data = { conc: [0.02, 0.06, 0.11, 0.22, 0.56, 1.1], rate: [76, 97, 123, 159, 191, 207] };
 * const fit = nls("rate ~ Vm * conc / (K + conc)", data, { start: { Vm: 200, K: 0.05 } });
 * nlsVcov(fit);
 * ```
 *
 * @category Regression
 */
export function nlsVcov(fit: NlsResult): number[][] {
  return fit.covariance.map(row => [...row]);
}

/**
 * Predictions from a nonlinear least-squares fit. Equivalent to R's `predict.nls()`.
 *
 * @param fit A fitted nonlinear model.
 * @param options New predictor data.
 * @returns One fitted mean per row of new data.
 *
 * @example
 * ```ts
 * const data = { conc: [0.02, 0.06, 0.11, 0.22, 0.56, 1.1], rate: [76, 97, 123, 159, 191, 207] };
 * const fit = nls("rate ~ Vm * conc / (K + conc)", data, { start: { Vm: 200, K: 0.05 } });
 * nlsPredict(fit, { newdata: { conc: [0.1, 0.5] } });
 * ```
 *
 * @category Regression
 */
export function nlsPredict(fit: NlsResult, options: NlsPredictOptions): number[] {
  const data = options.newdata;
  const lengths = Object.values(data).map(col => col.length);
  const n = lengths[0] ?? 0;
  if (lengths.some(length => length !== n)) throw new RangeError("newdata columns must have equal lengths");
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const row: Record<string, number> = {};
    for (const [name, col] of Object.entries(data)) row[name] = Number(col[i]);
    try {
      const value = evaluateNlsExpression(fit.expression, row, fit.coefficients);
      out.push(fit.algorithm === "plinear" ? fit.coefficients[".lin"]! * value : value);
    } catch {
      out.push(Number.NaN);
    }
  }
  return out;
}

interface ProfilePoint {
  value: number;
  objective: number;
  nuisance: number[];
  residuals: number[];
  jacobian: number[][];
}

/** Refit nuisance parameters with one coefficient fixed, starting from the nearest profile point. */
function profilePoint(fit: NlsResult, fixedIndex: number, fixedValue: number, initial: number[]): ProfilePoint {
  const nonlinearNames = fit.parameterNames.filter(name => name !== ".lin");
  const nuisanceIndices = nonlinearNames.map((_, i) => i).filter(i => i !== fixedIndex);
  const nuisanceNames = nuisanceIndices.map(i => nonlinearNames[i]!);
  let nuisance = [...initial];
  const parameters = (): number[] => {
    const full = nonlinearNames.map(name => fit.coefficients[name]!);
    full[fixedIndex] = fixedValue;
    nuisanceIndices.forEach((index, j) => { full[index] = nuisance[j]!; });
    return full;
  };
  const calculate = () => {
    const vals = parameters();
    const evaluated = fit.algorithm === "plinear"
      ? evaluateProfiled(fit.expression, fit.rows.map(i => Object.fromEntries(Object.entries(fit.data).map(([name, col]) => [name, col[i]!]))), fit.y, fit.weights, nonlinearNames, vals)
      : evaluate(fit.expression, fit.rows.map(i => Object.fromEntries(Object.entries(fit.data).map(([name, col]) => [name, col[i]!]))), fit.y, fit.weights, nonlinearNames, vals, "default");
    const jacobian = evaluated.jacobian.map(row => nuisanceIndices.map(index => row[index]!));
    return { ...evaluated, jacobian };
  };
  let current = calculate();
  for (let iteration = 0; iteration < 120 && nuisance.length > 0; iteration++) {
    const { matrix, rhs } = normalEquations(current.jacobian, current.residuals, fit.weights);
    let delta: number[];
    try {
      const scales = matrix.map((row, i) => Math.sqrt(Math.max(row[i]!, Number.MIN_VALUE)));
      const scaled = matrix.map((row, i) => row.map((v, j) => v / (scales[i]! * scales[j]!)));
      delta = solve(scaled, rhs.map((v, i) => v / scales[i]!)).map((v, i) => v / scales[i]!);
    } catch { break; }
    const gradientNorm = Math.max(0, ...rhs.map((v, i) => Math.abs(v) / Math.sqrt(Math.max(matrix[i]![i]!, Number.MIN_VALUE))));
    const stepNorm = Math.max(0, ...delta.map((v, i) => Math.abs(v) / (1 + Math.abs(nuisance[i]!))));
    if (gradientNorm <= 1e-10 * (Math.sqrt(current.objective) + 1) && stepNorm <= 1e-10) break;
    let alpha = 1, accepted = false;
    while (alpha >= 1 / 4096) {
      const candidate = nuisance.map((v, i) => v + alpha * delta[i]!);
      const previous = nuisance;
      nuisance = candidate;
      try {
        const trial = calculate();
        if (trial.objective < current.objective
          || (alpha * stepNorm < 1e-9 && trial.objective <= current.objective + 8 * Number.EPSILON * Math.max(1, current.objective))) {
          current = trial; accepted = true; break;
        }
      } catch { /* reject a point outside the expression domain */ }
      nuisance = previous;
      alpha /= 2;
    }
    if (!accepted) break;
  }
  const fullValues = parameters();
  const full = fit.algorithm === "plinear"
    ? evaluateProfiled(fit.expression, fit.rows.map(i => Object.fromEntries(Object.entries(fit.data).map(([name, col]) => [name, col[i]!]))), fit.y, fit.weights, nonlinearNames, fullValues)
    : evaluate(fit.expression, fit.rows.map(i => Object.fromEntries(Object.entries(fit.data).map(([name, col]) => [name, col[i]!]))), fit.y, fit.weights, nonlinearNames, fullValues, "default");
  return { value: fixedValue, objective: full.objective, nuisance, residuals: full.residuals, jacobian: full.jacobian.map(row => [row[fixedIndex]!]), };
}

/** Find one profile endpoint by outward bracketing and safeguarded Newton refinement. */
function profileEndpoint(fit: NlsResult, index: number, direction: -1 | 1, target: number): number {
  const names = fit.parameterNames.filter(name => name !== ".lin");
  const estimate = fit.coefficients[names[index]!]!;
  const seIndex = fit.parameterNames.indexOf(names[index]!);
  const se = Math.sqrt(fit.covariance[seIndex]![seIndex]!);
  if (!(se > 0) || !Number.isFinite(se)) return Number.NaN;
  const nuisanceNames = names.filter((_, i) => i !== index);
  let warm = nuisanceNames.map(name => fit.coefficients[name]!);
  const center: ProfilePoint = { value: estimate, objective: fit.deviance, nuisance: warm, residuals: fit.residuals, jacobian: [] };
  let inside = center, outside: ProfilePoint | undefined;
  let distance = Math.max(se, Math.abs(estimate) * 1e-4, 1e-8);
  const evaluateAt = (value: number, start: number[]) => profilePoint(fit, index, value, start);
  for (let k = 0; k < 60; k++) {
    const candidateValue = estimate + direction * distance;
    try {
      const candidate = evaluateAt(candidateValue, inside.nuisance);
      if (candidate.objective >= target) { outside = candidate; break; }
      inside = candidate;
      distance *= 1.8;
    } catch {
      distance *= 0.5;
    }
  }
  if (!outside) return Number.NaN;
  let innerT = 0, outerT = direction * (outside.value - estimate);
  let current = outside;
  for (let iteration = 0; iteration < 100; iteration++) {
    const f = current.objective - target;
    const t = direction * (current.value - estimate);
    if (Math.abs(f) <= 2e-11 * Math.max(1, target)
      || Math.abs(outerT - innerT) <= 2e-10 * Math.max(1, Math.abs(estimate))) break;
    const derivative = current.residuals.reduce((sum, residual, i) =>
      sum - 2 * fit.weights[i]! * residual * current.jacobian[i]![0]!, 0) * direction;
    let nextT = t - f / derivative;
    if (!Number.isFinite(nextT) || !(nextT > innerT && nextT < outerT)) nextT = (innerT + outerT) / 2;
    const nextValue = estimate + direction * nextT;
    try {
      const trial = evaluateAt(nextValue, current.nuisance);
      if (trial.objective >= target) outerT = nextT;
      else innerT = nextT;
      current = trial;
    } catch {
      outerT = nextT;
      current = evaluateAt(estimate + direction * ((innerT + outerT) / 2), current.nuisance);
    }
  }
  const endpoint = estimate + direction * ((innerT + outerT) / 2);
  // Independently verify the endpoint from the original fitted nuisance values.
  const checked = evaluateAt(endpoint, nuisanceNames.map(name => fit.coefficients[name]!));
  if (Math.abs(checked.objective - target) > 2e-7 * Math.max(1, target)) return Number.NaN;
  return endpoint;
}

/**
 * Wald or profile confidence intervals for nonlinear parameters. Equivalent to R's `confint.nls()`.
 *
 * @param fit A fitted nonlinear model.
 * @param options Interval method, confidence level, and parameter names.
 * @returns A two-column confidence interval matrix.
 *
 * @example
 * ```ts
 * const data = { conc: [0.02, 0.06, 0.11, 0.22, 0.56, 1.1], rate: [76, 97, 123, 159, 191, 207] };
 * const fit = nls("rate ~ Vm * conc / (K + conc)", data, { start: { Vm: 200, K: 0.05 } });
 * nlsConfint(fit, { method: "wald", level: 0.95 });
 * ```
 *
 * @category Regression
 */
export function nlsConfint(fit: NlsResult, options: NlsConfintOptions = {}): NlsConfintResult {
  const method = options.method ?? "profile", level = options.level ?? 0.95;
  if (!(level > 0 && level < 1) || !Number.isFinite(level)) throw new RangeError("level must be between 0 and 1");
  if (method !== "profile" && method !== "wald") throw new Error("method must be 'profile' or 'wald'");
  const names = options.parm ? [...options.parm] : fit.parameterNames.filter(name => method === "wald" || name !== ".lin");
  const warnings: string[] = [];
  const values: [number, number][] = [];
  const tcrit = qt1((1 + level) / 2, fit.dfResidual, true, false);
  const fcrit = qf1(level, 1, fit.dfResidual, true, false);
  const target = fit.deviance + fit.sigma * fit.sigma * fcrit;
  for (const name of names) {
    const index = fit.parameterNames.indexOf(name);
    if (index < 0) throw new Error("unknown parameter: " + name);
    const estimate = fit.coefficients[name]!;
    const se = Math.sqrt(fit.covariance[index]![index]!);
    if (method === "wald" || fit.exactFit) {
      values.push([estimate - tcrit * se, estimate + tcrit * se]);
      if (fit.exactFit) warnings.push("confidence intervals are unavailable for an exact fit");
    } else {
      const profileIndex = fit.parameterNames.filter(parameter => parameter !== ".lin").indexOf(name);
      if (profileIndex < 0) {
        values.push([Number.NaN, Number.NaN]);
        warnings.push("profile confidence limits are unavailable for parameter '" + name + "'");
      } else {
        const lower = profileEndpoint(fit, profileIndex, -1, target);
        const upper = profileEndpoint(fit, profileIndex, 1, target);
        values.push([lower, upper]);
        if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
          warnings.push("profile confidence limit could not be found for '" + name + "'");
        }
      }
    }
  }
  const percent = (100 * (1 - level) / 2);
  const cols: [string, string] = method === "wald"
    ? [String(Number(percent.toPrecision(12))) + " %", String(Number((100 - percent).toPrecision(12))) + " %"]
    : [String(Number(percent.toPrecision(12))) + "%", String(Number((100 - percent).toPrecision(12))) + "%"];
  return reported("nlsConfint", { rows: names, cols, values, warnings: [...new Set(warnings)] }, fit);
}

/**
 * Analysis of variance for nested nonlinear least-squares fits. Equivalent to R's `anova.nls()`.
 *
 * @param fits Two or more nested fits to the same observations.
 * @returns The sequential F-test table.
 *
 * @example
 * ```ts
 * const data = { x: [1, 2, 3, 4, 5], y: [2, 3, 5, 7, 8] };
 * const small = nls("y ~ a * x", data, { start: { a: 1 } });
 * const large = nls("y ~ a * x + b", data, { start: { a: 1, b: 0 } });
 * nlsAnova(small, large);
 * ```
 *
 * @category Regression
 */
export function nlsAnova(...fits: NlsResult[]): NlsAnovaResult {
  if (fits.length < 2) throw new Error("nlsAnova requires at least two fitted models");
  const warnings = [...new Set(fits.flatMap(fit => fit.warnings))];
  for (let i = 1; i < fits.length; i++) {
    const a = fits[i - 1]!, b = fits[i]!;
    if (a.response !== b.response || a.rows.length !== b.rows.length
      || a.rows.some((row, j) => row !== b.rows[j])
      || a.weights.length !== b.weights.length || a.weights.some((w, j) => w !== b.weights[j])) {
      throw new Error("models were not all fitted to the same observations and weights");
    }
    if (!a.parameterNames.every(name => b.parameterNames.includes(name))) throw new Error("models are not nested");
  }
  const table: NlsAnovaResult["table"] = {
    Model: fits.map(f => f.formula),
    "Res.Df": fits.map(f => f.dfResidual),
    "Res.Sum Sq": fits.map(f => f.deviance),
    Df: ["NA"], "Sum Sq": ["NA"], "F value": ["NA"], "Pr(>F)": ["NA"],
  };
  for (let i = 1; i < fits.length; i++) {
    const a = fits[i - 1]!, b = fits[i]!;
    const df = a.dfResidual - b.dfResidual;
    if (df <= 0) throw new Error("models are not nested in increasing parameter dimension");
    const sumSq = a.deviance - b.deviance;
    const f = (sumSq / df) / (b.deviance / b.dfResidual);
    table.Df.push(df); table["Sum Sq"].push(sumSq); table["F value"].push(f);
    table["Pr(>F)"].push(pf1(f, df, b.dfResidual, false, false));
  }
  return reported("nlsAnova", { table, warnings }, ...fits);
}
