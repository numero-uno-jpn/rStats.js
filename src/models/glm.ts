// Generalized linear models with a matrix interface: R's glm (glm.fit), summary.glm, residuals.glm, the influence
// measures (hatvalues, rstandard, cooks.distance) and predict.glm with standard errors.
//
// Written for rStats.js (no ported code). The fit is iteratively reweighted least squares (Fisher scoring) as in
// P. McCullagh and J. A. Nelder, Generalized Linear Models (2nd ed., 1989), §2.5: from the working response
// z = eta - offset + (y - mu) / (d mu / d eta) and the working weights w = prior weight (d mu / d eta)^2 / V(mu), each
// step is a weighted least squares fit, solved with the QR decomposition of lm (src/linalg/qr.ts: R's LINPACK
// pivoting, here with the tolerance min(1e-7, epsilon / 1000), as in R). What R does around it was taken from R's
// documentation (?glm, ?glm.control, ?family, ?summary.glm, ?predict.glm, ?influence.measures) and from R's output
// (test/fixtures/glm.json), and is reproduced so that fits stopped by R's convergence rule agree with R: the starting
// values (each family's mustart, or `start`), the rule |dev - dev_old| / (|dev| + 0.1) < epsilon, at most maxit
// iterations, halving the step towards the previous coefficients while the deviance is not finite ("step size
// truncated due to divergence") and then while eta or mu is outside the valid range ("step size truncated: out of
// bounds"), the boundary flag, and the warnings that R gives (returned in `warnings`, with R's text). The summary,
// residuals, influence measures and predictions use the weights and the QR decomposition of the last iteration, as in
// R; the dispersion is the Pearson statistic over the residual degrees of freedom (1 for binomial and poisson).

import { pt1 } from "../distributions/t.js";
import { pnorm1 } from "../distributions/normal.js";
import { chol2inv } from "../linalg/chol.js";
import type { MatrixInput } from "../linalg/matrix.js";
import { qr, qrCoef, qrQy, type QR } from "../linalg/qr.js";
import type { Sample } from "../htest/types.js";
import {
  initialize,
  resolveFamily,
  type Family,
  type GlmFamilyName,
  type GlmFamilySpec,
  type GlmLink,
} from "./glmFamily.js";

export type { GlmFamilyName, GlmFamilySpec, GlmLink, GlmLinkName, QuasiVariance } from "./glmFamily.js";

/** Options for {@link glm}. */
export interface GlmOptions {
  /** The family: a name, or an object with the link and (for `quasi`) the variance function. Default `"gaussian"`. */
  family?: GlmFamilyName | GlmFamilySpec;
  /** The link (overrides the link of `family`). Default: the family's default link, as in R. */
  link?: GlmLink;
  /** Prior weights (non-negative; rows of weight 0 are left out of the fit but get fitted values). */
  weights?: Sample;
  /** An offset added to the linear predictor (known coefficient 1). */
  offset?: Sample;
  /** Starting values of the coefficients (intercept first). Default: each family's starting means, as in R. */
  start?: Sample;
  /** Convergence tolerance on the relative change of the deviance (R's glm.control). Default `1e-8`. */
  epsilon?: number;
  /** Maximum number of iterations (R's glm.control). Default `25`. */
  maxit?: number;
  /** Include an intercept (a column of ones before the columns of `x`). Default `true`. */
  intercept?: boolean;
}

