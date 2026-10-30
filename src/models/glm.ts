// Generalized linear models with a matrix interface: R's glm (the fit of glm.fit), summary.glm, the four kinds of
// residuals, hatvalues, rstandard, cooks.distance and predict (with standard errors).
//
// Written for rStats.js (no ported code) from oracle/glm-behaviour.md (a description of R's behaviour), R's help
// pages (?glm, ?glm.control, ?summary.glm, ?predict.glm, ?influence.measures) and McCullagh and Nelder (1989),
// Generalized Linear Models, 2nd ed., section 2.5 (iteratively reweighted least squares). The least squares steps use
// the QR decomposition of src/linalg/qr.ts with R's limited pivoting and the tolerance min(1e-7, epsilon / 1000), so
// that aliased columns are found as R finds them; their coefficients are NaN (R's NA).

import { pt1 } from "../distributions/t.js";
import { pnorm } from "../distributions/normal.js";
import { chol2inv } from "../linalg/chol.js";
import type { MatrixInput } from "../linalg/matrix.js";
import { qr, qrCoef, qrQy, type QR } from "../linalg/qr.js";
import type { Sample } from "../htest/types.js";
import {
  familyAic,
  makeFamily,
  prepareResponse,
  Warnings,
  withWarnings,
  type Family,
  type GlmFamilyName,
  type GlmFamilySpec,
  type GlmLink,
} from "./glmFamily.js";
import { maxOf } from "../internal/extremes.js";

export type { GlmFamilyName, GlmFamilySpec, GlmLink, GlmLinkName, QuasiVariance } from "./glmFamily.js";

const EPS = 2 ** -52;

/**
 * Options for {@link glm}.
 *
 * @category Generalized linear models
 */
export interface GlmOptions {
  /**
   * The family: a name (`"gaussian"`, the default, `"binomial"`, `"quasibinomial"`, `"poisson"`, `"quasipoisson"`,
   * `"Gamma"`, `"inverse.gaussian"`, `"quasi"`) or an object with the link and, for `quasi`, the variance function,
   * as R's `quasi(link = "log", variance = "mu^2")`.
   */
  family?: GlmFamilyName | GlmFamilySpec;
  /**
   * The link (overrides the family object's): a name such as `"logit"` or `{ power: lambda }` (quasi only). As in R,
   * any named link may be used with any family except `quasi`, which takes only its own list.
   */
  link?: GlmLink;
  /** Prior weights (non-negative). */
  weights?: Sample;
  /** Offset added to the linear predictor. */
  offset?: Sample;
  /** Starting coefficients (intercept first). */
  start?: Sample;
  /** Convergence tolerance on the relative change of the deviance (R's `glm.control(epsilon)`). Default `1e-8`. */
  epsilon?: number;
  /** Maximum number of iterations. Default `25`. */
  maxit?: number;
  /** Include an intercept (a column of ones before the columns of `x`). Default `true`. */
  intercept?: boolean;
}

/**
 * The data and settings of a fit, kept for the refits of {@link glmConfint} and {@link glmAnova}.
 *
 * @category Generalized linear models
 */
export interface GlmModel {
  /** Model matrix (with the column of ones), rows with a missing value dropped. */
  x: number[][];
  /** Column names: `"(Intercept)"`, `"x1"`, `"x2"`, ... */
  columnNames: string[];
  /** Response as given (a vector, or rows of successes and failures), rows with a missing value dropped. */
  yGiven: number[] | number[][];
  /** Prior weights as given (1 when not given). */
  priorGiven: number[];
  /** Offset, one per row (0 when not given). */
  offset: number[];
  /** Whether an offset was given. */
  hasOffset: boolean;
  /** Whether the model has an intercept. */
  intercept: boolean;
  /** The family and link of the fit. */
  familySpec: GlmFamilySpec;
  /** Convergence tolerance (R's `glm.control(epsilon)`). */
  epsilon: number;
  /** Maximum number of iterations (R's `glm.control(maxit)`). */
  maxit: number;
  /** Starting coefficients, if given. */
  start: number[] | undefined;
}

/**
 * Result of {@link glm}: R's `glm` object.
 *
 * @category Generalized linear models
 */
