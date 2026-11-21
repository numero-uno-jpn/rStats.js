// Generalized estimating equations from Liang and Zeger (1986), Prentice (1988),
// Halekoh, Højsgaard and Yan (2006), and the public-output specification in oracle/gee-behaviour.md.
// No geepack or R implementation code is used.

import { pnorm } from "../distributions/normal.js";
import { pchisq } from "../distributions/chisq.js";
import { checkOptions } from "../internal/checkOptions.js";
import { reported, Warnings, withWarnings } from "../internal/warnings.js";
import { makeFamily, type GlmFamilyName, type GlmFamilySpec, type GlmLink, type Family } from "./glmFamily.js";
import { design } from "./modelMatrix.js";
import { parseFormula } from "./formula.js";
import type { DataFrame } from "./modelFrame.js";
import type { Sample } from "../htest/types.js";

const GEE_KEYS = ["id", "waves", "family", "link", "corstr", "std.err", "zcor", "weights", "offset", "scale.fix", "scale.value", "epsilon", "maxit"] as const;
const GEE_SUMMARY_KEYS = [] as const;
const GEE_PREDICT_KEYS = ["newdata", "type", "newoffset"] as const;
const GEE_ANOVA_KEYS = ["test"] as const;

export type GeeCorrelation = "independence" | "exchangeable" | "ar1" | "unstructured" | "userdefined" | "fixed";
export type GeeStdErr = "san.se" | "jack" | "j1s" | "fij";

export interface GeeOptions {
  id: string | Sample;
  waves?: string | Sample;
  family?: GlmFamilyName | GlmFamilySpec;
  link?: GlmLink;
  corstr?: GeeCorrelation;
  "std.err"?: GeeStdErr;
  zcor?: readonly (readonly number[])[];
  weights?: string | Sample;
  offset?: string | Sample;
  "scale.fix"?: boolean;
  "scale.value"?: number;
  epsilon?: number;
  maxit?: number;
}

export interface GeeResult {
  coefficients: number[];
  fittedValues: number[];
  linearPredictors: number[];
  residuals: number[];
  pearsonResiduals: number[];
  covariance: number[][];
  modelCovariance: number[][];
  alpha: number[];
  scale: number;
  iterations: number;
  converged: boolean;
  family: GlmFamilyName;
  link: string;
  corstr: GeeCorrelation;
  stdErr: GeeStdErr;
  columnNames: string[];
  rows: number[];
  clusterIds: (number | string | boolean)[];
  waves: number[];
  warnings: string[];
  model: {
    formula: string;
    x: number[][];
    y: number[];
    ids: (number | string | boolean)[];
    waves: number[];
    weights: number[];
    offset: number[];
    family: GlmFamilyName | GlmFamilySpec;
    link: GlmLink | undefined;
    corstr: GeeCorrelation;
    scaleFix: boolean;
    scaleValue: number;
    zcor: number[][] | undefined;
    data: DataFrame;
  };
}

export interface GeeSummaryResult {
  rows: string[];
  columns: ["Estimate", "Std. Error", "Wald", "Pr(>|W|)"];
  values: number[][];
  scale: number;
  correlation: { rows: string[]; estimate: number[] };
  warnings: string[];
}

export interface GeeVcovResult {
  rows: string[];
  columns: string[];
  values: number[][];
}

export interface GeePredictOptions {
  newdata?: DataFrame;
  type?: "link" | "response";
  newoffset?: Sample;
}