/** Result of {@link glm}: the fitted model, as R's `glm` object. */
export interface GlmResult {
  /** Coefficients (intercept first); NaN for aliased columns. */
  coefficients: number[];
  /** Fitted means mu. */
  fittedValues: number[];
  /** Linear predictor eta (including the offset). */
  linearPredictors: number[];
  /** Working residuals (y - mu) / (d mu / d eta) (R's `fit$residuals`). */
  workingResiduals: number[];
  /** Working weights of the last iteration (R's `fit$weights`; 0 for rows left out). */
  workingWeights: number[];
  /** Prior weights (for a two-column binomial response, multiplied by the totals, as in R). */
  priorWeights: number[];
  /** The response (for a two-column binomial response, the proportions of successes, as in R). */
  y: number[];
  deviance: number;
  /** Deviance of the model with the intercept only (or of the offset alone without an intercept). */
  nullDeviance: number;
  /** AIC; NaN for the quasi families. */
  aic: number;
  /** Numerical rank of the model matrix. */
  rank: number;
  /** Residual degrees of freedom (rows of non-zero weight minus the rank). */
  dfResidual: number;
  /** Degrees of freedom of the null model. */
  dfNull: number;
  /** Number of iterations. */
  iter: number;
  converged: boolean;
  /** Whether the last iteration halved the step to stay inside the valid range. */
  boundary: boolean;
  /** R's warning messages for this fit (empty when R gives none). */
  warnings: string[];
  /** The family: its name, the link and the variance function (R's names). */
  family: { family: GlmFamilyName; link: string; variance: string };
  /** Whether the model has an intercept. */
  intercept: boolean;
  /** The offset, when one was given. */
  offset?: number[];
  /** The model matrix (with the column of ones when there is an intercept), rows with a missing value dropped. */
  modelMatrix: number[][];
  /** QR decomposition of the weighted model matrix of the last iteration (rows of positive working weight). */
  qr: QR;
  /** The settings of the fit, for refits by {@link glmConfint} and {@link glmAnova}. */
  control: { epsilon: number; maxit: number; familySpec: GlmFamilySpec };
}

const sumOf = (a: readonly number[]): number => a.reduce((s, v) => s + v, 0);

function matVec(X: readonly (readonly number[])[], b: readonly number[], offset: readonly number[]): number[] {
  return X.map((r, i) => {
    let s = 0;
    for (let j = 0; j < b.length; j++) s += r[j]! * b[j]!;
    return s + offset[i]!;
  });
}

/** Collects warning messages once each, in the order of their first occurrence (R's unique(warnings)). */
export class Warnings {
  readonly list: string[] = [];
  readonly add = (m: string): void => {
    if (!this.list.includes(m)) this.list.push(m);
  };
}

/** Input of the iterations (R's glm.fit after the family's initialize). */
export interface FitInput {
  X: readonly (readonly number[])[];
  y: readonly number[];
  weights: readonly number[];
  offset: readonly number[];
  fam: Family;
  /** Binomial totals, for the AIC. */
  n: readonly number[];
  mustart: readonly number[];
  start?: readonly number[] | undefined;
  etastart?: readonly number[] | undefined;
  epsilon: number;
  maxit: number;
  intercept: boolean;
  warn: (m: string) => void;
  /** Tolerance of the QR decomposition (default min(1e-7, epsilon / 1000), as in R). */
  qrTol?: number;
  /**
   * Iterate until the coefficients stop changing (their step is at the rounding level or no longer decreases), instead
   * of R's rule on the deviance: the maximum likelihood estimate to rounding, for the profiles of glmConfint.
   */
  toRounding?: boolean;
}

export interface FitOutput {
  /** Coefficients with 0 for aliased columns (as used in the iterations). */
  coef: number[];
  aliased: boolean[];
  eta: number[];
  mu: number[];
  dev: number;
  nulldev: number;
  aic: number;
  rank: number;
  iter: number;
  conv: boolean;
  boundary: boolean;
  qr: QR;
  /** Working weights (0 for rows left out). */
  w: number[];
  /** Working residuals. */
  residuals: number[];
  dfResidual: number;
  dfNull: number;
}

const devianceOf = (inp: FitInput, mu: readonly number[], nan: () => void): number => {
  let d = 0;
  for (let i = 0; i < mu.length; i++) d += inp.fam.devResid(inp.y[i]!, mu[i]!, inp.weights[i]!, nan);
  return d;
};