export interface GlmResult {
  /** Coefficients (intercept first); NaN for aliased columns. */
  coefficients: number[];
  /** Fitted means, one per row (rows with a missing value dropped). */
  fittedValues: number[];
  /** Linear predictors, one per row, offset included (R's `linear.predictors`). */
  linearPredictors: number[];
  /** Residual deviance. */
  deviance: number;
  /** Deviance of the model with the intercept only, or of the empty model without intercept (R's `null.deviance`). */
  nullDeviance: number;
  /** AIC; NaN for the quasi families. */
  aic: number;
  /** Numerical rank of the model matrix. */
  rank: number;
  /** Residual degrees of freedom (R's `df.residual`). */
  dfResidual: number;
  /** Degrees of freedom of the null deviance (R's `df.null`). */
  dfNull: number;
  /** Number of iterations. */
  iter: number;
  /** Whether the iterations converged. */
  converged: boolean;
  /** Whether the step was truncated (halved) in the last iteration. */
  boundary: boolean;
  /** The response as the family reads it (proportions for a two-column binomial response). */
  y: number[];
  /** Prior weights after the response was read (multiplied by the sizes for a two-column binomial response). */
  priorWeights: number[];
  /** Working weights of the last least squares step (0 for rows not used). */
  weights: number[];
  /** Working residuals. */
  residuals: number[];
  /** The family's name and the link's name (`"mu^0.333"` for a power link). */
  family: GlmFamilyName;
  /** The link's name, such as `"logit"`. */
  link: string;
  /** R's warnings, each once, in order of first appearance. */
  warnings: string[];
  /** QR decomposition of the last weighted least squares problem (undefined for a model without columns). */
  qr: QR | undefined;
  /** The data and settings of the fit, for the refits of {@link glmConfint} and {@link glmAnova}. */
  model: GlmModel;
}

/** Input of the iteratively reweighted least squares (after the response has been read) */
interface IrlsInput {
  x: number[][];
  p: number;
  y: number[];
  w: number[];
  offset: number[];
  fam: Family;
  epsilon: number;
  maxit: number;
  columnNames: string[];
  start?: number[] | undefined;
  etastart?: number[] | undefined;
  mustart: number[];
  /**
   * Stop when the coefficients stop changing (max |change| <= 8 eps max |b|) instead of R's rule on the deviance,
   * which is stationary at the estimate (used by the profile fits of glmConfint)
   */
  untilCoefficients?: boolean | undefined;
}

/** Result of the iterations */
export interface IrlsFit {
  coefficients: number[];
  eta: number[];
  mu: number[];
  deviance: number;
  iter: number;
  converged: boolean;
  boundary: boolean;
  rank: number;
  qr: QR | undefined;
  /** Rows used in the last least squares step */
  used: boolean[];
  workingWeights: number[];
  workingResiduals: number[];
}

function deparseNames(names: string[]): string {
  const q = names.map((s) => `"${s}"`);
  return q.length === 1 ? q[0]! : `c(${q.join(", ")})`;
}

function linearPredictor(x: number[][], b: number[], offset: number[]): number[] {
  return x.map((r, i) => {
    let s = 0;
    for (let j = 0; j < r.length; j++) s += r[j]! * b[j]!;
    return s + offset[i]!;
  });
}

function totalDeviance(fam: Family, y: number[], mu: number[], w: number[]): number {
  let d = 0;
  for (let i = 0; i < y.length; i++) d += fam.devContribution(y[i]!, mu[i]!, w[i]!);
  return d;
}

