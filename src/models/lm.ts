// Linear models with a matrix interface: R's lm (with summary.lm's table), confint and predict.
//
// Written for rStats.js (no ported code). The fit is the QR decomposition of the model matrix (a column of ones
// first unless `intercept` is false, rows scaled by sqrt(weights)) with R's LINPACK pivoting (src/linalg/qr.ts,
// tolerance 1e-7): columns that are linear combinations of earlier ones are moved to the end and get NaN
// coefficients ("aliased"), as in R. The summary follows summary.lm: residual variance rss / (n - rank),
// covariance of the estimates sigma^2 (R'R)^-1 from the triangular factor, t tests on n - rank degrees of freedom,
// R^2 from the (weighted) mean-corrected model sum of squares when there is an intercept, and the overall F test.

import { pf1 } from "../distributions/f.js";
import { pt1, qt1 } from "../distributions/t.js";
import { chol2inv } from "../linalg/chol.js";
import type { MatrixInput } from "../linalg/matrix.js";
import { qr, qrCoef, qrResid, type QR } from "../linalg/qr.js";
import type { Sample } from "../htest/types.js";

/** Options for {@link lm}. */
export interface LmOptions {
  /** Include an intercept (a column of ones before the columns of `x`). Default `true`. */
  intercept?: boolean;
  /** Weights for weighted least squares (positive). */
  weights?: Sample;
}

/** Result of {@link lm}: the fit and the quantities of R's `summary(lm)`. */
export interface LmResult {
  /** Coefficients (intercept first); NaN for aliased columns. */
  coefficients: number[];
  /** Residuals y - fitted (rows with a missing value dropped). */
  residuals: number[];
  fittedValues: number[];
  /** Numerical rank of the model matrix. */
  rank: number;
  /** Residual degrees of freedom, n - rank. */
  dfResidual: number;
  /** The coefficient table of the columns that are not aliased, in their order. */
  coefTable: { estimate: number[]; stdError: number[]; tValue: number[]; pValue: number[] };
  /** Residual standard error. */
  sigma: number;
  rSquared: number;
  adjRSquared: number;
  /** Overall F statistic with its degrees of freedom. */
  fStatistic: { value: number; numdf: number; dendf: number };
  /** p-value of the overall F test. */
  fPValue: number;
  /** Whether the model has an intercept. */
  intercept: boolean;
  /** The QR decomposition of the (weighted) model matrix. */
  qr: QR;
}

/**
 * Fit a linear model by least squares. Equivalent to R's `lm(y ~ x)` (or `y ~ x - 1` without intercept, with
 * `weights` for weighted least squares) together with `summary()`; the predictors are given as a matrix instead of a
 * formula. Rows with a missing value in `x`, `y` or the weights are dropped.
 *
 * @param x Predictors: a matrix (array of rows, one column per predictor) or a vector (one predictor).
 * @param y Response.
 *
 * @example
 * ```ts
 * const fit = lm([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]);
 * fit.coefficients; // [intercept, slope]
 * fit.rSquared;
 * ```
 */
export function lm(x: MatrixInput | Sample, y: Sample, options: LmOptions = {}): LmResult {
  const intercept = options.intercept ?? true;
  const xr: number[][] =
    x.length > 0 && typeof x[0] !== "number" ? (x as MatrixInput).map((r) => Array.from(r)) : Array.from(x as Sample, (v) => [v]);
  const ys = Array.from(y);
  if (xr.length !== ys.length) throw new RangeError("variable lengths differ (found for 'x')");
  const wsAll = options.weights === undefined ? undefined : Array.from(options.weights);
  if (wsAll !== undefined && wsAll.length !== ys.length) throw new RangeError("variable lengths differ (found for '(weights)')");
  if (wsAll?.some((w) => w < 0)) throw new RangeError("missing or negative weights not allowed");
  const keep = ys.map((v, i) => !Number.isNaN(v) && xr[i]!.every((t) => !Number.isNaN(t)) && (wsAll === undefined || !Number.isNaN(wsAll[i]!)));
  const X = xr.filter((_, i) => keep[i]).map((r) => (intercept ? [1, ...r] : r));
  const Y = ys.filter((_, i) => keep[i]);
  const W = wsAll?.filter((_, i) => keep[i]);
  const n = Y.length;

  if (n === 0) throw new RangeError("0 (non-NA) cases");
  const sw = W?.map(Math.sqrt);
  const Xw = sw === undefined ? X : X.map((r, i) => r.map((v) => v * sw[i]!));
  const Yw = sw === undefined ? Y : Y.map((v, i) => v * sw[i]!);
  const q = qr(Xw);
  const rank = q.rank;
  const coefficients = qrCoef(q, Yw);
  // residuals from Q (the part of Q'y beyond the rank), so a saturated model has residuals of exactly 0, as in R
  const rw = qrResid(q, Yw);
  const residuals = sw === undefined ? rw : rw.map((v, i) => v / sw[i]!);
  const fittedValues = Y.map((v, i) => v - residuals[i]!);
  const dfResidual = n - rank;
  const w = W ?? new Array<number>(n).fill(1);
  let rss = 0;
  for (let i = 0; i < n; i++) rss += w[i]! * residuals[i]! ** 2;
  const resvar = rss / dfResidual;
  const sigma = Math.sqrt(resvar);

  // (R'R)^-1 of the leading rank x rank block, in pivot order
  const Rr = q.qr.slice(0, rank).map((row) => row.slice(0, rank));
  const covUnscaled = rank > 0 ? chol2inv(Rr) : [];
  const piv = q.pivot.slice(0, rank);
  const order = piv.map((col, k) => [col, k] as const).sort((a, b) => a[0] - b[0]);
  const estimate = order.map(([col]) => coefficients[col]!);
  const stdError = order.map(([, k]) => Math.sqrt(covUnscaled[k]![k]! * resvar));
  const tValue = estimate.map((e, i) => e / stdError[i]!);
  const pValue = tValue.map((t) => 2 * pt1(-Math.abs(t), dfResidual, true, false));

  let mss = 0;
  if (intercept) {
    const sumw = w.reduce((a, b) => a + b, 0);
    let m = 0;
    for (let i = 0; i < n; i++) m += (w[i]! * fittedValues[i]!) / sumw;
    for (let i = 0; i < n; i++) mss += w[i]! * (fittedValues[i]! - m) ** 2;
  } else for (let i = 0; i < n; i++) mss += w[i]! * fittedValues[i]! ** 2;
  const dfInt = intercept ? 1 : 0;
  const rSquared = mss / (mss + rss);
  const adjRSquared = 1 - (1 - rSquared) * ((n - dfInt) / dfResidual);
  const numdf = rank - dfInt;
  const fValue = mss / numdf / resvar;
  return {
    coefficients,
    residuals,
    fittedValues,
    rank,
    dfResidual,
    coefTable: { estimate, stdError, tValue, pValue },
    sigma,
    rSquared,
    adjRSquared,
    fStatistic: { value: fValue, numdf, dendf: dfResidual },
    fPValue: pf1(fValue, numdf, dfResidual, false, false),
    intercept,
    qr: q,
  };
}