/** The iterations of glm.fit (from the family's starting values, `start` or `etastart`). */
export function glmFitCore(inp: FitInput): FitOutput {
  const { X, y, weights, offset, fam, epsilon, maxit } = inp;
  const nobs = y.length;
  const nvars = nobs > 0 ? X[0]!.length : 0;
  const link = fam.link;
  const nan = (): void => inp.warn("NaNs produced");
  const linkinv = (eta: readonly number[]): number[] => eta.map((e) => link.linkinv(e));
  const valid = (eta: readonly number[], mu: readonly number[]): boolean => link.valideta(eta) && fam.validmu(mu);
  const tol = inp.qrTol ?? Math.min(1e-7, epsilon / 1000);
  let eta: number[];
  let mu: number[];
  let dev: number;
  let coef: number[] = [];
  let conv = false;
  let boundary = false;
  let iter = 0;
  let q: QR = { qr: [], rank: 0, qraux: [], pivot: [], useLapack: false };
  let good: boolean[] = weights.map((w) => w > 0);
  let wGood: number[] = [];
  if (nvars === 0) {
    // the empty model: eta is the offset
    eta = offset.slice();
    mu = linkinv(eta);
    if (!link.valideta(eta)) throw new RangeError("invalid linear predictor values in empty model");
    if (!fam.validmu(mu)) throw new RangeError("invalid fitted means in empty model");
    dev = devianceOf(inp, mu, nan);
    const me = eta.map((e) => link.muEta(e));
    good = y.map(() => true);
    wGood = mu.map((m, i) => Math.sqrt((weights[i]! * me[i]! ** 2) / fam.variance(m)));
    conv = true;
  } else {
    let coefold: number[] | undefined;
    let start: number[] | undefined;
    if (inp.etastart !== undefined) eta = inp.etastart.slice();
    else if (inp.start !== undefined) {
      if (inp.start.length !== nvars) {
        const names = [...(inp.intercept ? ["(Intercept)"] : []), ...Array.from({ length: nvars - (inp.intercept ? 1 : 0) }, (_, j) => `x${j + 1}`)];
        throw new RangeError(
          `length of 'start' should equal ${nvars} and correspond to initial coefs for c(${names.map((s) => JSON.stringify(s)).join(", ")})`,
        );
      }
      coefold = inp.start.slice();
      start = inp.start.slice();
      eta = matVec(X, start, offset);
    } else eta = inp.mustart.map((m) => link.linkfun(m));
    mu = linkinv(eta);
    if (!valid(eta, mu)) throw new RangeError("cannot find valid starting values: please specify some");
    let devold = devianceOf(inp, mu, nan);
    dev = devold;
    let prevStart: number[] | undefined = start;
    let prevStep = Infinity;
    for (iter = 1; iter <= maxit; iter++) {
      good = weights.map((w) => w > 0);
      for (let i = 0; i < nobs; i++) {
        if (!good[i]) continue;
        const v = fam.variance(mu[i]!);
        if (Number.isNaN(v)) throw new Error("NAs in V(mu)");
        if (v === 0) throw new Error("0s in V(mu)");
      }
      const me = eta.map((e) => link.muEta(e));
      if (me.some((v, i) => good[i] && Number.isNaN(v))) throw new Error("NAs in d(mu)/d(eta)");
      good = weights.map((w, i) => w > 0 && me[i] !== 0);
      if (!good.some(Boolean)) {
        conv = false;
        inp.warn(`no observations informative at iteration ${iter}`);
        break;
      }
      const rows: number[][] = [];
      const zw: number[] = [];
      wGood = [];
      for (let i = 0; i < nobs; i++) {
        if (!good[i]) continue;
        const z = eta[i]! - offset[i]! + (y[i]! - mu[i]!) / me[i]!;
        const w = Math.sqrt((weights[i]! * me[i]! ** 2) / fam.variance(mu[i]!));
        wGood.push(w);
        rows.push(X[i]!.map((v) => v * w));
        zw.push(z * w);
      }
      q = qr(rows, { tol });
      const b = qrCoef(q, zw).map((v) => (Number.isNaN(v) ? 0 : v));
      if (b.some((v) => !Number.isFinite(v))) {
        conv = false;
        inp.warn(`non-finite coefficients at iteration ${iter}`);
        break;
      }
      start = b;
      eta = matVec(X, start, offset);
      mu = linkinv(eta);
      dev = devianceOf(inp, mu, nan);
      boundary = false;
      if (!Number.isFinite(dev)) {
        if (coefold === undefined) throw new RangeError("no valid set of coefficients has been found: please supply starting values");
        inp.warn("step size truncated due to divergence");
        let ii = 1;
        while (!Number.isFinite(dev)) {
          if (ii > maxit) throw new Error("inner loop 1; cannot correct step size");
          ii++;
          start = start.map((v, j) => (v + coefold![j]!) / 2);
          eta = matVec(X, start, offset);
          mu = linkinv(eta);
          dev = devianceOf(inp, mu, nan);
        }
        boundary = true;
      }
      if (!valid(eta, mu)) {
        if (coefold === undefined) throw new RangeError("no valid set of coefficients has been found: please supply starting values");
        inp.warn("step size truncated: out of bounds");
        let ii = 1;
        while (!valid(eta, mu)) {
          if (ii > maxit) throw new Error("inner loop 2; cannot correct step size");
          ii++;
          start = start.map((v, j) => (v + coefold![j]!) / 2);
          eta = matVec(X, start, offset);
          mu = linkinv(eta);
        }
        boundary = true;
        dev = devianceOf(inp, mu, nan);
      }
      const relChange = Math.abs(dev - devold) / (Math.abs(dev) + 0.1);
      let done = relChange < epsilon;
      if (inp.toRounding) {
        let d = 0;
        let m = 1;
        for (let j = 0; j < nvars; j++) {
          d = Math.max(d, prevStart === undefined ? Infinity : Math.abs(start[j]! - prevStart[j]!));
          m = Math.max(m, Math.abs(start[j]!));
        }
        const step = d / m;
        done = step <= 4 * Number.EPSILON || (Number.isFinite(prevStep) && step >= prevStep && relChange < 1e-12);
        prevStep = step;
        prevStart = start;
      }
      if (done) {
        conv = true;
        coef = start;
        break;
      }
      devold = dev;
      coef = coefold = start;
    }
    if (iter > maxit) iter = maxit;
    if (!conv) inp.warn("glm.fit: algorithm did not converge");
    if (boundary) inp.warn("glm.fit: algorithm stopped at boundary value");
    const eps10 = 10 * Number.EPSILON;
    if (fam.family === "binomial" && mu.some((m) => m > 1 - eps10 || m < eps10)) inp.warn("glm.fit: fitted probabilities numerically 0 or 1 occurred");
    if (fam.family === "poisson" && mu.some((m) => m < eps10)) inp.warn("glm.fit: fitted rates numerically 0 occurred");
  }
  const rank = nvars === 0 ? 0 : q.rank;
  const aliased = new Array<boolean>(nvars).fill(false);
  for (let k = rank; k < nvars; k++) aliased[q.pivot[k]!] = true;
  const residuals = y.map((v, i) => (v - mu[i]!) / link.muEta(eta[i]!));
  const w = new Array<number>(nobs).fill(0);
  let k = 0;
  for (let i = 0; i < nobs; i++) if (good[i]) w[i] = wGood[k++]! ** 2;
  const wtdmu = inp.intercept ? sumOf(y.map((v, i) => weights[i]! * v)) / sumOf(weights) : NaN;
  let nulldev = 0;
  for (let i = 0; i < nobs; i++) nulldev += fam.devResid(y[i]!, inp.intercept ? wtdmu : link.linkinv(offset[i]!), weights[i]!, nan);
  const nOk = nobs - weights.filter((v) => v === 0).length;
  const aic = fam.aic(y, inp.n, mu, weights, dev, inp.warn) + 2 * rank;
  return {
    coef,
    aliased,
    eta,
    mu,
    dev,
    nulldev,
    aic,
    rank,
    iter,
    conv,
    boundary,
    qr: q,
    w,
    residuals,
    dfResidual: nOk - rank,
    dfNull: nOk - (inp.intercept ? 1 : 0),
  };
}

