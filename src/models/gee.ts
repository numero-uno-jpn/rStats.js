// Generalized estimating equations from Liang and Zeger (1986), Prentice (1988),
// Halekoh, Højsgaard and Yan (2006), and the public-output specification in oracle/gee-behaviour.md.
// No geepack or R implementation code is used.

import { pnorm } from "../distributions/normal.js";
import { pchisq } from "../distributions/chisq.js";
import { checkOptions } from "../internal/checkOptions.js";
import { reported, Warnings, withWarnings, unreported } from "../internal/warnings.js";
import { glm } from "./glm.js";
import { makeFamily, type GlmFamilyName, type GlmFamilySpec, type GlmLink, type Family } from "./glmFamily.js";
import { design } from "./modelMatrix.js";
import { parseFormula } from "./formula.js";
import type { DataFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";

/** Working-correlation structures supported by geeglm.
 * @category Regression
 */
/**
 * Working correlation structures supported by a GEE fit.
 * @category Regression
 */
export type GeeCorrelation = "independence" | "exchangeable" | "ar1" | "unstructured" | "userdefined" | "fixed";

/** Cluster identifiers may be numeric, character, or logical.
 * @category Regression
 */
export type GeeId = readonly (number | string | boolean)[];

/** Coefficient covariance estimators.
 * @category Regression
 */
export type GeeStdErr = "san.se";

/** Options for a marginal generalized estimating equation fit.
 * @category Regression
 */
export interface GeeOptions {
  /** Cluster identifier column or values. */
  id: string | GeeId;
  /** Within-cluster observation order or wave values. */
  waves?: string | Sample;
  /** Response distribution used by the estimating equations. */
  family?: GlmFamilyName | GlmFamilySpec;
  /** Link function for the response mean. */
  link?: GlmLink;
  /** Working correlation structure. */
  corstr?: GeeCorrelation;
  /** Standard-error estimator requested for the coefficient covariance. */
  "std.err"?: GeeStdErr;
  /** User-supplied or fixed pairwise working-correlation values. */
  zcor?: readonly (readonly number[])[] | Sample;
  /** Prior observation weights. */
  weights?: string | Sample;
  /** Known contribution to the linear predictor. */
  offset?: string | Sample;
  /** Whether to hold the scale parameter fixed at scale.value. */
  "scale.fix"?: boolean;
  /** Fixed scale parameter value when scale.fix is enabled. */
  "scale.value"?: number;
  /** Convergence tolerance for coefficient updates. */
  epsilon?: number;
  /** Maximum number of fitting iterations. */
  maxit?: number;
}

interface GeeOffsetTerm { variable: string; log: boolean }

function splitOffsets(formula: string): { meanFormula: string; terms: GeeOffsetTerm[] } {
  const pattern = /offset\s*\(\s*(?:log\s*\(\s*([A-Za-z_.][A-Za-z0-9_.]*)\s*\)|([A-Za-z_.][A-Za-z0-9_.]*))\s*\)/g;
  const terms: GeeOffsetTerm[] = [];
  for (const match of formula.matchAll(pattern)) {
    const logVariable = match[1];
    const variable = logVariable ?? match[2];
    if (variable === undefined) continue;
    terms.push({ variable, log: logVariable !== undefined });
  }
  let meanFormula = formula.replace(pattern, "");
  meanFormula = meanFormula.replace(/~\s*\+/g, "~ ").replace(/\+\s*\+/g, "+").replace(/\+\s*$/g, "").trim();
  if (/~\s*$/.test(meanFormula)) meanFormula += " 1";
  if (terms.length > 0 && meanFormula.endsWith("~")) meanFormula += " 1";
  return { meanFormula, terms };
}

/** A fitted generalized estimating equation model.
 * @category Regression
 */
export interface GeeResult {
  /** Estimated marginal-model coefficients. */
  coefficients: number[];
  /** Fitted marginal means for the original input rows. */
  fittedValues: number[];
  /** Fitted linear predictors for the original input rows. */
  linearPredictors: number[];
  /** Response residuals for the original input rows. */
  residuals: number[];
  /** Pearson residuals for the original input rows. */
  pearsonResiduals: number[];
  /** Robust sandwich covariance matrix of the coefficient estimates. */
  covariance: number[][];
  /** Model-based covariance matrix under the working correlation. */
  modelCovariance: number[][];
  /** Model-based covariance matrix under independence working correlation. */
  independenceCovariance: number[][];
  /** Estimated working-correlation parameter values. */
  alpha: number[];
  /** Scale or dispersion parameter. */
  scale: number;
  /** Number of coefficient-update iterations performed. */
  iterations: number;
  /** Whether the coefficient iteration met its convergence criterion. */
  converged: boolean;
  /** Response distribution used by the estimating equations. */
  family: GlmFamilyName;
  /** Link function for the response mean. */
  link: string;
  /** Working correlation structure. */
  corstr: GeeCorrelation;
  /** Standard-error estimator used by the fit. */
  stdErr: GeeStdErr;
  /** Names of the model-matrix columns. */
  columnNames: string[];
  /** Original data-row indices retained in the model frame. */
  rows: number[];
  /** Cluster identifiers corresponding to retained rows. */
  clusterIds: (number | string | boolean)[];
  /** Within-cluster observation order or wave values. */
  waves: number[];
  /** Warnings recorded while fitting or summarizing the model. */
  warnings: string[];
  /** Model-frame, design, and cluster information retained for downstream methods. */
  model: {
    /** Original model formula. */
    formula: string;
    /** Mean-model formula after offset terms are separated. */
    meanFormula: string;
    /** Offset terms extracted from the formula. */
    offsetTerms: GeeOffsetTerm[];
    /** Name of the data column supplied through the offset option, if any. */
    offsetOptionColumn: string | undefined;
    /** Whether an offset was supplied outside the formula. */
    hasExternalOffset: boolean;
    /** Model-matrix column to formula-term assignment. */
    termAssign: number[];
    /** Labels of the formula terms. */
    termLabels: string[];
    /** Name of the response variable. */
    responseVariable: string;
    /** Whether the mean model includes an intercept. */
    intercept: boolean;
    /** Model matrix for retained observations. */
    x: number[][];
    /** Response values for retained observations. */
    y: number[];
    /** Cluster identifiers for retained observations. */
    ids: (number | string | boolean)[];
    /** Within-cluster observation order or wave values. */
    waves: number[];
    /** Prior observation weights. */
    weights: number[];
    /** Known contribution to the linear predictor. */
    offset: number[];
    /** Response distribution used by the estimating equations. */
    family: GlmFamilyName | GlmFamilySpec;
    /** Link function for the response mean. */
    link: GlmLink | undefined;
    /** Working correlation structure. */
    corstr: GeeCorrelation;
    /** Whether the scale parameter is fixed. */
    scaleFix: boolean;
    /** Scale value used when scale is fixed. */
    scaleValue: number;
    /** Convergence tolerance for coefficient updates. */
    epsilon: number;
    /** Maximum number of fitting iterations. */
    maxit: number;
    /** User-supplied or fixed pairwise working-correlation values. */
    zcor: number[][] | undefined;
    /** Data frame retained for prediction and model comparisons. */
    data: DataFrame;
  };
}

/** Coefficient and nuisance-parameter summary of a GEE fit.
 * @category Regression
 */
export interface GeeSummaryResult {
  /** Original data-row indices retained in the model frame. */
  rows: string[];
  /** Column labels for the returned summary table. */
  columns: ["Estimate", "Std. Error", "Wald", "Pr(>|W|)"];
  /** Numeric values in the returned summary table. */
  values: number[][];
  /** Scale or dispersion parameter. */
  scale: number;
  /** Estimated working-correlation summary. */
  correlation: {
    /** Labels for the reported working-correlation rows. */
    rows: string[];
    /** Estimated working-correlation values. */
    estimate: number[];
  };
  /** Warnings recorded while fitting or summarizing the model. */
  warnings: string[];
}

/** A GEE coefficient covariance matrix.
 * @category Regression
 */
export interface GeeVcovResult {
  /** Original data-row indices retained in the model frame. */
  rows: string[];
  /** Column labels for the returned summary table. */
  columns: string[];
  /** Numeric values in the returned summary table. */
  values: number[][];
}

/** Prediction options for a GEE fit.
 * @category Regression
 */
export interface GeePredictOptions {
  /** Optional data frame used to construct predictions. */
  newdata?: DataFrame;
  /** Prediction scale or covariance selection. */
  type?: "link" | "response";
  /** Offset values for new observations. */
  newoffset?: Sample;
}

/** Wald comparison table for GEE models.
 * @category Regression
 */
export interface GeeAnovaResult {
  /** Original data-row indices retained in the model frame. */
  rows: string[];
  /** Column labels for the returned summary table. */
  columns: ["Df", "X2", "Pr(>Chi)"];
  /** Numeric values in the returned summary table. */
  values: number[][];
}

function zeros(n: number, m: number): number[][] {
  return Array.from({ length: n }, () => new Array<number>(m).fill(0));
}

function identity(n: number): number[][] {
  const a = zeros(n, n);
  for (let i = 0; i < n; i++) a[i]![i] = 1;
  return a;
}

function transpose(a: readonly (readonly number[])[]): number[][] {
  if (a.length === 0) return [];
  return Array.from({ length: a[0]!.length }, (_, j) => a.map((r) => r[j]!));
}

function multiply(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): number[][] {
  const n = a.length, k = n ? a[0]!.length : 0, m = b.length ? b[0]!.length : 0;
  if (k !== b.length) throw new RangeError("non-conformable matrices");
  const out = zeros(n, m);
  for (let i = 0; i < n; i++) for (let q = 0; q < k; q++) {
    const v = a[i]![q]!;
    for (let j = 0; j < m; j++) out[i]![j] = out[i]![j]! + v * b[q]![j]!;
  }
  return out;
}

function inverse(input: readonly (readonly number[])[]): number[][] {
  const n = input.length;
  if (n === 0 || input.some((r) => r.length !== n)) throw new RangeError("the matrix must be square and nonempty");
  const eye = identity(n);
  const a = input.map((r, i) => [...r, ...eye[i]!]);
  for (let j = 0; j < n; j++) {
    let pivot = j;
    for (let i = j + 1; i < n; i++) if (Math.abs(a[i]![j]!) > Math.abs(a[pivot]![j]!)) pivot = i;
    let rowMax = 0;
    for (let k = 0; k < n; k++) rowMax = Math.max(rowMax, Math.abs(a[pivot]![k]!));
    if (!(Math.abs(a[pivot]![j]!) > Number.EPSILON * Math.max(1, rowMax))) throw new Error("singular working information matrix");
    [a[j], a[pivot]] = [a[pivot]!, a[j]!];
    const d = a[j]![j]!;
    for (let k = 0; k < 2 * n; k++) a[j]![k] = a[j]![k]! / d;
    for (let i = 0; i < n; i++) if (i !== j) {
      const f = a[i]![j]!;
      for (let k = 0; k < 2 * n; k++) a[i]![k] = a[i]![k]! - f * a[j]![k]!;
    }
  }
  return a.map((r) => r.slice(n));
}

function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

function solve(a: readonly (readonly number[])[], b: readonly number[]): number[] {
  return multiply(inverse(a), b.map((v) => [v])).map((r) => r[0]!);
}

function getColumn(data: DataFrame, name: string): readonly (number | string | boolean | null)[] {
  const col = data[name];
  if (col === undefined || typeof col === "string") throw new RangeError("object '" + name + "' not found");
  return Array.from(col);
}

function vector(value: string | Sample | undefined, data: DataFrame, rows: readonly number[], n: number, fallback: number, label: string): number[] {
  if (value === undefined) return rows.map(() => fallback);
  const raw: readonly unknown[] = typeof value === "string" ? getColumn(data, value) : Array.from(value);
  if (raw.length !== n) throw new RangeError("variable lengths differ (found for '" + label + "')");
  return rows.map((i) => {
    const v = raw[i];
    if (typeof v !== "number" || !Number.isFinite(v)) throw new RangeError("'" + label + "' must contain finite numbers");
    return v;
  });
}

function clusterVector(value: string | GeeId, data: DataFrame, rows: readonly number[], n: number): (number | string | boolean)[] {
  const raw: readonly unknown[] = typeof value === "string" ? getColumn(data, value) : Array.from(value);
  if (raw.length !== n) throw new RangeError("variable lengths differ (found for 'id')");
  return rows.map((i) => {
    const v = raw[i];
    if ((typeof v !== "number" && typeof v !== "string" && typeof v !== "boolean") || v === null ||
      (typeof v === "number" && !Number.isFinite(v))) throw new RangeError("missing or non-finite cluster id");
    return v;
  });
}

function groups(ids: readonly (number | string | boolean)[]): number[][] {
  const map = new Map<string, number>();
  const out: number[][] = [];
  for (let i = 0; i < ids.length; i++) {
    const key = typeof ids[i] + ":" + String(ids[i]);
    let k = map.get(key);
    if (k === undefined) {
      k = out.length;
      map.set(key, k);
      out.push([]);
    }
    out[k]!.push(i);
  }
  return out;
}

function correlationMatrix(
  size: number, structure: GeeCorrelation, alpha: readonly number[], waves: readonly number[],
  zcor: readonly (readonly number[])[] | undefined, pairOffset: number,
): number[][] {
  const r = identity(size);
  let pair = 0;
  for (let j = 0; j < size; j++) for (let k = 0; k < j; k++) {
    let v = 0;
    if (structure === "exchangeable") v = alpha[0] ?? 0;
    else if (structure === "ar1") v = (alpha[0] ?? 0) ** Math.abs(waves[j]! - waves[k]!);
    else if (structure === "unstructured") v = alpha[pair] ?? 0;
    else if (structure === "userdefined") v = dot(zcor?.[pairOffset + pair] ?? [], alpha);
    else if (structure === "fixed") v = zcor?.[pairOffset + pair]?.[0] ?? 0;
    r[j]![k] = v;
    r[k]![j] = v;
    pair++;
  }
  return r;
}

function pairMoments(
  residuals: readonly number[], clusterGroups: readonly (readonly number[])[], waves: readonly number[],
  structure: GeeCorrelation, scale: number, zcor: readonly (readonly number[])[] | undefined,
): number[] {
  if (structure === "exchangeable") {
    let total = 0, count = 0;
    for (const g of clusterGroups) for (let j = 0; j < g.length; j++) for (let k = 0; k < j; k++) {
      total += residuals[g[j]!]! * residuals[g[k]!]! / scale;
      count++;
    }
    return [count ? total / count : 0];
  }
  if (structure === "ar1") {
    const sums = new Map<number, { sum: number; n: number }>();
    for (const g of clusterGroups) for (let j = 0; j < g.length; j++) for (let k = 0; k < j; k++) {
      const lag = Math.abs(waves[g[j]!]! - waves[g[k]!]!);
      if (lag === 0) continue;
      const z = sums.get(lag) ?? { sum: 0, n: 0 };
      z.sum += residuals[g[j]!]! * residuals[g[k]!]! / scale;
      z.n++;
      sums.set(lag, z);
    }
    let best = 0, bestLoss = Infinity;
    for (let t = -0.99; t <= 0.9900001; t += 0.002) {
      let loss = 0;
      for (const [lag, z] of sums) loss += z.n * (z.sum / z.n - t ** lag) ** 2;
      if (loss < bestLoss) { best = t; bestLoss = loss; }
    }
    let lo = Math.max(-0.9999, best - 0.003), hi = Math.min(0.9999, best + 0.003);
    const loss = (t: number) => {
      let v = 0;
      for (const [lag, z] of sums) v += z.n * (z.sum / z.n - t ** lag) ** 2;
      return v;
    };
    for (let i = 0; i < 70; i++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      if (loss(m1) < loss(m2)) hi = m2; else lo = m1;
    }
    return [(lo + hi) / 2];
  }
  if (structure === "unstructured") {
    const sums: number[] = [], counts: number[] = [];
    for (const g of clusterGroups) for (let j = 0; j < g.length; j++) for (let k = 0; k < j; k++) {
      const ix = j * (j - 1) / 2 + k;
      sums[ix] = (sums[ix] ?? 0) + residuals[g[j]!]! * residuals[g[k]!]! / scale;
      counts[ix] = (counts[ix] ?? 0) + 1;
    }
    return sums.map((v, i) => v / counts[i]!);
  }
  if (structure === "userdefined") {
    if (zcor === undefined) throw new TypeError("zcor is required for userdefined correlation");
    const rows: number[][] = [];
    const target: number[] = [];
    let pair = 0;
    for (const g of clusterGroups) for (let j = 0; j < g.length; j++) for (let k = 0; k < j; k++) {
      const designRow = zcor[pair];
      if (designRow === undefined || designRow.length === 0) throw new RangeError("zcor must have one nonempty row per within-cluster pair");
      rows.push(Array.from(designRow));
      target.push(residuals[g[j]!]! * residuals[g[k]!]! / scale);
      pair++;
    }
    if (zcor.length !== rows.length) throw new RangeError("zcor must have one row per within-cluster pair");
    const zt = transpose(rows);
    return solve(multiply(zt, rows), multiply(zt, target.map((v) => [v])).map((r) => r[0]!));
  }
  return [];
}

function evaluate(x: number[][], y: number[], beta: number[], offset: number[], family: Family, weights: number[]) {
  const eta = x.map((row, i) => dot(row, beta) + offset[i]!);
  const mu = eta.map((v) => family.linkinv(v));
  const residuals = y.map((v, i) => v - mu[i]!);
  const pearson = residuals.map((v, i) => v * Math.sqrt(weights[i]!) / Math.sqrt(family.variance(mu[i]!)));
  const derivative = eta.map((v) => family.muEta(v));
  return { eta, mu, residuals, pearson, derivative };
}

function geeStep(
  x: number[][], y: number[], beta: number[], offset: number[], weights: number[], family: Family,
  clusterGroups: number[][], waves: number[], corstr: GeeCorrelation, alpha: number[], scale: number,
  zcor: readonly (readonly number[])[] | undefined,
) {
  const ev = evaluate(x, y, beta, offset, family, weights);
  const p = beta.length, bread = zeros(p, p), meat = zeros(p, p), score = new Array<number>(p).fill(0);
  const clusterScores: number[][] = [];
  const clusterBread: number[][][] = [];
  let pairOffset = 0;
  for (const rows of clusterGroups) {
    const a = rows.map((i) => Math.sqrt(family.variance(ev.mu[i]!) / weights[i]!));
    const R = correlationMatrix(rows.length, corstr, alpha, rows.map((i) => waves[i]!), zcor, pairOffset);
    pairOffset += rows.length * (rows.length - 1) / 2;
    const V = R.map((r, j) => r.map((v, k) => scale * a[j]! * v * a[k]!));
    const Vi = inverse(V);
    const D = rows.map((i) => x[i]!.map((v) => v * ev.derivative[i]!));
    const residual = rows.map((i) => ev.residuals[i]!);
    const ViR = multiply(Vi, residual.map((v) => [v])).map((r) => r[0]!);
    const localScore = multiply(transpose(D), ViR.map((v) => [v])).map((r) => r[0]!);
    for (let j = 0; j < p; j++) score[j]! += localScore[j]!;
    const localBread = multiply(multiply(transpose(D), Vi), D);
    clusterScores.push(localScore);
    clusterBread.push(localBread);
    for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) bread[j]![k] = bread[j]![k]! + localBread[j]![k]!;
    for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) meat[j]![k] = meat[j]![k]! + localScore[j]! * localScore[k]!;
  }
  return { delta: solve(bread, score), bread, meat, clusterScores, clusterBread, eval: ev };
}