/** Iteratively reweighted least squares (glm-behaviour.md, "Fitting") */
export function irls(inp: IrlsInput, warnings: Warnings): IrlsFit {
  const { x, p, y, w, offset, fam, epsilon, maxit } = inp;
  const n = y.length;
  // As R, whose least-squares step (C_Cdqrls) stops on a non-finite value among the rows of positive weight
  if (y.some((v, i) => w[i]! > 0 && !Number.isFinite(v))) throw new RangeError("NA/NaN/Inf in 'y'");
  if (x.some((r, i) => w[i]! > 0 && r.some((v) => !Number.isFinite(v)))) throw new RangeError("NA/NaN/Inf in 'x'");
  return withWarnings(warnings, () => {
    const allOk = (eta: number[], mu: number[]) => eta.every((e) => fam.etaOk(e)) && mu.every((m) => fam.muOk(m));
    if (p === 0) {
      // a model without columns: the linear predictor is the offset
      const eta = offset.slice();
      if (!eta.every((e) => fam.etaOk(e))) throw new Error("invalid linear predictor values in empty model");
      const mu = eta.map((e) => fam.linkinv(e));
      if (!mu.every((m) => fam.muOk(m))) throw new Error("invalid fitted means in empty model");
      const me = eta.map((e) => fam.muEta(e));
      const ww = mu.map((m, i) => Math.sqrt((w[i]! * me[i]! ** 2) / fam.variance(m)) ** 2);
      return {
        coefficients: [],
        eta,
        mu,
        deviance: totalDeviance(fam, y, mu, w),
        iter: 0,
        converged: true,
        // (true, not a mistake: R's glm.fit marks the empty model both converged and at the boundary; the warning
        // "algorithm stopped at boundary value" is still not given, see finalWarnings)
        boundary: true,
        rank: 0,
        qr: undefined,
        used: w.map((v) => v > 0),
        workingWeights: ww,
        workingResiduals: y.map((v, i) => (v - mu[i]!) / me[i]!),
      };
    }

    let eta: number[];
    let previous: number[] | undefined;
    if (inp.start !== undefined) {
      if (inp.start.length !== p) {
        throw new RangeError(`length of 'start' should equal ${p} and correspond to initial coefs for ${deparseNames(inp.columnNames)}`);
      }
      previous = inp.start.slice();
      eta = linearPredictor(x, previous, offset);
    } else if (inp.etastart !== undefined) eta = inp.etastart.slice();
    else eta = inp.mustart.map((m) => fam.link(m));
    let mu = eta.map((e) => fam.linkinv(e));
    if (!allOk(eta, mu)) throw new Error("cannot find valid starting values: please specify some");
    let devPrevious = totalDeviance(fam, y, mu, w);
    let dev = devPrevious;
    let converged = false;
    let boundary = false;
    let iter = 0;
    let coef = new Array<number>(p).fill(0);
    let q: QR | undefined;
    let used: boolean[] = w.map(() => false);
    let sqrtW: number[] = [];
    const tol = Math.min(1e-7, epsilon / 1000);

    for (iter = 1; iter <= maxit; iter++) {
      const me = eta.map((e) => fam.muEta(e));
      for (let i = 0; i < n; i++) {
        if (!(w[i]! > 0)) continue;
        const v = fam.variance(mu[i]!);
        if (Number.isNaN(v)) throw new Error("NAs in V(mu)");
        if (v === 0) throw new Error("0s in V(mu)");
        if (Number.isNaN(me[i]!)) throw new Error("NAs in d(mu)/d(eta)");
      }
      used = w.map((v, i) => v > 0 && me[i] !== 0);
      const rows: number[] = [];
      for (let i = 0; i < n; i++) if (used[i]) rows.push(i);
      if (rows.length === 0) {
        warnings.add(`no observations informative at iteration ${iter}`);
        converged = false;
        break;
      }
      sqrtW = new Array<number>(n).fill(0);
      const zw: number[] = [];
      const xw: number[][] = [];
      for (const i of rows) {
        const s = Math.sqrt((w[i]! * me[i]! ** 2) / fam.variance(mu[i]!));
        sqrtW[i] = s;
        zw.push(((eta[i]! - offset[i]!) + (y[i]! - mu[i]!) / me[i]!) * s);
        xw.push(x[i]!.map((v) => v * s));
      }
      q = qr(xw, { tol });
      const b = qrCoef(q, zw);
      if (b.some((v, j) => q!.pivot.indexOf(j) < q!.rank && !Number.isFinite(v))) {
        warnings.add(`non-finite coefficients at iteration ${iter}`);
        converged = false;
        break;
      }
      coef = b.map((v) => (Number.isNaN(v) ? 0 : v));
      boundary = false;
      eta = linearPredictor(x, coef, offset);
      mu = eta.map((e) => fam.linkinv(e));
      dev = totalDeviance(fam, y, mu, w);
      if (!Number.isFinite(dev)) {
        if (previous === undefined) throw new Error("no valid set of coefficients has been found: please supply starting values");
        warnings.add("step size truncated due to divergence");
        let halvings = 0;
        while (!Number.isFinite(dev)) {
          if (halvings >= maxit) throw new Error("inner loop 1; cannot correct step size");
          halvings++;
          coef = coef.map((v, j) => (v + previous![j]!) / 2);
          eta = linearPredictor(x, coef, offset);
          mu = eta.map((e) => fam.linkinv(e));
          dev = totalDeviance(fam, y, mu, w);
        }
        boundary = true;
      }
      if (!allOk(eta, mu)) {
        if (previous === undefined) throw new Error("no valid set of coefficients has been found: please supply starting values");
        warnings.add("step size truncated: out of bounds");
        let halvings = 0;
        while (!allOk(eta, mu)) {
          if (halvings >= maxit) throw new Error("inner loop 2; cannot correct step size");
          halvings++;
          coef = coef.map((v, j) => (v + previous![j]!) / 2);
          eta = linearPredictor(x, coef, offset);
          mu = eta.map((e) => fam.linkinv(e));
        }
        boundary = true;
        dev = totalDeviance(fam, y, mu, w);
      }
      if (inp.untilCoefficients) {
        const scale = maxOf(coef.map(Math.abs));
        if (previous !== undefined && coef.every((v, j) => Math.abs(v - previous![j]!) <= 8 * EPS * scale)) {
          converged = true;
          break;
        }
      } else if (Math.abs(dev - devPrevious) / (Math.abs(dev) + 0.1) < epsilon) {
        converged = true;
        break;
      }
      devPrevious = dev;
      previous = coef.slice();
    }
    if (iter > maxit) iter = maxit;
    let rank = p;
    const coefficients = coef.slice();
    if (q !== undefined) {
      rank = q.rank;
      for (let k = q.rank; k < p; k++) coefficients[q.pivot[k]!] = NaN;
    }
    const me = eta.map((e) => fam.muEta(e));
    return {
      coefficients,
      eta,
      mu,
      deviance: dev,
      iter,
      converged,
      boundary,
      rank,
      qr: q,
      used,
      workingWeights: sqrtW.map((s) => s * s),
      workingResiduals: y.map((v, i) => (v - mu[i]!) / me[i]!),
    };
  });
}