function toRows(x: MatrixInput | Sample): number[][] {
  return x.length > 0 && typeof x[0] !== "number" ? (x as MatrixInput).map((r) => Array.from(r)) : Array.from(x as Sample, (v) => [v]);
}

/**
 * Fit a generalized linear model by iteratively reweighted least squares. Equivalent to R's `glm(y ~ x, family)` (or
 * `y ~ x - 1` without intercept, with `weights`, `offset`, `start` and `glm.control(epsilon, maxit)`); the predictors
 * are given as a matrix instead of a formula. Rows with a missing value in `x`, `y`, the weights or the offset are
 * dropped. The coefficients, the deviance and everything that follows from them agree with R's, including the
 * iterations at which R stops; R's warnings (non-convergence, the boundary, fitted probabilities of 0 or 1, ...) are
 * returned in `warnings` instead of being printed.
 *
 * @param x Predictors: a matrix (array of rows, one column per predictor) or a vector (one predictor).
 * @param y Response. For the binomial families, proportions of successes (with the numbers of trials as `weights`),
 *   0/1 values, or a two-column matrix of numbers of successes and failures.
 *
 * @example
 * ```ts
 * const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
 * fit.coefficients; // [intercept, slope] on the logit scale
 * glmSummary(fit).coefTable; // estimates, standard errors, z values, p-values
 * ```
 */