/**
 * Options for selecting the covariance matrix returned by geeVcov.
 * @category Regression
 */
export interface GeeVcovOptions {
  /** Covariance matrix to return: robust sandwich or model-based. */
  type?: "robust" | "naive";
}

/**
 * Options for a GEE Wald analysis of variance.
 * @category Regression
 */
export interface GeeAnovaOptions {
  /** Wald test used for the sequential term comparison. */
  test?: "Wald";
}

/**
 * Quasi-likelihood information criteria returned by geeQIC.
 * @category Regression
 */
export interface GeeQICResult {
  /** Quasi-likelihood under the independence model criterion. */
  QIC: number;
  /** Uncorrected quasi-likelihood information criterion. */
  QICu: number;
  /** Quasi-likelihood component. */
  Q: number;
  /** Correlation information criterion. */
  CIC: number;
  /** Number of fitted mean-model parameters. */
  params: number;
  /** Finite-sample corrected QIC. */
  QICC: number;
}

/**
 * Fit a marginal generalized estimating equation model.
 * Equivalent to `geepack::geeglm()` in R.
 * @category Regression
 */
export function geeglm(formula: string, data: DataFrame, options: GeeOptions): GeeResult {
  checkOptions(options, ["id", "waves", "family", "link", "corstr", "std.err", "zcor", "weights", "offset", "scale.fix", "scale.value", "epsilon", "maxit"], "geeglm"); // generated: option-keys.mjs
  if (options.id === undefined) throw new TypeError("id is required");
  const corstr = options.corstr ?? "independence";
  if (!["independence", "exchangeable", "ar1", "unstructured", "userdefined", "fixed"].includes(corstr)) throw new RangeError("unknown working correlation");
  const requestedStdErr = options["std.err"] as string | undefined;
  if (requestedStdErr !== undefined && requestedStdErr !== "san.se")
    throw new RangeError(`std.err = "${requestedStdErr}" is not supported yet; use "san.se"`);
  const stdErr: GeeStdErr = requestedStdErr ?? "san.se";
  const epsilon = options.epsilon ?? 1e-4, maxit = options.maxit ?? 25;
  if (!(epsilon > 0) || !Number.isFinite(epsilon) || !Number.isInteger(maxit) || maxit < 1) throw new RangeError("invalid convergence controls");
  const split = splitOffsets(formula);
  const inputN = Object.values(data)[0]?.length ?? 0;
  const frameData = { ...data } as unknown as Record<string, unknown>;
  const extras = split.terms.map((t) => t.variable);
  const addVectorColumn = (base: string, values: ArrayLike<unknown>) => {
    let name = "__gee_" + base;
    while (name in frameData) name += "_";
    frameData[name] = Array.from(values);
    extras.push(name);
  };
  if (typeof options.id === "string") extras.push(options.id);
  else addVectorColumn("id", options.id);
  if (typeof options.waves === "string") extras.push(options.waves);
  else if (options.waves !== undefined) addVectorColumn("waves", options.waves);
  if (typeof options.weights === "string") extras.push(options.weights);
  if (typeof options.offset === "string") extras.push(options.offset);
  else if (options.offset !== undefined) addVectorColumn("offset", options.offset);
  const d = design(parseFormula(split.meanFormula), frameData as DataFrame, {
    extraVariables: extras, ...(options.weights === undefined ? {} : { weights: options.weights }),
  });
  if (d.y === undefined) throw new TypeError("formula must have a response");
  const rows = d.frame.rows, n = rows.length, p = d.colNames.length;
  if (n === 0 || p === 0) throw new RangeError("no observations or no model columns");
  const ids = clusterVector(options.id, data, rows, inputN);
  let waves = options.waves === undefined ? rows.map((_, i) => i) : vector(options.waves, data, rows, inputN, 0, "waves");
  const weights = d.frame.weights ?? new Array<number>(n).fill(1);
  if (weights.some((v) => v < 0)) throw new RangeError("weights must be nonnegative");
  const offset = vector(options.offset, data, rows, inputN, 0, "offset");
  for (const term of split.terms) {
    const values = vector(term.variable, data, rows, inputN, 0, "offset");
    for (let i = 0; i < offset.length; i++) offset[i] = offset[i]! + (term.log ? Math.log(values[i]!) : values[i]!);
  }
  const clusterGroups = groups(ids);
  if (options.waves === undefined) {
    waves = new Array<number>(n).fill(0);
    for (const g of clusterGroups) for (let j = 0; j < g.length; j++) waves[g[j]!] = j;
  }
  const family = makeFamily(options.family ?? "gaussian", options.link);
  const y = d.y;
  if (y.some((v, i) => !Number.isFinite(v) && weights[i]! > 0)) throw new RangeError("NA/NaN/Inf in 'y'");
  if (weights.some((v) => !Number.isFinite(v))) throw new RangeError("weights must be finite");
  if (weights.every((v) => v === 0)) throw new RangeError("no observations with positive weight");
  if (options.zcor !== undefined) {
    if (!Array.isArray(options.zcor)) throw new TypeError("zcor must be a matrix or numeric vector");
    const raw = options.zcor as readonly unknown[];
    const isVector = raw.every((value) => typeof value === "number");
    const isMatrix = raw.every((row) => Array.isArray(row));
    if (!isVector && !isMatrix) throw new TypeError("zcor must be a matrix or numeric vector");
  }
  if ((corstr === "userdefined" || corstr === "fixed") && options.zcor === undefined) throw new TypeError("zcor is required for userdefined and fixed working correlations");
  let zcor: number[][] | undefined;
  if (options.zcor !== undefined) {
    const rawZcor = Array.from(options.zcor as ArrayLike<unknown>);
    zcor = typeof rawZcor[0] === "number"
      ? rawZcor.map((v) => [v as number])
      : rawZcor.map((r) => Array.from(r as readonly number[]));
  }
  if (zcor?.some((r) => r.some((v) => !Number.isFinite(v)))) throw new RangeError("zcor must contain finite numbers");
  if (zcor !== undefined) {
    let pairCount = 0;
    for (const g of clusterGroups) pairCount += g.length * (g.length - 1) / 2;
    if (zcor.length !== pairCount) throw new RangeError("zcor must have one row per within-cluster pair");
    const columns = zcor[0]?.length ?? 0;
    if (columns === 0 || zcor.some((r) => r.length !== columns)) throw new RangeError("zcor rows must have the same positive number of columns");
    if (corstr === "fixed" && (columns !== 1 || zcor.some((r) => Math.abs(r[0]!) > 1))) {
      throw new RangeError("fixed zcor must be a one-column matrix of correlations in [-1, 1]");
    }
  }
  const warnings = new Warnings();
  return withWarnings(warnings, () => {
    const startFit = unreported(() => glm(d.x, y, {
      family: options.family ?? "gaussian",
      ...(options.link === undefined ? {} : { link: options.link }),
      weights, offset, intercept: false, epsilon, maxit,
    }));
    let beta = startFit.coefficients.slice();
    let scale = options["scale.fix"] ? (options["scale.value"] ?? 1) : 1;
    if (!(scale > 0) || !Number.isFinite(scale)) throw new RangeError("scale.value must be positive and finite");
    let maxPairs = 0;
    for (const g of clusterGroups) maxPairs = Math.max(maxPairs, g.length * (g.length - 1) / 2);
    let alpha: number[] = corstr === "exchangeable" || corstr === "ar1" ? [0] :
      corstr === "unstructured" ? new Array<number>(maxPairs).fill(0) :
      corstr === "userdefined" ? new Array<number>(zcor?.[0]?.length ?? 0).fill(0) : [];
    let bread = identity(p), meat = identity(p), converged = false, iteration = 0;
    for (iteration = 1; iteration <= maxit; iteration++) {
      const step = geeStep(d.x, y, beta, offset, weights, family, clusterGroups, waves, corstr, alpha, scale, zcor);
      const next = beta.map((v, j) => v + step.delta[j]!);
      if (next.some((v) => !Number.isFinite(v))) throw new Error("non-finite coefficient in GEE iteration");
      let diff = 0;
      for (let j = 0; j < p; j++) diff = Math.max(diff, Math.abs(next[j]! - beta[j]!));
      const oldAlpha = alpha.slice();
      const oldScale = scale;
      beta = next;
      bread = step.bread;
      meat = step.meat;
      const ev = evaluate(d.x, y, beta, offset, family, weights);
      if (!options["scale.fix"] && !family.fixedDispersion) scale = ev.pearson.reduce((s, v) => s + v * v, 0) / n;
      if (corstr === "exchangeable" || corstr === "ar1" || corstr === "unstructured" || corstr === "userdefined") {
        alpha = pairMoments(ev.pearson, clusterGroups, waves, corstr, scale, zcor).map((v) => Math.max(-0.99, Math.min(0.99, v)));
      }
      for (let j = 0; j < alpha.length; j++) diff = Math.max(diff, Math.abs(alpha[j]! - (oldAlpha[j] ?? 0)));
      diff = Math.max(diff, Math.abs(scale - oldScale));
      let betaScale = 1;
      for (const v of beta) betaScale = Math.max(betaScale, Math.abs(v));
      if (diff <= epsilon * betaScale) { converged = true; break; }
    }
    if (!converged) warnings.add("geeglm did not converge in " + maxit + " iterations");
    const finalStep = geeStep(d.x, y, beta, offset, weights, family, clusterGroups, waves, corstr, alpha, scale, zcor);
    bread = finalStep.bread;
    meat = finalStep.meat;
    const breadInv = inverse(bread);
    let covariance = multiply(multiply(breadInv, meat), breadInv);
    const modelCovariance = breadInv.map((r) => r.slice());
    const independentStep = geeStep(d.x, y, beta, offset, weights, family, clusterGroups, waves, "independence", [], scale, undefined);
    const independenceCovariance = inverse(independentStep.bread);
    const ev = evaluate(d.x, y, beta, offset, family, weights);
    const fitted = new Array<number>(inputN).fill(NaN), linear = fitted.slice(), residuals = fitted.slice(), pearson = fitted.slice();
    rows.forEach((r, i) => { fitted[r] = ev.mu[i]!; linear[r] = ev.eta[i]!; residuals[r] = ev.residuals[i]!; pearson[r] = ev.pearson[i]!; });
    const result: GeeResult = {
      coefficients: beta, fittedValues: fitted, linearPredictors: linear, residuals, pearsonResiduals: pearson,
      covariance, modelCovariance, independenceCovariance, alpha, scale, iterations: iteration, converged, family: family.family,
      link: family.name, corstr, stdErr, columnNames: d.colNames, rows, clusterIds: ids, waves,
      warnings: warnings.list.slice(),
      model: { formula, meanFormula: split.meanFormula, offsetTerms: split.terms,
        offsetOptionColumn: typeof options.offset === "string" ? options.offset : undefined,
        hasExternalOffset: options.offset !== undefined, termAssign: d.assign.slice(),
        termLabels: d.terms.termLabels.slice(), responseVariable: d.terms.variables[d.terms.response]!,
        intercept: d.terms.intercept, x: d.x, y, ids, waves, weights, offset, family: options.family ?? "gaussian",
        link: options.link, corstr, scaleFix: options["scale.fix"] ?? false, scaleValue: options["scale.value"] ?? 1, epsilon, maxit,
        zcor, data },
    };
    return reported("geeglm", result);
  });
}