function toRows(x: MatrixInput | Sample): number[][] {
  return x.length > 0 && typeof x[0] !== "number" ? (x as MatrixInput).map((r) => Array.from(r)) : Array.from(x as Sample, (v) => [v]);
}

/** After the fit: the warnings about convergence and fitted values at the boundary */
function finalWarnings(fit: IrlsFit, fam: Family, warnings: Warnings, empty: boolean): void {
  if (empty) return;
  if (!fit.converged) warnings.add("glm.fit: algorithm did not converge");
  if (fit.boundary) warnings.add("glm.fit: algorithm stopped at boundary value");
  if (fam.family === "binomial" && fit.mu.some((m) => m > 1 - 10 * EPS || m < 10 * EPS)) {
    warnings.add("glm.fit: fitted probabilities numerically 0 or 1 occurred");
  }
  if (fam.family === "poisson" && fit.mu.some((m) => m < 10 * EPS)) warnings.add("glm.fit: fitted rates numerically 0 occurred");
}

/** Fits a model from its stored data, with the columns `cols` of the model matrix (all by default) */
export function refit(
  model: GlmModel,
  cols: number[],
  warnings: Warnings,
  control: {
    epsilon?: number;
    maxit?: number;
    etastart?: number[];
    start?: number[] | undefined;
    extraOffset?: number[];
    untilCoefficients?: boolean;
  } = {},
): { fit: IrlsFit; fam: Family; y: number[]; w: number[]; size: number[] | undefined; offset: number[] } {
  const fam = makeFamily(model.familySpec);
  const start = "start" in control ? control.start : model.start;
  const prep = prepareResponse(fam, model.yGiven, model.priorGiven, start !== undefined || control.etastart !== undefined, warnings);
  const offset = control.extraOffset === undefined ? model.offset : model.offset.map((o, i) => o + control.extraOffset![i]!);
  const x = model.x.map((r) => cols.map((j) => r[j]!));
  const fit = irls(
    {
      x,
      p: cols.length,
      y: prep.y,
      w: prep.weights,
      offset,
      fam,
      epsilon: control.epsilon ?? model.epsilon,
      maxit: control.maxit ?? model.maxit,
      columnNames: cols.map((j) => model.columnNames[j]!),
      start,
      etastart: control.etastart,
      mustart: prep.mustart,
      untilCoefficients: control.untilCoefficients,
    },
    warnings,
  );
  finalWarnings(fit, fam, warnings, cols.length === 0);
  return { fit, fam, y: prep.y, w: prep.weights, size: prep.size, offset };
}

/**
 * Fit a generalized linear model by iteratively reweighted least squares. Equivalent to R's
 * `glm(y ~ x, family = ...)`. Or `y ~ x - 1` without intercept; the predictors are given as a matrix instead of a
 * formula. Rows with a missing value (NaN) in `x`, `y`, the weights or the offset are dropped. Every family and link
 * of R's `stats` is available; R's warnings are returned in `warnings`. See {@link glmSummary}, {@link glmResiduals},
 * {@link glmPredict}, {@link glmConfint} and {@link glmAnova} for the methods.
 *
 * @param x Predictors: a matrix (array of rows, one column per predictor; rows of length 0 for a model with the
 *   intercept only) or a vector (one predictor).
 * @param y Response: a vector, or for the binomial families rows of (successes, failures).
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * fit.coefficients; // [-4.2491, 1.214]
 * glmSummary(fit).pValue; // [0.20976, 0.18341]
 * ```
 *
 * @category Generalized linear models
 */