export function glm(x: MatrixInput | Sample, y: Sample | MatrixInput, options: GlmOptions = {}): GlmResult {
  const intercept = options.intercept ?? true;
  const epsilon = options.epsilon ?? 1e-8;
  const maxit = options.maxit ?? 25;
  if (!(epsilon > 0)) throw new RangeError("value of 'epsilon' must be > 0");
  if (!(maxit > 0)) throw new RangeError("maximum number of iterations must be > 0");
  const familySpec: GlmFamilySpec = typeof options.family === "object" ? { ...options.family } : { family: options.family ?? "gaussian" };
  if (options.link !== undefined) familySpec.link = options.link;
  const warnings = new Warnings();
  const fam = resolveFamily(familySpec, undefined, () => warnings.add("NaNs produced"));
  const xr = toRows(x);
  const yIsMatrix = y.length > 0 && typeof y[0] !== "number";
  const yr: (number | number[])[] = yIsMatrix ? (y as MatrixInput).map((r) => Array.from(r)) : Array.from(y as Sample);
  if (xr.length !== yr.length) throw new RangeError("variable lengths differ (found for 'x')");
  const wsAll = options.weights === undefined ? undefined : Array.from(options.weights);
  if (wsAll !== undefined && wsAll.length !== yr.length) throw new RangeError("variable lengths differ (found for '(weights)')");
  const offAll = options.offset === undefined ? undefined : Array.from(options.offset);
  if (offAll !== undefined && offAll.length !== yr.length) throw new RangeError("variable lengths differ (found for '(offset)')");
  const keep = yr.map(
    (v, i) =>
      (typeof v === "number" ? !Number.isNaN(v) : v.every((t) => !Number.isNaN(t))) &&
      xr[i]!.every((t) => !Number.isNaN(t)) &&
      (wsAll === undefined || !Number.isNaN(wsAll[i]!)) &&
      (offAll === undefined || !Number.isNaN(offAll[i]!)),
  );
  const X = xr.filter((_, i) => keep[i]).map((r) => (intercept ? [1, ...r] : r));
  const Y = yr.filter((_, i) => keep[i]);
  const nobs = Y.length;
  if (nobs === 0) throw new RangeError("0 (non-NA) cases");
  const prior = wsAll?.filter((_, i) => keep[i]) ?? new Array<number>(nobs).fill(1);
  if (prior.some((w) => w < 0)) throw new RangeError("negative weights not allowed");
  const offset = offAll?.filter((_, i) => keep[i]);
  const off = offset ?? new Array<number>(nobs).fill(0);
  const start = options.start === undefined ? undefined : Array.from(options.start);
  const ini = initialize(fam, Y as number[] | number[][], prior, start !== undefined, warnings.add);
  const out = glmFitCore({
    X, y: ini.y, weights: ini.weights, offset: off, fam, n: ini.n, mustart: ini.mustart, start, epsilon, maxit, intercept, warn: warnings.add,
  });
  let nullDeviance = out.nulldev;
  if (offset !== undefined && intercept) {
    // with an offset, the null deviance is that of a fitted intercept-only model (R refits it from the fitted values)
    const nullFit = glmFitCore({
      X: X.map(() => [1]), y: ini.y, weights: ini.weights, offset: off, fam, n: ini.n, mustart: out.mu, epsilon, maxit, intercept: true,
      warn: warnings.add,
    });
    if (!nullFit.conv) warnings.add("fitting to calculate the null deviance did not converge -- increase 'maxit'?");
    nullDeviance = nullFit.dev;
  }
  const result: GlmResult = {
    coefficients: out.coef.map((c, j) => (out.aliased[j] ? NaN : c)),
    fittedValues: out.mu,
    linearPredictors: out.eta,
    workingResiduals: out.residuals,
    workingWeights: out.w,
    priorWeights: ini.weights,
    y: ini.y,
    deviance: out.dev,
    nullDeviance,
    aic: out.aic,
    rank: out.rank,
    dfResidual: out.dfResidual,
    dfNull: out.dfNull,
    iter: out.iter,
    converged: out.conv,
    boundary: out.boundary,
    warnings: warnings.list,
    family: { family: fam.family, link: fam.link.name, variance: fam.varianceName },
    intercept,
    modelMatrix: X,
    qr: out.qr,
    control: { epsilon, maxit, familySpec },
  };
  if (offset !== undefined) result.offset = offset;
  return result;
}