/**
 * Return robust or model-based coefficient covariance.
 * Equivalent to R's `vcov()`.
 * @category Regression
 */
export function geeVcov(fit: GeeResult, options: GeeVcovOptions = {}): GeeVcovResult {
  checkOptions(options, ["type"], "geeVcov"); // generated: option-keys.mjs
  const a = options.type === "naive" ? fit.modelCovariance : fit.covariance;
  return { rows: fit.columnNames, columns: fit.columnNames, values: a.map((r) => r.slice()) };
}

/**
 * Summarize the coefficient estimates of a GEE fit.
 * Equivalent to R's `summary.geeglm()`.
 * @category Regression
 */
export function geeSummary(fit: GeeResult, options: Record<string, never> = {}): GeeSummaryResult {
  checkOptions(options, [], "geeSummary"); // generated: option-keys.mjs
  const values = fit.coefficients.map((estimate, i) => {
    const se = Math.sqrt(fit.covariance[i]![i]!);
    const z = estimate / se;
    return [estimate, se, z * z, 2 * (1 - (pnorm(Math.abs(z)) as number))];
  });
  return reported("geeSummary", { rows: fit.columnNames, columns: ["Estimate", "Std. Error", "Wald", "Pr(>|W|)"],
    values, scale: fit.scale, correlation: { rows: fit.alpha.map((_, i) => "alpha" + (i + 1)), estimate: fit.alpha.slice() },
    warnings: fit.warnings.slice() }, fit);
}

