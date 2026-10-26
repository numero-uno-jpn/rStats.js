// Linear models: R's lm (with summary.lm's table) from a matrix or from a formula, confint and predict.
//
// Written for rStats.js (no ported code). The fit is the QR decomposition of the model matrix (a column of ones
// first unless `intercept` is false, rows scaled by sqrt(weights)) with R's LINPACK pivoting (src/linalg/qr.ts,
// tolerance 1e-7): columns that are linear combinations of earlier ones are moved to the end and get NaN
// coefficients ("aliased"), as in R. The summary follows summary.lm: residual variance rss / (n - rank),
// covariance of the estimates sigma^2 (R'R)^-1 from the triangular factor, t tests on n - rank degrees of freedom,
// R^2 from the (weighted) mean-corrected model sum of squares when there is an intercept, and the overall F test.
// Rows of weight 0 are left out of the fit and of the counts of observations, but get fitted values (and residuals)
// from the coefficients, as in R. The formula form fits the model matrix of src/models/modelMatrix.ts the same way
// (the same decomposition decides the rank and the aliased columns), recomputes the coefficients, fitted values,
// residuals, effects Q'y and sums of squares in double-double on the columns kept (src/models/ddLeastSquares.ts), and
// keeps what the analyses of variance need (the effects, the model matrix, the terms).

import { pf1 } from "../distributions/f.js";
import { pt1, qt1 } from "../distributions/t.js";
import { chol2inv } from "../linalg/chol.js";
import type { MatrixInput } from "../linalg/matrix.js";
import { qr, qrCoef, qrResid, type QR } from "../linalg/qr.js";
import { ddAdd, ddDiv, ddMul, ddMulNum, ddSub, type DD } from "../special/dd.js";
import { ddLeastSquares, ddSqrtWeights, ddSumSquares } from "./ddLeastSquares.js";
import type { Sample } from "../htest/types.js";
import { parseFormula } from "./formula.js";
import type { DataFrame } from "./modelFrame.js";
import { design, type Design, type ModelMatrixOptions } from "./modelMatrix.js";

/** Options for {@link lm}. */
export interface LmOptions {
  /** Include an intercept (a column of ones before the columns of `x`). Default `true`. */
  intercept?: boolean;
  /** Weights for weighted least squares (non-negative; rows of weight 0 are left out of the fit). */
  weights?: Sample;
}

/** Result of {@link lm}: the fit and the quantities of R's `summary(lm)`. */
export interface LmResult {
  /** Coefficients (intercept first); NaN for aliased columns. */
  coefficients: number[];
  /** Residuals y - fitted (rows with a missing value dropped; rows of weight 0 included). */
  residuals: number[];
  /** Fitted values, one per residual (R's `fitted.values`). */
  fittedValues: number[];
  /** Numerical rank of the model matrix. */
  rank: number;
  /** Residual degrees of freedom, n - rank (n counts the rows of non-zero weight). */
  dfResidual: number;
  /** The coefficient table of the columns that are not aliased, in their order. */
  coefTable: {
    /** Estimates (R's `Estimate`). */
    estimate: number[];
    /** Standard errors (R's `Std. Error`). */
    stdError: number[];
    /** t statistics (R's `t value`). */
    tValue: number[];
    /** Two-sided p-values (R's `Pr(>|t|)`). */
    pValue: number[];
  };
  /** Residual standard error. */
  sigma: number;
  /** R^2; 0 for a model with nothing beyond the intercept, as in R. */
  rSquared: number;
  /** Adjusted R^2; 0 for a model with nothing beyond the intercept, as in R. */
  adjRSquared: number;
  /**
   * Overall F statistic with its degrees of freedom. Absent (as is `fPValue`) when the model has nothing beyond the
   * intercept, where R's `summary(lm)` has no `fstatistic`.
   */
  fStatistic?: {
    /** The F statistic. */
    value: number;
    /** Numerator degrees of freedom (rank minus the intercept). */
    numdf: number;
    /** Denominator degrees of freedom (the residual degrees of freedom). */
    dendf: number;
  };
  /** p-value of the overall F test; absent with `fStatistic`. */
  fPValue?: number;
  /** Whether the model has an intercept. */
  intercept: boolean;
  /** The QR decomposition of the (weighted) model matrix. */
  qr: QR;
}