/** The resolved family of a fit (warnings of "NaNs produced" go to `warn`). */
export function familyOf(fit: GlmResult, warn: (m: string) => void = () => {}): Family {
  return resolveFamily(fit.control.familySpec, undefined, () => warn("NaNs produced"));
}

/** Options for {@link glmSummary}. */
export interface GlmSummaryOptions {
  /** The dispersion to use instead of the estimate (R's `dispersion`). Default: 1 for binomial and poisson, else the Pearson estimate. */
  dispersion?: number;
}

/** Result of {@link glmSummary}: the quantities of R's `summary(glm)`. */
export interface GlmSummary {
  /** The dispersion: 1 for binomial and poisson, else the Pearson statistic over the residual degrees of freedom (NaN for 0 of them). */
  dispersion: number;
  /** The coefficient table of the columns that are not aliased, in their order. */
  coefTable: { estimate: number[]; stdError: number[]; statistic: number[]; pValue: number[] };
  /** `"z value"` when the dispersion is fixed (normal p-values), `"t value"` when it is estimated (t on the residual degrees of freedom). */
  statisticName: "z value" | "t value";
  /** (X'WX)^-1 of the columns that are not aliased (R's `cov.unscaled`). */
  covUnscaled: number[][];
  /** The covariance of the estimates, dispersion × covUnscaled (R's `cov.scaled`). */
  covScaled: number[][];
  dfResidual: number;
  deviance: number;
  nullDeviance: number;
  aic: number;
  /** R's warnings of summary.glm (zero weights when the dispersion is estimated). */
  warnings: string[];
}

function estimateDispersion(fit: GlmResult, warn: (m: string) => void): number {
  if (fit.dfResidual <= 0) return NaN;
  if (fit.workingWeights.some((w) => w === 0)) warn("observations with zero weight not used for calculating dispersion");
  let s = 0;
  fit.workingWeights.forEach((w, i) => {
    if (w > 0) s += w * fit.workingResiduals[i]! ** 2;
  });
  return s / fit.dfResidual;
}

/** The dispersion used by summary.glm: given, fixed at 1, or the Pearson estimate. */
export function dispersionOf(fit: GlmResult, dispersion: number | undefined, warn: (m: string) => void = () => {}): { dispersion: number; estimated: boolean } {
  if (dispersion !== undefined) return { dispersion, estimated: false };
  const f = fit.family.family;
  if (f === "binomial" || f === "poisson") return { dispersion: 1, estimated: false };
  return { dispersion: estimateDispersion(fit, warn), estimated: true };
}

/** (R'R)^-1 of the leading rank × rank block of the QR decomposition (pivot order). */
function covUnscaledOf(fit: GlmResult): number[][] {
  const p = fit.rank;
  if (p === 0) return [];
  return chol2inv(fit.qr.qr.slice(0, p).map((r) => r.slice(0, p)));
}

/**
 * The coefficient table and the other quantities of R's `summary()` for a {@link glm} fit: the dispersion, standard
 * errors, z or t statistics and their p-values, and the unscaled and scaled covariance of the estimates.
 */