/**
 * Predict marginal means on the link or response scale.
 * Equivalent to R's `predict.geeglm()`.
 * @category Regression
 */
export function geePredict(fit: GeeResult, options: GeePredictOptions = {}): number[] {
  checkOptions(options, ["newdata", "type", "newoffset"], "geePredict"); // generated: option-keys.mjs
  if (options.newdata === undefined && options.newoffset === undefined) {
    return options.type === "response" ? fit.fittedValues.slice() : fit.linearPredictors.slice();
  }
  const newdata = options.newdata ?? fit.model.data;
  const predictionData = { ...newdata } as unknown as Record<string, unknown>;
  const predictionLength = Object.values(newdata)[0]?.length ?? 0;
  if (!(fit.model.responseVariable in predictionData)) predictionData[fit.model.responseVariable] = new Array<number>(predictionLength).fill(0);
  const d = design(parseFormula(fit.model.meanFormula), predictionData as DataFrame, {
    extraVariables: [...fit.model.offsetTerms.map((t) => t.variable), ...(fit.model.offsetOptionColumn === undefined ? [] : [fit.model.offsetOptionColumn])],
  });
  const family = makeFamily(fit.model.family, fit.model.link);
  const n = d.x.length;
  const offset = options.newoffset === undefined ? new Array<number>(n).fill(0) : Array.from(options.newoffset);
  if (offset.length !== n) throw new RangeError("newoffset must have one value per retained row");
  for (const term of fit.model.offsetTerms) {
    const raw = getColumn(predictionData as DataFrame, term.variable);
    for (let i = 0; i < n; i++) {
      const v = raw[d.frame.rows[i]!];
      if (typeof v !== "number" || !Number.isFinite(v)) throw new RangeError("offset variable must contain finite numbers");
      offset[i] = offset[i]! + (term.log ? Math.log(v) : v);
    }
  }
  if (fit.model.offsetOptionColumn !== undefined) {
    const raw = getColumn(predictionData as DataFrame, fit.model.offsetOptionColumn);
    for (let i = 0; i < n; i++) {
      const v = raw[d.frame.rows[i]!];
      if (typeof v !== "number" || !Number.isFinite(v)) throw new RangeError("offset variable must contain finite numbers");
      offset[i] = offset[i]! + v;
    }
  } else if (fit.model.hasExternalOffset && options.newoffset === undefined) {
    throw new RangeError("newoffset is required when the fit used a vector offset");
  }
  const eta = d.x.map((r, i) => dot(r, fit.coefficients) + offset[i]!);
  return options.type === "response" ? eta.map((v) => family.linkinv(v)) : eta;
}