/** Options of {@link lm} with a formula. */
export interface LmFormulaOptions extends ModelMatrixOptions {
  /** Weights: an array parallel to the rows of `data`, or the name of a numeric column. */
  weights?: Sample | string;
}

/** Result of {@link lm} with a formula: the fit of the model matrix, with the formula's terms. */
export interface LmFormulaResult extends LmResult {
  /** The formula. */
  formula: string;
  /** The response's name. */
  response: string;
  /** Names of the coefficients (the model matrix's column names). */
  coefNames: string[];
  /** The term of each coefficient (0 for the intercept). */
  assign: number[];
  /** Labels of the terms. */
  termLabels: string[];
  /** Degree of each term. */
  order: number[];
  /** The variables of the formula, the response first. */
  variables: string[];
  /** R's factors attribute of the terms (one array per variable, one code per term). */
  factors: number[][];
  /** 0-based indices of the rows of `data` used. */
  rows: number[];
  /** The model matrix (rows used). */
  x: number[][];
  /** The response (rows used). */
  y: number[];
  /** The weights (rows used), if any. */
  weights?: number[];
  /** The effects Q'y of the (weighted) fit, one per row of non-zero weight. */
  effects: number[];
  /** The weighted residual sum of squares. */
  rss: number;
  /** Number of rows of non-zero weight. */
  nObs: number;
  /** Whether this is an `aov` fit. */
  aov: boolean;
  /** R's warnings (from the model matrix and from `summary()`). */
  warnings: string[];
}

/** The formula fit (lm, and aov without Error()) */
export function lmFormulaFit(formula: string, d: Design, aov: boolean): LmFormulaResult {
  const y = d.y;
  if (y === undefined) throw new TypeError("the formula has no response");
  const core = fitLm(d.x, y, d.frame.weights, d.terms.intercept, true);
  const r = core.result;
  const warnings = [...d.warnings];
  if (!aov) {
    // summary.lm: residual variance negligible against the fitted values' mean square and variance
    const f = core.fitRows.map((i) => r.fittedValues[i]!);
    const m = f.reduce((s, v) => s + v, 0) / f.length;
    const v = f.length > 1 ? f.reduce((s, t) => s + (t - m) ** 2, 0) / (f.length - 1) : NaN;
    const resvar = core.rss / r.dfResidual;
    if (Number.isFinite(resvar) && resvar < 1e-30 * (m * m + v)) warnings.push("essentially perfect fit: summary may be unreliable");
  }
  const out: LmFormulaResult = {
    ...r,
    formula,
    response: d.terms.variables[0]!,
    coefNames: d.colNames,
    assign: d.assign,
    termLabels: d.terms.termLabels,
    order: d.terms.order,
    variables: d.terms.variables,
    factors: d.terms.factors,
    rows: d.frame.rows,
    x: d.x,
    y,
    effects: core.effects,
    rss: core.rss,
    nObs: core.fitRows.length,
    aov,
    warnings,
  };
  if (d.frame.weights !== undefined) out.weights = d.frame.weights;
  return out;
}

/**
 * Fit a linear model from a formula. Equivalent to R's `lm(formula, data)`. With `weights` and `contrasts`, and the
 * quantities of `summary()`.
 *
 * The model matrix is that of {@link modelMatrix} (but levels without rows are dropped, as R's
 * `drop.unused.levels`); the fit is that of the matrix form (same pivoting and tolerance), its sums of squares computed
 * in double-double so that data with a large mean keep their accuracy. Rows with a missing value in a variable of the
 * formula or in the weights are dropped (`rows` lists those used).
 *
 * @param formula A formula such as `"y ~ A * B + x"`.
 * @param data The data frame: an object of columns.
 *
 * @example
 * ```ts
 * const fit = lm("y ~ g", { y: [2.1, 3.9, 6.2, 7.8, 10.1, 11.8], g: ["a", "a", "b", "b", "c", "c"] });
 * fit.coefNames;    // ["(Intercept)", "gb", "gc"]
 * fit.coefficients; // [3, 4, 7.95]
 * ```
 */