export function glmSummary(fit: GlmResult, options: GlmSummaryOptions = {}): GlmSummary {
  const warnings = new Warnings();
  const { dispersion, estimated } = dispersionOf(fit, options.dispersion, warnings.add);
  const p = fit.rank;
  const covUnscaled = covUnscaledOf(fit);
  const piv = fit.qr.pivot.slice(0, p);
  const estimate = piv.map((j) => fit.coefficients[j]!);
  const stdError = covUnscaled.map((r, k) => Math.sqrt(dispersion * r[k]!));
  const statistic = estimate.map((e, k) => e / stdError[k]!);
  const pValue = statistic.map((t) =>
    !estimated ? 2 * pnorm1(-Math.abs(t), 0, 1, true, false) : fit.dfResidual > 0 ? 2 * pt1(-Math.abs(t), fit.dfResidual, true, false) : NaN,
  );
  return {
    dispersion,
    coefTable: { estimate, stdError, statistic, pValue },
    statisticName: estimated ? "t value" : "z value",
    covUnscaled,
    covScaled: covUnscaled.map((r) => r.map((v) => v * dispersion)),
    dfResidual: fit.dfResidual,
    deviance: fit.deviance,
    nullDeviance: fit.nullDeviance,
    aic: fit.aic,
    warnings: warnings.list,
  };
}

/** Kinds of residuals of {@link glmResiduals}. */
export type GlmResidualType = "deviance" | "pearson" | "working" | "response";

/**
 * Residuals of a {@link glm} fit. Equivalent to R's `residuals(fit, type)`: `"deviance"` (the default, signed square
 * roots of the deviance contributions), `"pearson"` ((y - mu) sqrt(prior weight / V(mu))), `"working"` and
 * `"response"` (y - mu).
 */
export function glmResiduals(fit: GlmResult, type: GlmResidualType = "deviance"): number[] {
  const { y, fittedValues: mu, priorWeights: wt } = fit;
  switch (type) {
    case "working":
      return fit.workingResiduals.slice();
    case "response":
      return y.map((v, i) => v - mu[i]!);
    case "pearson": {
      const fam = familyOf(fit);
      return y.map((v, i) => ((v - mu[i]!) * Math.sqrt(wt[i]!)) / Math.sqrt(fam.variance(mu[i]!)));
    }
    case "deviance": {
      const fam = familyOf(fit);
      return y.map((v, i) => {
        const d = Math.sqrt(Math.max(fam.devResid(v, mu[i]!, wt[i]!, () => {}), 0));
        return v > mu[i]! ? d : -d;
      });
    }
    default:
      throw new RangeError(`invalid residual type '${String(type)}'`);
  }
}

/** Options for {@link glmInfluence}. */
export interface GlmInfluenceOptions {
  /** Residuals standardized by `rstandard`: `"deviance"` (default) or `"pearson"`. */
  type?: "deviance" | "pearson";
  /** The dispersion to use instead of summary's. */
  dispersion?: number;
}

/**
 * Influence measures of a {@link glm} fit, for the rows of non-zero prior weight: the leverages (R's `hatvalues`), the
 * standardized residuals (R's `rstandard`) and Cook's distances (R's `cooks.distance`). The leverages are the
 * diagonal of the hat matrix of the weighted least squares problem of the last iteration.
 */