function isGeeResult(value: unknown): value is GeeResult {
  return typeof value === "object" && value !== null &&
    Array.isArray((value as GeeResult).coefficients) && Array.isArray((value as GeeResult).covariance);
}

function waldBlock(fit: GeeResult, indices: readonly number[]): { df: number; statistic: number; p: number } {
  if (indices.length === 0) throw new RangeError("the model comparison adds no coefficients");
  const beta = indices.map((i) => fit.coefficients[i]!);
  const covariance = indices.map((i) => indices.map((j) => fit.covariance[i]![j]!));
  const statistic = dot(beta, multiply(inverse(covariance), beta.map((v) => [v])).map((r) => r[0]!));
  return { df: indices.length, statistic, p: pchisq(statistic, indices.length, { lowerTail: false }) as number };
}

function refitForAnova(fit: GeeResult, formula: string): GeeResult {
  const rows = fit.rows;
  const columns = Object.entries(fit.model.data).map(([name, column]) => [name, Array.from(column as ArrayLike<unknown>)] as const);
  const data = Object.fromEntries(columns.map(([name, column]) => [name, rows.map((r) => column[r])])) as DataFrame;
  const options: GeeOptions = {
    id: fit.model.ids, waves: fit.model.waves, family: fit.model.family,
    ...(fit.model.link === undefined ? {} : { link: fit.model.link }),
    corstr: fit.model.corstr, "std.err": "san.se", weights: fit.model.weights, offset: fit.model.offset,
    "scale.fix": fit.model.scaleFix, "scale.value": fit.model.scaleValue, epsilon: fit.model.epsilon, maxit: fit.model.maxit,
    ...(fit.model.zcor === undefined ? {} : { zcor: fit.model.zcor }),
  };
  return geeglm(formula, data, options);
}