export function glm(x: MatrixInput | Sample, y: Sample | MatrixInput, options: GlmOptions = {}): GlmResult {
  const intercept = options.intercept ?? true;
  const xr = toRows(x);
  const yIsMatrix = y.length > 0 && typeof y[0] !== "number";
  const yr: number[] | number[][] = yIsMatrix ? (y as MatrixInput).map((r) => Array.from(r)) : Array.from(y as Sample);
  const nAll = yr.length;
  if (xr.length !== nAll) throw new RangeError("variable lengths differ (found for 'x1')");
  const wGiven = options.weights === undefined ? undefined : Array.from(options.weights);
  if (wGiven !== undefined && wGiven.length !== nAll) throw new RangeError("variable lengths differ (found for '(weights)')");
  const oGiven = options.offset === undefined ? undefined : Array.from(options.offset);
  if (oGiven !== undefined && oGiven.length !== nAll) throw new RangeError("variable lengths differ (found for '(offset)')");
  const keep = xr.map((r, i) => {
    const yi = yr[i]!;
    const yNa = Array.isArray(yi) ? yi.some((v) => Number.isNaN(v)) : Number.isNaN(yi);
    return !yNa && r.every((v) => !Number.isNaN(v)) && !(wGiven !== undefined && Number.isNaN(wGiven[i]!)) && !(oGiven !== undefined && Number.isNaN(oGiven[i]!));
  });
  const X = xr.filter((_, i) => keep[i]).map((r) => (intercept ? [1, ...r] : r));
  const yGiven = (yr as unknown[]).filter((_, i) => keep[i]) as number[] | number[][];
  const n = yGiven.length;
  if (n === 0) throw new RangeError("0 (non-NA) cases");
  const priorGiven = wGiven === undefined ? new Array<number>(n).fill(1) : wGiven.filter((_, i) => keep[i]);
  if (priorGiven.some((v) => v < 0)) throw new RangeError("negative weights not allowed");
  const offset = oGiven === undefined ? new Array<number>(n).fill(0) : oGiven.filter((_, i) => keep[i]);
  const nx = xr.length > 0 ? xr[0]!.length : 0;
  const columnNames = [...(intercept ? ["(Intercept)"] : []), ...Array.from({ length: nx }, (_, j) => `x${j + 1}`)];
  const p = columnNames.length;
  if (X.some((r) => r.length !== p)) throw new TypeError("all rows of x must have the same length");
  const familySpec: GlmFamilySpec =
    typeof options.family === "object" ? { ...options.family } : { family: options.family ?? "gaussian" };
  if (options.link !== undefined) familySpec.link = options.link;
  const model: GlmModel = {
    x: X,
    columnNames,
    yGiven,
    priorGiven,
    offset,
    hasOffset: oGiven !== undefined,
    intercept,
    familySpec,
    epsilon: options.epsilon ?? 1e-8,
    // R loops over 1:maxit, so a fractional maxit runs (and reports) its integer part
    maxit: Math.floor(options.maxit ?? 25),
    start: options.start === undefined ? undefined : Array.from(options.start),
  };
  if (!(model.epsilon > 0 && model.epsilon < Infinity)) throw new RangeError("value of 'epsilon' must be > 0 and finite");
  if (!(model.maxit > 0 && model.maxit < Infinity)) throw new RangeError("maximum number of iterations must be > 0");

  const warnings = new Warnings();
  const all = Array.from({ length: p }, (_, j) => j);
  const { fit, fam, y: yy, w, size } = refit(model, all, warnings);

  // null deviance: the constant weighted mean (with an intercept) or the inverse link of the offset
  let nullDeviance: number;
  if (intercept && model.hasOffset) {
    const nullWarnings = new Warnings();
    const nf = irls(
      { x: X.map(() => [1]), p: 1, y: yy, w, offset, fam, epsilon: model.epsilon, maxit: model.maxit, columnNames: ["(Intercept)"], mustart: fit.mu },
      nullWarnings,
    );
    finalWarnings(nf, fam, nullWarnings, false);
    nullWarnings.list.forEach((m) => warnings.add(m));
    nullDeviance = nf.deviance;
    if (!nf.converged) warnings.add("fitting to calculate the null deviance did not converge -- increase 'maxit'?");
  } else if (intercept) {
    let sw = 0;
    let swy = 0;
    for (let i = 0; i < n; i++) {
      sw += w[i]!;
      swy += w[i]! * yy[i]!;
    }
    const m = swy / sw;
    nullDeviance = withWarnings(warnings, () => totalDeviance(fam, yy, yy.map(() => m), w));
  } else nullDeviance = withWarnings(warnings, () => totalDeviance(fam, yy, offset.map((o) => fam.linkinv(o)), w));

  const nOk = n - w.filter((v) => v === 0).length;
  const aic = familyAic(fam, yy, fit.mu, w, size, fit.deviance, warnings) + 2 * fit.rank;
  return {
    coefficients: fit.coefficients,
    fittedValues: fit.mu,
    linearPredictors: fit.eta,
    deviance: fit.deviance,
    nullDeviance,
    aic,
    rank: fit.rank,
    dfResidual: nOk - fit.rank,
    dfNull: nOk - (intercept ? 1 : 0),
    iter: fit.iter,
    converged: fit.converged,
    boundary: fit.boundary,
    y: yy,
    priorWeights: w,
    weights: fit.workingWeights,
    residuals: fit.workingResiduals,
    family: fam.family,
    link: fam.name,
    warnings: warnings.list,
    qr: fit.qr,
    model,
  };
}