export function glmInfluence(
  fit: GlmResult,
  options: GlmInfluenceOptions = {},
): { hatvalues: number[]; rstandard: number[]; cooksDistance: number[] } {
  const keep = fit.priorWeights.map((w) => w !== 0);
  const nGood = fit.workingWeights.filter((w) => w > 0).length;
  if (keep.filter(Boolean).length !== nGood) throw new Error("non-NA residual length does not match cases used in fitting");
  const p = fit.rank;
  // hat = row sums of squares of the first p columns of Q
  const hat = new Array<number>(nGood).fill(0);
  for (let k = 0; k < p; k++) {
    const e = new Array<number>(nGood).fill(0);
    e[k] = 1;
    const qk = qrQy(fit.qr, e);
    for (let i = 0; i < nGood; i++) hat[i]! += qk[i]! ** 2;
  }
  for (let i = 0; i < nGood; i++) if (hat[i]! >= 1 - 10 * Number.EPSILON) hat[i] = 1;
  const dev = glmResiduals(fit, "deviance").filter((_, i) => keep[i]);
  // lm.influence sets residuals that are rounding residue to 0
  const absDev = dev.map(Math.abs).sort((a, b) => a - b);
  const m = absDev.length;
  const median = m === 0 ? NaN : m % 2 === 1 ? absDev[(m - 1) / 2]! : (absDev[m / 2 - 1]! + absDev[m / 2]!) / 2;
  const devRes = dev.map((v) => (Math.abs(v) < 100 * Number.EPSILON * median ? 0 : v));
  const pear = glmResiduals(fit, "pearson").filter((_, i) => keep[i]);
  const disp = options.dispersion ?? dispersionOf(fit, undefined).dispersion;
  const res = options.type === "pearson" ? pear : devRes;
  const infToNaN = (v: number): number => (v === Infinity || v === -Infinity ? NaN : v);
  const rstandard = res.map((r, i) => infToNaN(r / Math.sqrt(disp * (1 - hat[i]!))));
  const cooksDistance = pear.map((r, i) => infToNaN((r / (1 - hat[i]!)) ** 2 * (hat[i]! / (disp * p))));
  return { hatvalues: hat, rstandard, cooksDistance };
}

/** Options for {@link glmPredict}. */
export interface GlmPredictOptions {
  /** `"link"` (default; the linear predictor) or `"response"` (the mean). */
  type?: "link" | "response";
  /** Offset for `newdata` (required when the model has an offset). */
  offset?: Sample;
  /** The dispersion to use instead of summary's, for the standard errors. */
  dispersion?: number;
}

/**
 * Predictions of a {@link glm} fit with standard errors. Equivalent to R's `predict(fit, newdata, type, se.fit =
 * TRUE)`: on the scale of the linear predictor (`type: "link"`) with standard errors sqrt(dispersion x'(X'WX)^-1 x),
 * or of the mean (`type: "response"`) with these multiplied by |d mu / d eta|. Without `newdata`, at the rows of the
 * data. Aliased columns are left out, as R does.
 *
 * @param newdata New predictor values, with the columns of `x` (no column of ones).
 */
export function glmPredict(fit: GlmResult, newdata?: MatrixInput | Sample, options: GlmPredictOptions = {}): { fit: number[]; seFit: number[] } {
  let X: number[][];
  let offset: number[];
  if (newdata === undefined) {
    X = fit.modelMatrix;
    offset = fit.offset ?? X.map(() => 0);
  } else {
    X = toRows(newdata).map((r) => (fit.intercept ? [1, ...r] : r));
    const ncol = fit.coefficients.length;
    if (X.some((r) => r.length !== ncol)) throw new RangeError(`'newdata' must have ${ncol - (fit.intercept ? 1 : 0)} columns`);
    if (fit.offset !== undefined && options.offset === undefined) throw new TypeError("the model has an offset: supply 'offset' for 'newdata'");
    offset = options.offset === undefined ? X.map(() => 0) : Array.from(options.offset);
    if (offset.length !== X.length) throw new RangeError("'offset' must have one value for each row of 'newdata'");
  }
  const p = fit.rank;
  const piv = fit.qr.pivot.slice(0, p);
  const R = fit.qr.qr;
  const disp = options.dispersion ?? dispersionOf(fit, undefined).dispersion;
  const eta = X.map((r, i) => {
    let s = 0;
    for (const j of piv) s += r[j]! * fit.coefficients[j]!;
    return s + offset[i]!;
  });
  // se: || R^-T x_piv || sqrt(dispersion), by forward substitution with R^T
  const se = X.map((r) => {
    const z = new Array<number>(p).fill(0);
    let ss = 0;
    for (let i = 0; i < p; i++) {
      let s = r[piv[i]!]!;
      for (let k = 0; k < i; k++) s -= R[k]![i]! * z[k]!;
      z[i] = s / R[i]![i]!;
      ss += z[i]! * z[i]!;
    }
    return Math.sqrt(ss * disp);
  });
  if ((options.type ?? "link") === "link") return { fit: eta, seFit: se };
  const link = familyOf(fit).link;
  return { fit: eta.map((e) => link.linkinv(e)), seFit: se.map((s, i) => s * Math.abs(link.muEta(eta[i]!))) };
}