/**
 * Compare GEE terms or nested models using Wald tests.
 * Equivalent to R's `anova()`.
 * @category Regression
 */
export function geeAnova(fit: GeeResult, options: GeeAnovaOptions | GeeResult = {}): GeeAnovaResult {
  if (isGeeResult(options)) {
    const reduced = options;
    if (fit.rows.length !== reduced.rows.length || fit.rows.some((r, i) => r !== reduced.rows[i]) ||
      fit.clusterIds.length !== reduced.clusterIds.length ||
      fit.clusterIds.some((v, i) => v !== reduced.clusterIds[i])) {
      throw new RangeError("models must use the same observations and cluster identifiers");
    }
    const oldTerms = reduced.model.termLabels;
    if (oldTerms.length >= fit.model.termLabels.length ||
      oldTerms.some((term, i) => fit.model.termLabels[i] !== term)) {
      throw new RangeError("the second model must be a nested prefix of the first model");
    }
    const indices = fit.model.termAssign.map((a, i) => a > oldTerms.length ? i : -1).filter((i) => i >= 0);
    const test = waldBlock(fit, indices);
    return reported("geeAnova", { rows: [fit.model.formula], columns: ["Df", "X2", "Pr(>Chi)"] as ["Df", "X2", "Pr(>Chi)"],
      values: [[test.df, test.statistic, test.p]], warnings: [] }, fit, reduced);
  }
  checkOptions(options, ["test"], "geeAnova"); // generated: option-keys.mjs
  if (options.test !== undefined && options.test !== "Wald") throw new RangeError("only Wald tests are available");
  const labels = fit.model.termLabels;
  if (labels.length === 0) {
    const test = waldBlock(fit, fit.coefficients.map((_, i) => i));
    return reported("geeAnova", { rows: ["Model"], columns: ["Df", "X2", "Pr(>Chi)"] as ["Df", "X2", "Pr(>Chi)"],
      values: [[test.df, test.statistic, test.p]], warnings: [] }, fit);
  }
  const rows: string[] = [], values: number[][] = [];
  for (let j = 0; j < labels.length; j++) {
    const prefix = labels.slice(0, j + 1);
    const rhs = (fit.model.intercept ? "" : "0 + ") + prefix.join(" + ");
    const formula = fit.model.responseVariable + " ~ " + rhs;
    const prefixFit = j === labels.length - 1 ? fit : refitForAnova(fit, formula);
    const indices = prefixFit.model.termAssign.map((a, i) => a === j + 1 ? i : -1).filter((i) => i >= 0);
    const test = waldBlock(prefixFit, indices);
    rows.push(labels[j]!);
    values.push([test.df, test.statistic, test.p]);
  }
  return reported("geeAnova", { rows, columns: ["Df", "X2", "Pr(>Chi)"] as ["Df", "X2", "Pr(>Chi)"], values, warnings: [] }, fit);
}