export interface GeeAnovaResult {
  rows: string[];
  columns: ["Df", "X2", "Pr(>Chi)"];
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

function clusterVector(value: string | Sample, data: DataFrame, rows: readonly number[], n: number): (number | string | boolean)[] {
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

function correlationMatrix(size: number, structure: GeeCorrelation, alpha: readonly number[], waves: readonly number[]): number[][] {
  const r = identity(size);
  let pair = 0;
  for (let j = 0; j < size; j++) for (let k = 0; k < j; k++) {
    let v = 0;
    if (structure === "exchangeable") v = alpha[0] ?? 0;
    else if (structure === "ar1") v = (alpha[0] ?? 0) ** Math.abs(waves[j]! - waves[k]!);
    else if (structure === "unstructured") v = alpha[pair] ?? 0;
    r[j]![k] = v;
    r[k]![j] = v;
    pair++;
  }
  return r;
}

function pairMoments(residuals: readonly number[], clusterGroups: readonly (readonly number[])[], waves: readonly number[], structure: GeeCorrelation): number[] {
  if (structure === "exchangeable") {
    let total = 0, count = 0;
    for (const g of clusterGroups) for (let j = 0; j < g.length; j++) for (let k = 0; k < j; k++) {
      total += residuals[g[j]!]! * residuals[g[k]!]!;
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
      z.sum += residuals[g[j]!]! * residuals[g[k]!]!;
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
      sums[ix] = (sums[ix] ?? 0) + residuals[g[j]!]! * residuals[g[k]!]!;
      counts[ix] = (counts[ix] ?? 0) + 1;
    }
    return sums.map((v, i) => v / counts[i]!);
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
) {
  const ev = evaluate(x, y, beta, offset, family, weights);
  const p = beta.length, bread = zeros(p, p), meat = zeros(p, p), score = new Array<number>(p).fill(0);
  for (const rows of clusterGroups) {
    const a = rows.map((i) => Math.sqrt(family.variance(ev.mu[i]!) / weights[i]!));
    const R = correlationMatrix(rows.length, corstr, alpha, rows.map((i) => waves[i]!));
    const V = R.map((r, j) => r.map((v, k) => scale * a[j]! * v * a[k]!));
    const Vi = inverse(V);
    const D = rows.map((i) => x[i]!.map((v) => v * ev.derivative[i]!));
    const residual = rows.map((i) => ev.residuals[i]!);
    const ViR = multiply(Vi, residual.map((v) => [v])).map((r) => r[0]!);
    const localScore = multiply(transpose(D), ViR.map((v) => [v])).map((r) => r[0]!);
    for (let j = 0; j < p; j++) score[j]! += localScore[j]!;
    const localBread = multiply(multiply(transpose(D), Vi), D);
    for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) bread[j]![k] = bread[j]![k]! + localBread[j]![k]!;
    for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) meat[j]![k] = meat[j]![k]! + localScore[j]! * localScore[k]!;
  }
  return { delta: solve(bread, score), bread, meat, eval: ev };
}

/** Fit a marginal generalized estimating equation model. */
export function geeglm(formula: string, data: DataFrame, options: GeeOptions): GeeResult {
  checkOptions(options, GEE_KEYS, "geeglm"); // generated: option-keys.mjs
  if (options.id === undefined) throw new TypeError("id is required");
  const corstr = options.corstr ?? "independence";
  if (!["independence", "exchangeable", "ar1", "unstructured", "userdefined", "fixed"].includes(corstr)) throw new RangeError("unknown working correlation");
  const stdErr = options["std.err"] ?? "san.se";
  if (!["san.se", "jack", "j1s", "fij"].includes(stdErr)) throw new RangeError("unknown standard-error estimator");
  const epsilon = options.epsilon ?? 1e-10, maxit = options.maxit ?? 200;
  if (!(epsilon > 0) || !Number.isFinite(epsilon) || !Number.isInteger(maxit) || maxit < 1) throw new RangeError("invalid convergence controls");
  const idName = typeof options.id === "string" ? options.id : undefined;
  const waveName = typeof options.waves === "string" ? options.waves : undefined;
  const extras = [idName, waveName, ...(typeof options.weights === "string" ? [options.weights] : []), ...(typeof options.offset === "string" ? [options.offset] : [])].filter((v): v is string => v !== undefined);
  const d = design(parseFormula(formula), data, { extraVariables: extras });
  if (d.y === undefined) throw new TypeError("formula must have a response");
  const rows = d.frame.rows, n = rows.length, p = d.colNames.length;
  if (n === 0 || p === 0) throw new RangeError("no observations or no model columns");
  const inputN = Object.values(data)[0]?.length ?? n;
  const ids = clusterVector(options.id, data, rows, inputN);
  let waves = options.waves === undefined ? rows.map((_, i) => i) : vector(options.waves, data, rows, inputN, 0, "waves");
  const weights = vector(options.weights, data, rows, inputN, 1, "weights");
  if (weights.some((v) => v < 0)) throw new RangeError("weights must be nonnegative");
  const offset = vector(options.offset, data, rows, inputN, 0, "offset");
  const clusterGroups = groups(ids);
  if (options.waves === undefined) waves = waves.map((_, i) => clusterGroups.find((g) => g.includes(i))?.indexOf(i) ?? 0);
  const family = makeFamily(options.family ?? "gaussian", options.link);
  const y = d.y;
  if (y.some((v, i) => !Number.isFinite(v) && weights[i]! > 0)) throw new RangeError("NA/NaN/Inf in 'y'");
  if (weights.some((v) => !Number.isFinite(v))) throw new RangeError("weights must be finite");
  if (weights.every((v) => v === 0)) throw new RangeError("no observations with positive weight");
  if (options.zcor !== undefined && !Array.isArray(options.zcor)) throw new TypeError("zcor must be a matrix");
  if ((corstr === "userdefined" || corstr === "fixed") && options.zcor === undefined) throw new TypeError("zcor is required for userdefined and fixed working correlations");
  const warnings = new Warnings();
  return withWarnings(warnings, () => {
    const xtx = multiply(transpose(d.x), d.x);
    const xty = multiply(transpose(d.x), y.map((v) => [v])).map((r) => r[0]!);
    let beta = solve(xtx, xty);
    let scale = options["scale.fix"] ? (options["scale.value"] ?? 1) : 1;
    if (!(scale > 0) || !Number.isFinite(scale)) throw new RangeError("scale.value must be positive and finite");
    let alpha: number[] = corstr === "exchangeable" || corstr === "ar1" ? [0] :
      corstr === "unstructured" ? new Array<number>(Math.max(0, ...clusterGroups.map((g) => g.length * (g.length - 1) / 2))).fill(0) : [];
    let bread = identity(p), meat = identity(p), converged = false, iteration = 0;
    for (iteration = 1; iteration <= maxit; iteration++) {
      const step = geeStep(d.x, y, beta, offset, weights, family, clusterGroups, waves, corstr, alpha, scale);
      const next = beta.map((v, j) => v + step.delta[j]!);
      if (next.some((v) => !Number.isFinite(v))) throw new Error("non-finite coefficient in GEE iteration");
      let diff = 0;
      for (let j = 0; j < p; j++) diff = Math.max(diff, Math.abs(next[j]! - beta[j]!));
      beta = next;
      bread = step.bread;
      meat = step.meat;
      const ev = evaluate(d.x, y, beta, offset, family, weights);
      if (!options["scale.fix"] && !family.fixedDispersion) scale = ev.pearson.reduce((s, v) => s + v * v, 0) / n;
      if (corstr === "exchangeable" || corstr === "ar1" || corstr === "unstructured") {
        alpha = pairMoments(ev.pearson, clusterGroups, waves, corstr).map((v) => Math.max(-0.99, Math.min(0.99, v)));
      }
      if (diff <= epsilon * Math.max(1, ...beta.map(Math.abs))) { converged = true; break; }
    }
    if (!converged) warnings.add("geeglm did not converge in " + maxit + " iterations");
    const finalStep = geeStep(d.x, y, beta, offset, weights, family, clusterGroups, waves, corstr, alpha, scale);
    bread = finalStep.bread;
    meat = finalStep.meat;
    const breadInv = inverse(bread);
    const covariance = multiply(multiply(breadInv, meat), breadInv);
    const modelCovariance = breadInv.map((r) => r.map((v) => v * scale));
    const ev = evaluate(d.x, y, beta, offset, family, weights);
    const fitted = new Array<number>(inputN).fill(NaN), linear = fitted.slice(), residuals = fitted.slice(), pearson = fitted.slice();
    rows.forEach((r, i) => { fitted[r] = ev.mu[i]!; linear[r] = ev.eta[i]!; residuals[r] = ev.residuals[i]!; pearson[r] = ev.pearson[i]!; });
    const result: GeeResult = {
      coefficients: beta, fittedValues: fitted, linearPredictors: linear, residuals, pearsonResiduals: pearson,
      covariance, modelCovariance, alpha, scale, iterations: iteration, converged, family: family.family,
      link: family.name, corstr, stdErr, columnNames: d.colNames, rows, clusterIds: ids, waves,
      warnings: warnings.list.slice(),
      model: { formula, x: d.x, y, ids, waves, weights, offset, family: options.family ?? "gaussian",
        link: options.link, corstr, scaleFix: options["scale.fix"] ?? false, scaleValue: options["scale.value"] ?? 1,
        zcor: options.zcor?.map((r) => Array.from(r)), data },
    };
    return reported("geeglm", result);
  });
}

/** Robust or model-based coefficient covariance. */
export function geeVcov(fit: GeeResult, options: { type?: "robust" | "naive" } = {}): GeeVcovResult {
  checkOptions(options, ["type"], "geeVcov");
  const a = options.type === "naive" ? fit.modelCovariance : fit.covariance;
  return { rows: fit.columnNames, columns: fit.columnNames, values: a.map((r) => r.slice()) };
}

/** Wald coefficient table. */
export function geeSummary(fit: GeeResult, options: Record<string, never> = {}): GeeSummaryResult {
  checkOptions(options, GEE_SUMMARY_KEYS, "geeSummary");
  const values = fit.coefficients.map((estimate, i) => {
    const se = Math.sqrt(fit.covariance[i]![i]!);
    const z = estimate / se;
    return [estimate, se, z * z, 2 * (1 - (pnorm(Math.abs(z)) as number))];
  });
  return reported("geeSummary", { rows: fit.columnNames, columns: ["Estimate", "Std. Error", "Wald", "Pr(>|W|)"],
    values, scale: fit.scale, correlation: { rows: fit.alpha.map((_, i) => "alpha" + (i + 1)), estimate: fit.alpha.slice() },
    warnings: fit.warnings.slice() }, fit);
}

/** Marginal mean predictions on the link or response scale. */
export function geePredict(fit: GeeResult, options: GeePredictOptions = {}): number[] {
  checkOptions(options, GEE_PREDICT_KEYS, "geePredict");
  const newdata = options.newdata ?? fit.model.data;
  const d = design(parseFormula(fit.model.formula), newdata);
  const family = makeFamily(fit.model.family, fit.model.link);
  const n = d.x.length;
  const offset = options.newoffset === undefined ? new Array<number>(n).fill(0) : Array.from(options.newoffset);
  if (offset.length !== n) throw new RangeError("newoffset must have one value per row");
  const eta = d.x.map((r, i) => dot(r, fit.coefficients) + offset[i]!);
  return options.type === "response" ? eta.map((v) => family.linkinv(v)) : eta;
}

/** Overall Wald test; term-wise sequential restrictions are added when the model retains term assignments. */
export function geeAnova(fit: GeeResult, options: { test?: "Wald" } = {}): GeeAnovaResult {
  checkOptions(options, GEE_ANOVA_KEYS, "geeAnova");
  const p = fit.coefficients.length;
  const invCov = inverse(fit.covariance);
  const w = dot(fit.coefficients, multiply(invCov, fit.coefficients.map((v) => [v])).map((r) => r[0]!));
  const tail = pchisq(w, p, { lowerTail: false }) as number;
  return reported("geeAnova", { rows: ["Model"], columns: ["Df", "X2", "Pr(>Chi)"] as ["Df", "X2", "Pr(>Chi)"], values: [[p, w, tail]], warnings: [] }, fit);
}

/** Quasi-likelihood information criteria (Pan, 2001). */
export function geeQIC(fit: GeeResult): { QIC: number; QICu: number; Q: number; CIC: number; params: number; QICC: number } {
  const family = makeFamily(fit.model.family, fit.model.link);
  let q = 0;
  for (let i = 0; i < fit.model.y.length; i++) {
    const y = fit.model.y[i]!, mu = fit.fittedValues[fit.rows[i]!]!;
    if (family.family === "gaussian") q -= 0.5 * (y - mu) ** 2 / fit.scale;
    else if (family.family === "binomial") q += y * Math.log(mu) + (1 - y) * Math.log(1 - mu);
    else if (family.family === "poisson") q += y * Math.log(mu) - mu;
    else if (family.family === "Gamma") q += -y / mu - Math.log(mu);
  }
  const p = fit.coefficients.length;
  const cicMatrix = multiply(inverse(fit.modelCovariance), inverse(fit.covariance));
  let cic = 0;
  for (let i = 0; i < cicMatrix.length; i++) cic += cicMatrix[i]![i]!;
  const qic = -2 * q + 2 * cic;
  const qicu = -2 * q + 2 * p;
  const k = new Set(fit.clusterIds.map((v) => String(v))).size;
  return { QIC: qic, QICu: qicu, Q: q, CIC: cic, params: p, QICC: qic + 2 * p * (p + 1) / Math.max(1, k - p - 1) };
}