export function lm(formula: string, data: DataFrame, options?: LmFormulaOptions): LmFormulaResult;
/**
 * Fit a linear model by least squares, the predictors given as a matrix: R's `lm(y ~ x)` (or `y ~ x - 1` without
 * intercept, with `weights` for weighted least squares) together with `summary()`. Rows with a missing value in `x`,
 * `y` or the weights are dropped.
 *
 * @param x Predictors: a matrix (array of rows, one column per predictor) or a vector (one predictor).
 * @param y Response.
 *
 * @example
 * ```ts
 * const fit = lm([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]);
 * fit.coefficients; // [0.05, 1.99]
 * fit.rSquared;     // 0.99731
 * ```
 */
export function lm(x: MatrixInput | Sample, y: Sample, options?: LmOptions): LmResult;
export function lm(x: string | MatrixInput | Sample, y: DataFrame | Sample, options: LmOptions | LmFormulaOptions = {}): LmResult | LmFormulaResult {
  if (typeof x === "string") {
    return lmFormulaFit(x, design(parseFormula(x), y as DataFrame, { ...(options as LmFormulaOptions), dropUnusedLevels: true }), false);
  }
  return lmMatrix(x, y as Sample, options as LmOptions);
}

function lmMatrix(x: MatrixInput | Sample, y: Sample, options: LmOptions): LmResult {
  const intercept = options.intercept ?? true;
  const xr: number[][] =
    x.length > 0 && typeof x[0] !== "number" ? (x as MatrixInput).map((r) => Array.from(r)) : Array.from(x as Sample, (v) => [v]);
  const ys = Array.from(y);
  if (xr.length !== ys.length) throw new RangeError("variable lengths differ (found for 'x')");
  const wsAll = options.weights === undefined ? undefined : Array.from(options.weights);
  if (wsAll !== undefined && wsAll.length !== ys.length) throw new RangeError("variable lengths differ (found for '(weights)')");
  if (wsAll?.some((w) => w < 0)) throw new RangeError("missing or negative weights not allowed");
  const keep = ys.map((v, i) => !Number.isNaN(v) && xr[i]!.every((t) => !Number.isNaN(t)) && (wsAll === undefined || !Number.isNaN(wsAll[i]!)));
  const Xall = xr.filter((_, i) => keep[i]).map((r) => (intercept ? [1, ...r] : r));
  const Yall = ys.filter((_, i) => keep[i]);
  const Wall = wsAll?.filter((_, i) => keep[i]);
  return fitLm(Xall, Yall, Wall, intercept).result;
}

/** The quantities of a fit that the formula interface and the analyses of variance need besides the result */
export interface LmCore {
  result: LmResult;
  /** The rows of non-zero weight (indices into the rows given) */
  fitRows: number[];
  /** The effects Q'y of the (weighted) fit, one per row of non-zero weight (only for a precise fit) */
  effects: number[];
  /** The weighted residual sum of squares */
  rss: number;
}

/**
 * The coefficients, fitted values, residuals, effects and sums of squares of a fit recomputed in double-double on the
 * columns kept by the double-precision decomposition q (its rank and pivoting decide what is aliased)
 */