/** The family object of a fit */
export function familyOf(fit: GlmResult): Family {
  return makeFamily(fit.model.familySpec);
}

/** Pearson dispersion of summary.glm (1 for binomial and poisson) */
export function glmDispersion(fit: GlmResult, warnings?: Warnings): number {
  if (familyOf(fit).fixedDispersion) return 1;
  if (fit.dfResidual <= 0) return NaN;
  let s = 0;
  for (let i = 0; i < fit.weights.length; i++) if (fit.weights[i]! > 0) s += fit.weights[i]! * fit.residuals[i]! ** 2;
  if (fit.weights.some((v) => v === 0)) warnings?.add("observations with zero weight not used for calculating dispersion");
  return s / fit.dfResidual;
}

/**
 * Options for {@link glmSummary}.
 *
 * @category Generalized linear models
 */
export interface GlmSummaryOptions {
  /** Dispersion to use instead of the estimate (or 1 for binomial and poisson). */
  dispersion?: number;
}

/**
 * Result of {@link glmSummary}: the quantities of R's `summary(glm)`.
 *
 * @category Generalized linear models
 */
export interface GlmSummary {
  /** The dispersion used (estimated, given, or 1 for binomial and poisson). */
  dispersion: number;
  /** The coefficient table of the columns that are not aliased, in their order. */
  estimate: number[];
  /** Standard errors (R's `Std. Error`). */
  stdError: number[];
  /** z or t statistics (see `statisticName`). */
  statistic: number[];
  /** Two-sided p-values (R's `Pr(>|z|)` or `Pr(>|t|)`). */
  pValue: number[];
  /** `"z value"` when the dispersion is fixed (binomial, poisson), else `"t value"`. */
  statisticName: "z value" | "t value";
  /** (R'R)^-1 of the columns that are not aliased. */
  covUnscaled: number[][];
  /** covUnscaled times the dispersion. */
  covScaled: number[][];
  /** Residual degrees of freedom (R's `df.residual`). */
  dfResidual: number;
  /** Warnings (such as "observations with zero weight not used for calculating dispersion"). */
  warnings: string[];
}

/** (R'R)^-1 of the leading rank x rank block of the last QR, in pivot order */
function unscaledCovariance(fit: GlmResult): number[][] {
  if (fit.qr === undefined || fit.rank === 0) return [];
  const Rr = fit.qr.qr.slice(0, fit.rank).map((row) => row.slice(0, fit.rank));
  return chol2inv(Rr);
}

/**
 * Summary of a generalized linear model: the dispersion, the coefficient table and the covariance of the estimates,
 * for a `glm` fit. Equivalent to R's `summary()`.
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * const s = glmSummary(fit);
 * s.estimate; // [-4.2491, 1.214]
 * s.stdError; // [3.3878, 0.91258]
 * s.statisticName; // "z value"
 * ```
 *
 * @category Generalized linear models
 */