/** Options for {@link confint}. */
export interface ConfintOptions {
  /** Confidence level. Default `0.95`. */
  level?: number;
}

/**
 * Confidence intervals for the coefficients of a linear model (NaN for aliased columns). Equivalent to R's
 * `confint()` for an `lm` fit.
 */
export function confint(fit: LmResult, options: ConfintOptions = {}): { lower: number[]; upper: number[] } {
  const level = options.level ?? 0.95;
  const t = qt1((1 + level) / 2, fit.dfResidual, true, false);
  const { estimate, stdError } = fit.coefTable;
  const lower = fit.coefficients.map(() => NaN);
  const upper = fit.coefficients.map(() => NaN);
  let k = 0;
  fit.coefficients.forEach((c, j) => {
    if (Number.isNaN(c)) return;
    lower[j] = estimate[k]! - t * stdError[k]!;
    upper[j] = estimate[k]! + t * stdError[k]!;
    k++;
  });
  return { lower, upper };
}

/** Options for {@link predict}. */
export interface PredictOptions {
  /** `"none"` (default), `"confidence"` (for the mean response) or `"prediction"` (for a new observation). */
  interval?: "none" | "confidence" | "prediction";
  /** Confidence level of the interval. Default `0.95`. */
  level?: number;
}

/**
 * Predictions of a linear model at new values of the predictors, with standard errors and optionally intervals.
 * Equivalent to R's `predict()` for an `lm` fit (`se.fit = TRUE`). Aliased columns are left out, as R does.
 *
 * @param newdata New predictor values, with the columns of `x` (no column of ones).
 */
export function predict(
  fit: LmResult,
  newdata: MatrixInput | Sample,
  options: PredictOptions = {},
): { fit: number[]; seFit: number[]; lwr?: number[]; upr?: number[] } {
  const rows: number[][] =
    newdata.length > 0 && typeof newdata[0] !== "number"
      ? (newdata as MatrixInput).map((r) => Array.from(r))
      : Array.from(newdata as Sample, (v) => [v]);
  const X = rows.map((r) => (fit.intercept ? [1, ...r] : r));
  const rank = fit.rank;
  const piv = fit.qr.pivot.slice(0, rank);
  const Rr = fit.qr.qr.slice(0, rank).map((row) => row.slice(0, rank));
  const resvar = fit.sigma ** 2;
  const values = X.map((r) => r.reduce((s, v, j) => (Number.isNaN(fit.coefficients[j]!) ? s : s + v * fit.coefficients[j]!), 0));
  // se: || R^-T x_piv || sigma, by forward substitution with R^T
  const seFit = X.map((r) => {
    const z = new Array<number>(rank).fill(0);
    for (let i = 0; i < rank; i++) {
      let s = r[piv[i]!]!;
      for (let k = 0; k < i; k++) s -= Rr[k]![i]! * z[k]!;
      z[i] = s / Rr[i]![i]!;
    }
    return Math.sqrt(z.reduce((a, v) => a + v * v, 0) * resvar);
  });
  const interval = options.interval ?? "none";
  if (interval === "none") return { fit: values, seFit };
  const t = qt1((1 + (options.level ?? 0.95)) / 2, fit.dfResidual, true, false);
  const half = seFit.map((s) => t * Math.sqrt(s * s + (interval === "prediction" ? resvar : 0)));
  return { fit: values, seFit, lwr: values.map((v, i) => v - half[i]!), upr: values.map((v, i) => v + half[i]!) };
}