function preciseFit(Xall: number[][], Yall: number[], Wall: number[] | undefined, fitRows: number[], q: QR, intercept: boolean) {
  const rank = q.rank;
  const piv = q.pivot.slice(0, rank);
  const sw = ddSqrtWeights(Wall === undefined ? undefined : fitRows.map((i) => Wall[i]!), fitRows.length);
  const cols = piv.map((j) => fitRows.map((i, k) => ddMulNum(sw[k]!, Xall[i]![j]!)));
  const { qty, coef } = ddLeastSquares(cols, fitRows.map((i, k) => ddMulNum(sw[k]!, Yall[i]!)));
  const coefficients = Xall[0]?.map(() => NaN) ?? [];
  piv.forEach((j, k) => (coefficients[j] = coef[k]![0]));
  // fitted values x'b of every row (aliased coefficients count as 0)
  const fitted: DD[] = Xall.map((r) => {
    let f: DD = [0, 0];
    piv.forEach((j, k) => (f = ddAdd(f, ddMulNum(coef[k]!, r[j]!))));
    return f;
  });
  const rss = ddSumSquares(qty, rank)[0];
  // model sum of squares (about the weighted mean with an intercept)
  const w = fitRows.map((i) => Wall?.[i] ?? 1);
  let center: DD = [0, 0];
  if (intercept) {
    let sw0: DD = [0, 0];
    let sf: DD = [0, 0];
    fitRows.forEach((i, k) => {
      sw0 = ddAdd(sw0, [w[k]!, 0]);
      sf = ddAdd(sf, ddMulNum(fitted[i]!, w[k]!));
    });
    center = ddDiv(sf, sw0);
  }
  let mss: DD = [0, 0];
  fitRows.forEach((i, k) => {
    const d = ddSub(fitted[i]!, center);
    mss = ddAdd(mss, ddMulNum(ddMul(d, d), w[k]!));
  });
  return {
    coefficients,
    fittedValues: fitted.map((f) => f[0]),
    residuals: fitted.map((f, i) => ddSub([Yall[i]!, 0], f)[0]),
    effects: qty.map((e) => e[0]),
    rss,
    mss: mss[0],
  };
}

/**
 * Least squares on a full model matrix (the column of ones included when `intercept` is true). Rows of weight 0 are
 * left out of the fit and of the counts.
 */
export function fitLm(Xall: number[][], Yall: number[], Wall: number[] | undefined, intercept: boolean, precise = false): LmCore {
  if (Yall.length === 0) throw new RangeError("0 (non-NA) cases");
  // the fit uses the rows of non-zero weight only
  const fitRow = Yall.map((_, i) => Wall === undefined || Wall[i]! !== 0);
  const X = Xall.filter((_, i) => fitRow[i]);
  const Y = Yall.filter((_, i) => fitRow[i]);
  const W = Wall?.filter((_, i) => fitRow[i]);
  const n = Y.length;
  if (n === 0) throw new RangeError("all weights are zero");

  const fitRows = Yall.flatMap((_, i) => (fitRow[i] ? [i] : []));
  const sw = W?.map(Math.sqrt);
  const Xw = sw === undefined ? X : X.map((r, i) => r.map((v) => v * sw[i]!));
  const Yw = sw === undefined ? Y : Y.map((v, i) => v * sw[i]!);
  const q = qr(Xw);
  const rank = q.rank;
  const pf = precise ? preciseFit(Xall, Yall, Wall, fitRows, q, intercept) : undefined;
  const coefficients = pf?.coefficients ?? qrCoef(q, Yw);
  const residuals: number[] = pf?.residuals ?? [];
  const fittedValues: number[] = pf?.fittedValues ?? [];
  const dfResidual = n - rank;
  const w = W ?? new Array<number>(n).fill(1);
  let rss = pf?.rss ?? 0;
  if (pf === undefined) {
    // residuals from Q (the part of Q'y beyond the rank), so a saturated model has residuals of exactly 0, as in R
    const rw = qrResid(q, Yw);
    const fitResiduals = sw === undefined ? rw : rw.map((v, i) => v / sw[i]!);
    // rows of weight 0: fitted values x'b (aliased coefficients count as 0), residuals y - fitted
    let k = 0;
    Yall.forEach((v, i) => {
      if (fitRow[i]) {
        residuals.push(fitResiduals[k]!);
        fittedValues.push(v - fitResiduals[k]!);
        k++;
      } else {
        const fv = Xall[i]!.reduce((s, t, j) => (Number.isNaN(coefficients[j]!) ? s : s + t * coefficients[j]!), 0);
        fittedValues.push(fv);
        residuals.push(v - fv);
      }
    });
    for (let i = 0; i < n; i++) rss += w[i]! * fitResiduals[i]! ** 2;
  }
  const fitted = fittedValues.filter((_, i) => fitRow[i]);
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

  const result: LmResult = {
    coefficients,
    residuals,
    fittedValues,
    rank,
    dfResidual,
    coefTable: { estimate, stdError, tValue, pValue },
    sigma,
    rSquared: 0,
    adjRSquared: 0,
    intercept,
    qr: q,
  };
  const dfInt = intercept ? 1 : 0;
  const numdf = rank - dfInt;
  const core: LmCore = { result, fitRows, effects: pf?.effects ?? [], rss };
  // nothing beyond the intercept: R^2 = 0 and no F test, as in summary.lm
  if (numdf === 0) return core;
  let mss = 0;
  if (pf !== undefined) mss = pf.mss;
  else if (intercept) {
    const sumw = w.reduce((a, b) => a + b, 0);
    let m = 0;
    for (let i = 0; i < n; i++) m += (w[i]! * fitted[i]!) / sumw;
    for (let i = 0; i < n; i++) mss += w[i]! * (fitted[i]! - m) ** 2;
  } else for (let i = 0; i < n; i++) mss += w[i]! * fitted[i]! ** 2;
  result.rSquared = mss / (mss + rss);
  result.adjRSquared = 1 - (1 - result.rSquared) * ((n - dfInt) / dfResidual);
  const fValue = mss / numdf / resvar;
  result.fStatistic = { value: fValue, numdf, dendf: dfResidual };
  result.fPValue = pf1(fValue, numdf, dfResidual, false, false);
  return core;
}