/**
 * Calculate quasi-likelihood information criteria for a GEE fit (Pan, 2001).
 * Equivalent to `geepack::QIC()` in R.
 * @category Regression
 */
export function geeQIC(fit: GeeResult): GeeQICResult {
  const family = makeFamily(fit.model.family, fit.model.link);
  let q = 0;
  for (let i = 0; i < fit.model.y.length; i++) {
    const y = fit.model.y[i]!, mu = fit.fittedValues[fit.rows[i]!]!, w = fit.model.weights[i]!;
    if (family.family === "gaussian") q -= 0.5 * w * (y - mu) ** 2 / fit.scale;
    else if (family.family === "binomial") q += w * (y * Math.log(mu) + (1 - y) * Math.log(1 - mu));
    else if (family.family === "poisson") q += w * (y * Math.log(mu) - mu);
    else if (family.family === "Gamma") q += w * (-y / mu - Math.log(mu));
  }
  const p = fit.coefficients.length;
  const cicMatrix = multiply(fit.independenceCovariance, inverse(fit.covariance));
  let cic = 0;
  for (let i = 0; i < cicMatrix.length; i++) cic += cicMatrix[i]![i]!;
  const qic = -2 * q + 2 * cic;
  const qicu = -2 * q + 2 * p;
  const k = new Set(fit.clusterIds.map((v) => String(v))).size;
  return { QIC: qic, QICu: qicu, Q: q, CIC: cic, params: p, QICC: k > p + 1 ? qic + 2 * p * (p + 1) / (k - p - 1) : NaN };
}