export function glmSummary(fit: GlmResult, options: GlmSummaryOptions = {}): GlmSummary {
  const warnings = new Warnings();
  const fam = familyOf(fit);
  const estimated = options.dispersion === undefined && !fam.fixedDispersion;
  const dispersion = options.dispersion ?? glmDispersion(fit, warnings);
  const covUnscaled = unscaledCovariance(fit);
  const piv = fit.qr === undefined ? [] : fit.qr.pivot.slice(0, fit.rank);
  const estimate = piv.map((j) => fit.coefficients[j]!);
  const stdError = covUnscaled.map((r, k) => Math.sqrt(r[k]! * dispersion));
  const statistic = estimate.map((e, k) => e / stdError[k]!);
  const zTest = !estimated;
  const pValue = statistic.map((t) =>
    zTest ? 2 * pnorm(-Math.abs(t)) : fit.dfResidual > 0 ? 2 * pt1(-Math.abs(t), fit.dfResidual, true, false) : NaN,
  );
  if (estimated && fit.dfResidual === 0) {
    stdError.fill(NaN);
    statistic.fill(NaN);
  }
  return {
    dispersion,
    estimate,
    stdError,
    statistic,
    pValue,
    statisticName: fam.fixedDispersion ? "z value" : "t value",
    covUnscaled,
    covScaled: covUnscaled.map((r) => r.map((v) => v * dispersion)),
    dfResidual: fit.dfResidual,
    warnings: warnings.list,
  };
}

/**
 * Kinds of residuals of {@link glmResiduals}.
 *
 * @category Generalized linear models
 */
export type GlmResidualType = "deviance" | "pearson" | "working" | "response";

/**
 * Residuals of a generalized linear model, one per row, for a `glm` fit (default `"deviance"`). Equivalent to R's
 * `residuals(fit, type)`.
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * glmResiduals(fit); // [-0.30644, -0.54776, 1.4436, -1.4436, 0.54776, 0.30644]
 * glmResiduals(fit, "pearson"); // [-0.21925, -0.40231, 1.3546, -1.3546, 0.40231, 0.21925]
 * ```
 *
 * @category Generalized linear models
 */
export function glmResiduals(fit: GlmResult, type: GlmResidualType = "deviance"): number[] {
  const fam = familyOf(fit);
  const { y, fittedValues: mu, priorWeights: w } = fit;
  switch (type) {
    case "response":
      return y.map((v, i) => v - mu[i]!);
    case "working":
      return fit.residuals.slice();
    case "pearson":
      return y.map((v, i) => ((v - mu[i]!) * Math.sqrt(w[i]!)) / Math.sqrt(fam.variance(mu[i]!)));
    case "deviance":
      if (fit.dfResidual <= 0) return y.map(() => 0);
      return y.map((v, i) => Math.sign(v - mu[i]!) * Math.sqrt(Math.max(fam.devContribution(v, mu[i]!, w[i]!), 0)));
    default:
      throw new RangeError(`unknown type of residuals "${String(type)}"`);
  }
}

/**
 * Diagonal of the hat matrix of the last weighted least squares step, for the rows of non-zero prior weight, for a
 * `glm` fit. Equivalent to R's `hatvalues()`.
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * glmHatvalues(fit); // [0.28361, 0.37762, 0.33877, 0.33877, 0.37762, 0.28361]
 * ```
 *
 * @category Generalized linear models
 */
export function glmHatvalues(fit: GlmResult): number[] {
  const out: number[] = [];
  const q = fit.qr;
  let h: number[] = [];
  if (q !== undefined && fit.rank > 0) {
    const m = q.qr.length;
    const e = Array.from({ length: m }, (_, i) => Array.from({ length: fit.rank }, (_, j) => (i === j ? 1 : 0)));
    const Q = qrQy(q, e);
    h = Q.map((r) => r.reduce((s, v) => s + v * v, 0));
  }
  // rows of the last least squares step, in order
  let k = 0;
  const usedRows = fit.weights.map((v) => v > 0);
  fit.priorWeights.forEach((w, i) => {
    const hi = usedRows[i] ? (h[k++] ?? 0) : 0;
    if (w > 0) out.push(hi > 1 - 10 * EPS ? 1 : hi);
  });
  return out;
}