/** Options for {@link confint}. */
export interface ConfintOptions {
  /** Confidence level. Default `0.95`. */
  level?: number;
}

/**
 * Confidence intervals for the coefficients of a linear model (NaN for aliased columns), for an `lm` fit.
 * Equivalent to R's `confint()`.
 *
 * @example
 * ```ts
 * const fit = lm([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]);
 * confint(fit); // { lower: [-0.58036, 1.79994], upper: [0.68036, 2.18006] }
 * confint(fit, { level: 0.9 }).lower; // [-0.41614, 1.84945]
 * ```
 */
export function confint(
  fit: LmResult,
  options: ConfintOptions = {},
): {
  /** Lower limits, one per coefficient (R's first column, `2.5 %` by default). */
  lower: number[];
  /** Upper limits, one per coefficient (R's second column, `97.5 %` by default). */
  upper: number[];
} {
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
 * Predictions of a linear model at new values of the predictors, with standard errors and optionally intervals, for
 * an `lm` fit (`se.fit = TRUE`). Equivalent to R's `predict()`. Aliased columns are left out, as R does.
 *
 * @param newdata New predictor values, with the columns of `x` (no column of ones).
 *
 * @example
 * ```ts
 * const fit = lm([1, 2, 3, 4, 5], [2.1, 3.9, 6.2, 7.8, 10.1]);
 * predict(fit, [6, 7]); // { fit: [11.99, 13.98], seFit: [0.19807, 0.25338] }
 * predict(fit, [6], { interval: "prediction" }); // { lwr: [11.119], upr: [12.861] }
 * ```
 */
export function predict(
  fit: LmResult,
  newdata: MatrixInput | Sample,
  options: PredictOptions = {},
): {
  /** Predicted values, one per row of `newdata`. */
  fit: number[];
  /** Standard errors of the predicted means (R's `se.fit`). */
  seFit: number[];
  /** Lower limits of the intervals (absent with `interval: "none"`). */
  lwr?: number[];
  /** Upper limits of the intervals (absent with `interval: "none"`). */
  upr?: number[];
} {
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