function median(v: number[]): number {
  const s = v.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Standardized deviance residuals, for the rows of non-zero prior weight, for a `glm` fit. Equivalent to R's
 * `rstandard()`.
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * glmRstandard(fit); // [-0.36205, -0.69432, 1.7753, -1.7753, 0.69432, 0.36205]
 * ```
 *
 * @category Generalized linear models
 */
export function glmRstandard(fit: GlmResult, options: GlmSummaryOptions = {}): number[] {
  const h = glmHatvalues(fit);
  const disp = options.dispersion ?? glmDispersion(fit);
  const r = glmResiduals(fit, "deviance").filter((_, i) => fit.priorWeights[i]! > 0);
  const small = 100 * EPS * median(r.map(Math.abs));
  return r.map((v, i) => {
    const s = (Math.abs(v) < small ? 0 : v) / Math.sqrt(disp * (1 - h[i]!));
    return Number.isFinite(s) ? s : NaN;
  });
}

/**
 * Cook's distances, for the rows of non-zero prior weight, for a `glm` fit. Equivalent to R's `cooks.distance()`.
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * glmCooksDistance(fit); // [0.013283, 0.078894, 0.71087, 0.71087, 0.078894, 0.013283]
 * ```
 *
 * @category Generalized linear models
 */
export function glmCooksDistance(fit: GlmResult, options: GlmSummaryOptions = {}): number[] {
  const h = glmHatvalues(fit);
  const disp = options.dispersion ?? glmDispersion(fit);
  const r = glmResiduals(fit, "pearson").filter((_, i) => fit.priorWeights[i]! > 0);
  return r.map((v, i) => {
    const c = (v / (1 - h[i]!)) ** 2 * (h[i]! / (disp * fit.rank));
    return Number.isFinite(c) ? c : NaN;
  });
}

/**
 * Options for {@link glmPredict}.
 *
 * @category Generalized linear models
 */
export interface GlmPredictOptions {
  /** New predictor values, with the columns of `x` (no column of ones). Default: the data of the fit. */
  newdata?: MatrixInput | Sample;
  /** Offset for `newdata`. Default 0. */
  newoffset?: Sample;
  /** `"link"` (default; the linear predictor) or `"response"` (the mean). */
  type?: "link" | "response";
  /** Dispersion for the standard errors instead of the summary's. */
  dispersion?: number;
}

/**
 * Predictions of a generalized linear model with their standard errors, for a `glm` fit. Equivalent to R's
 * `predict(fit, newdata, type, se.fit = TRUE)`. Aliased columns are left out, as R does.
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * glmPredict(fit, { newdata: [7] }); // { fit: [4.2491], seFit: [3.3878] }
 * glmPredict(fit, { newdata: [7], type: "response" }).fit; // [0.98592]
 * ```
 *
 * @category Generalized linear models
 */
export function glmPredict(
  fit: GlmResult,
  options: GlmPredictOptions = {},
): {
  /** Predictions on the scale of `type`, one per row. */
  fit: number[];
  /** Their standard errors (R's `se.fit`). */
  seFit: number[];
} {
  const fam = familyOf(fit);
  let X: number[][];
  let eta: number[];
  if (options.newdata === undefined) {
    X = fit.model.x;
    eta = fit.linearPredictors.slice();
  } else {
    X = toRows(options.newdata).map((r) => (fit.model.intercept ? [1, ...r] : r));
    if (X.some((r) => r.length !== fit.coefficients.length)) throw new RangeError("newdata must have one column per predictor of the fit");
    const off = options.newoffset === undefined ? X.map(() => 0) : Array.from(options.newoffset);
    if (off.length !== X.length) throw new RangeError("newoffset must have one value per row of newdata");
    eta = X.map((r, i) => r.reduce((s, v, j) => (Number.isNaN(fit.coefficients[j]!) ? s : s + v * fit.coefficients[j]!), 0) + off[i]!);
  }
  const disp = options.dispersion ?? glmDispersion(fit);
  const rank = fit.rank;
  const piv = fit.qr === undefined ? [] : fit.qr.pivot.slice(0, rank);
  const R = fit.qr?.qr;
  // || R^-T x_piv ||, by forward substitution with R^T
  const se = X.map((r) => {
    const z = new Array<number>(rank).fill(0);
    let ss = 0;
    for (let i = 0; i < rank; i++) {
      let s = r[piv[i]!]!;
      for (let k = 0; k < i; k++) s -= R![k]![i]! * z[k]!;
      z[i] = s / R![i]![i]!;
      ss += z[i]! * z[i]!;
    }
    return Math.sqrt(ss) * Math.sqrt(disp);
  });
  const type = options.type ?? "link";
  if (type !== "link" && type !== "response") throw new RangeError(`invalid 'type': ${String(type)}`);
  if (type === "link") return { fit: eta, seFit: se };
  return withWarnings(new Warnings(), () => ({
    fit: eta.map((e) => fam.linkinv(e)),
    seFit: se.map((s, i) => s * Math.abs(fam.muEta(eta[i]!))),
  }));
}
