// forecast's Arima, forecast() for ARIMA fits, the Box-Cox transformation and ndiffs. Written for rStats.js from the
// behaviour specification oracle/tsmeta-behaviour.md ("forecast's Arima and forecast()", "Simple methods and small
// functions", "ndiffs, nsdiffs, ocsb.test") with the details found in experiments/tsmeta120-log.md (items 5, 29-30,
// 39-41). No R or package source was read.

import { arima, predictArima, type ArimaResult } from "./arima.js";
import { optimize } from "../numerics/integrate.js";
import { lm } from "../models/lm.js";
import { qnorm } from "../distributions/normal.js";

// ---------------------------------------------------------------------------------------------------------------
// Box-Cox

/**
 * The Box-Cox transformation: log(x) for lambda = 0, (sign(x) |x|^lambda - 1) / lambda otherwise. Equivalent to
 * forecast's `BoxCox()`.
 *
 * @category Time series
 */
export function boxCox(x: readonly number[], lambda: number): number[] {
  return x.map((v) => (lambda === 0 ? Math.log(v) : (Math.sign(v) * Math.abs(v) ** lambda - 1) / lambda));
}

/**
 * The inverse Box-Cox transformation (sign-preserving where lambda z + 1 < 0), with forecast's bias adjustment when
 * `fvar` (the forecast variances on the transformed scale) is given and `biasadj` is true. Equivalent to forecast's
 * `InvBoxCox()`.
 *
 * @category Time series
 */
export function invBoxCox(z: readonly number[], lambda: number, options: { biasadj?: boolean; fvar?: number | readonly number[] } = {}): number[] {
  const base = z.map((v) => {
    if (lambda === 0) return Math.exp(v);
    const t = lambda * v + 1;
    return Math.sign(t) * Math.abs(t) ** (1 / lambda);
  });
  if (!options.biasadj || options.fvar === undefined) return base;
  const fv = options.fvar;
  return base.map((b, i) => {
    const v = typeof fv === "number" ? fv : fv[i]!;
    return b * (1 + (v * (1 - lambda)) / (2 * (lambda * z[i]! + 1) ** 2));
  });
}

/**
 * Chooses the Box-Cox lambda by Guerrero's method (default) or the profile log-likelihood. Equivalent to forecast's
 * `BoxCox.lambda()`.
 *
 * @category Time series
 */
export function boxCoxLambda(x: readonly number[], options: { method?: "guerrero" | "loglik"; lower?: number; upper?: number; frequency?: number } = {}): number {
  const lower = options.lower ?? -1, upper = options.upper ?? 2; const m = options.frequency ?? 1;
  const xs = x.filter(Number.isFinite);
  if ((options.method ?? "guerrero") === "guerrero") {
    // groups of length max(2, m) taken from the end, the coefficient of variation of sd / mean^(1 - lambda) (log 29-30)
    const len = Math.max(2, m); const ng = Math.floor(xs.length / len); const tail = xs.slice(xs.length - ng * len);
    const mu: number[] = [], sd: number[] = [];
    for (let g = 0; g < ng; g++) {
      const v = tail.slice(g * len, (g + 1) * len); const mean = v.reduce((a, b) => a + b, 0) / len;
      mu.push(mean); sd.push(Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (len - 1)));
    }
    const cv = (lam: number): number => {
      const r = sd.map((s, i) => s / mu[i]! ** (1 - lam)); const mean = r.reduce((a, b) => a + b, 0) / r.length;
      const s2 = r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1);
      return Math.sqrt(s2) / mean;
    };
    return optimize(cv, lower, upper).optimum;
  }
  // the profile log-likelihood of lm on a trend (+ seasonal dummies), maximised on the grid seq(lower, upper, 0.05)
  const n = xs.length; const rows = xs.map((_, t) => {
    const r = [t + 1];
    if (m > 1) for (let k = 2; k <= m; k++) r.push(t % m === k - 1 ? 1 : 0);
    return r;
  });
  const sumLog = xs.reduce((a, b) => a + Math.log(b), 0);
  const pll = (lam: number): number => {
    const z = boxCox(xs, lam); const f = lm(rows, z, {}); const sse = f.residuals.reduce((a, b) => a + b * b, 0);
    return (-n / 2) * Math.log(sse / n) + (lam - 1) * sumLog;
  };
  let best = lower, bestV = -Infinity;
  const steps = Math.round((upper - lower) / 0.05);
  for (let i = 0; i <= steps; i++) { const lam = lower + 0.05 * i; const v = pll(lam); if (v > bestV) { bestV = v; best = lam; } }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------
// Arima

/** Options of {@link forecastArima}. */
export interface ForecastArimaOptions {
  order?: readonly [number, number, number];
  seasonal?: readonly [number, number, number];
  frequency?: number;
  xreg?: readonly (readonly number[])[];
  xregNames?: readonly string[];
  includeMean?: boolean;
  includeDrift?: boolean;
  includeConstant?: boolean;
  /** A Box-Cox lambda, or "auto" for {@link boxCoxLambda}. */
  lambda?: number | "auto";
  biasadj?: boolean;
  method?: "CSS-ML" | "ML" | "CSS";
}

/** Result of {@link forecastArima}: stats' fit plus forecast's quantities. */
export interface ForecastArimaResult extends ArimaResult {
  /** forecast's innovations variance: sum of squared residuals / (nobs - number of coefficients). */
  sigma2: number;
  /** stats' MLE of the innovations variance. */
  sigma2Mle: number;
  aicc: number;
  bic: number;
  lambda: number | null;
  biasadj: boolean;
  /** Fitted values on the original scale. */
  fitted: number[];
  /** The series on the original scale. */
  series: number[];
  /** Whether a drift column was added (the last regressor). */
  drift: boolean;
}

/**
 * Fits an ARIMA model as forecast's `Arima()`: stats' arima on the Box-Cox transformed series, with a drift, and
 * forecast's innovations variance, AICc and BIC.
 *
 * @category Time series
 */
export function forecastArima(y: readonly number[], options: ForecastArimaOptions = {}): ForecastArimaResult {
  const order = options.order ?? [0, 0, 0]; const seasonal = options.seasonal ?? [0, 0, 0];
  const frequency = options.frequency ?? 1;
  const lambda = options.lambda === "auto" ? boxCoxLambda(y, { frequency }) : options.lambda ?? null;
  const z = lambda === null ? y.slice() : boxCox(y, lambda);
  const dd = order[1] + seasonal[1];
  let includeMean = options.includeMean ?? true; let drift = options.includeDrift ?? false;
  if (options.includeConstant === true) { if (dd === 0) includeMean = true; else if (dd === 1) drift = true; }
  else if (options.includeConstant === false) { includeMean = false; drift = false; }
  if (dd > 0) includeMean = false;
  if (dd > 1) drift = false;
  const n = y.length;
  const xreg = [...(options.xreg ?? []).map((c) => c.slice())]; const names = [...(options.xregNames ?? (xreg.length === 1 ? ["xreg"] : xreg.map((_, i) => `xreg${i + 1}`)))];
  if (drift) { xreg.push(Array.from({ length: n }, (_, i) => i + 1)); names.push("drift"); }
  const fit = arima(z, { order, seasonal: { order: seasonal, period: frequency }, frequency, includeMean, method: options.method ?? "CSS-ML",
    ...(xreg.length ? { xreg, xregNames: names } : {}) });
  const ncoef = fit.coef.length;
  // forecast's sigma2: the sum of all squared residuals (the first d + sD included) / (nobs - coefficients) (log 5)
  const raw = fit.residuals;
  const sigma2 = raw.reduce((a, v) => (Number.isNaN(v) ? a : a + v * v), 0) / (fit.nobs - ncoef);
  const npar = fit.mask.filter(Boolean).length + 1; const nstar = fit.nobs;
  const aicc = fit.aic + (2 * npar * (npar + 1)) / (nstar - npar - 1);
  const bic = fit.aic + npar * (Math.log(nstar) - 2);
  const fittedZ = z.map((v, i) => v - raw[i]!);
  const biasadj = options.biasadj ?? false;
  const fitted = lambda === null ? fittedZ : invBoxCox(fittedZ, lambda, { biasadj, fvar: sigma2 });
  return { ...fit, residuals: raw, sigma2, sigma2Mle: fit.sigma2, aicc, bic, lambda, biasadj, fitted, series: y.slice(), drift };
}

/** Result of {@link forecast}. */
export interface ForecastResult {
  mean: number[];
  lower: number[][];
  upper: number[][];
  level: number[];
  method: string;
  /** Forecast standard errors on the transformed scale (where analytic). */
  se?: number[];
}

/**
 * Point forecasts and prediction intervals from a {@link forecastArima} fit (forecast's `forecast.Arima()`).
 *
 * @category Time series
 */
export function forecastFromArima(fit: ForecastArimaResult, options: { h?: number; level?: readonly number[]; xreg?: readonly (readonly number[])[]; biasadj?: boolean } = {}): ForecastResult {
  const h = options.h ?? (fit.arma[4] > 1 ? 2 * fit.arma[4] : 10); const level = [...(options.level ?? [80, 95])];
  const newx = [...(options.xreg ?? []).map((c) => c.slice())];
  if (fit.drift) newx.push(Array.from({ length: h }, (_, i) => fit.series.length + i + 1));
  const p = predictArima(fit, h, { ...(newx.length ? { newxreg: newx } : {}), sigma2: fit.sigma2 });
  const q = level.map((l) => qnorm(0.5 + l / 200));
  let lower = p.pred.map((m, i) => q.map((qq) => m - qq * p.se[i]!));
  let upper = p.pred.map((m, i) => q.map((qq) => m + qq * p.se[i]!));
  let mean = p.pred;
  const lam = fit.lambda;
  if (lam !== null) {
    const biasadj = options.biasadj ?? fit.biasadj;
    mean = invBoxCox(p.pred, lam, { biasadj, fvar: p.se.map((s) => s * s) });
    lower = lower.map((row) => invBoxCox(row, lam)); upper = upper.map((row) => invBoxCox(row, lam));
  }
  return { mean, lower, upper, level, method: arimaMethodName(fit), se: p.se };
}

function arimaMethodName(fit: ForecastArimaResult): string {
  const [p, q, P, Q, s, d, D] = fit.arma;
  let name = `ARIMA(${p},${d},${q})`;
  if (P + D + Q > 0) name += `(${P},${D},${Q})[${s}]`;
  // with regressors of the caller's (the fixture shows the case without a mean or drift)
  const userRegs = fit.coefNames.length - fit.arma.slice(0, 4).reduce((a, b) => a + b, 0) - (fit.includeMean ? 1 : 0) - (fit.drift ? 1 : 0);
  if (userRegs > 0) return `Regression with ${name} errors`;
  if (fit.drift) name += " with drift"; else if (fit.includeMean) name += " with non-zero mean"; else if (d + D === 0) name += " with zero mean";
  return name;
}

// ---------------------------------------------------------------------------------------------------------------
// ndiffs

const KPSS_TABLE = { level: [0.347, 0.463, 0.574, 0.739], trend: [0.119, 0.146, 0.176, 0.216] };
const KPSS_P = [0.1, 0.05, 0.025, 0.01];

/** The KPSS statistic with a given truncation lag (residuals on 1, or on 1 and t). */
export function kpssStatistic(x: readonly number[], type: "level" | "trend", lag: number): number {
  const n = x.length; let e: number[];
  if (type === "level") { const m = x.reduce((a, b) => a + b, 0) / n; e = x.map((v) => v - m); }
  else e = lm(x.map((_, i) => [i + 1]), x as number[], {}).residuals;
  let v = e.reduce((a, b) => a + b * b, 0) / n;
  for (let s = 1; s <= lag; s++) { let c = 0; for (let t = s; t < n; t++) c += e[t]! * e[t - s]!; v += (2 * (1 - s / (lag + 1)) * c) / n; }
  let cum = 0, sum = 0; for (const ei of e) { cum += ei; sum += cum * cum; }
  return sum / (n * n * v);
}

/** The KPSS table's p-value, linear in the statistic between the 10%, 5%, 2.5%, 1% points, clamped to [0.01, 0.10]. */
export function kpssPValue(stat: number, type: "level" | "trend"): number {
  const T = KPSS_TABLE[type];
  if (stat <= T[0]!) return 0.1;
  if (stat >= T[3]!) return 0.01;
  for (let i = 0; i < 3; i++) if (stat <= T[i + 1]!) return KPSS_P[i]! + ((KPSS_P[i + 1]! - KPSS_P[i]!) * (stat - T[i]!)) / (T[i + 1]! - T[i]!);
  return 0.01;
}

// Dickey-Fuller critical values by size class n <= 25, 50, 100, 250, 500, more (1%, 5%, 10%; Fuller 1976)
const DF_SIZES = [25, 50, 100, 250, 500, Infinity];
const TAU_MU = [[-3.75, -3.58, -3.51, -3.46, -3.44, -3.43], [-3.0, -2.93, -2.89, -2.88, -2.87, -2.86], [-2.63, -2.6, -2.58, -2.57, -2.57, -2.57]];
const TAU_TAU = [[-4.38, -4.15, -4.04, -3.99, -3.98, -3.96], [-3.6, -3.5, -3.45, -3.43, -3.42, -3.41], [-3.24, -3.18, -3.15, -3.13, -3.13, -3.12]];

function dfPValue(stat: number, n: number, type: "level" | "trend"): number {
  const row = DF_SIZES.findIndex((b) => n <= b); const tab = type === "level" ? TAU_MU : TAU_TAU;
  const c = [tab[0]![row]!, tab[1]![row]!, tab[2]![row]!]; const P = [0.01, 0.05, 0.1];
  if (stat <= c[0]!) return 0.01;
  if (stat >= c[2]!) return 0.1;
  for (let k = 0; k < 2; k++) if (stat <= c[k + 1]!) return P[k]! + ((P[k + 1]! - P[k]!) * (stat - c[k]!)) / (c[k + 1]! - c[k]!);
  return 0.1;
}

// MacKinnon's (1991) response surfaces b0 + b1/N + b2/N^2 for the 1%, 5%, 10% points (constant; constant and trend):
// R's ndiffs(test = "pp") interpolates in urca's ur.pp critical values, which equal these at N = n - 1 (log 85: 0
// difference in 80 series)
const MACKINNON = {
  level: [[-3.4335, -5.999, -29.25], [-2.8621, -2.738, -8.36], [-2.5671, -1.438, -4.48]],
  trend: [[-3.9638, -8.353, -47.44], [-3.4126, -4.039, -17.83], [-3.1279, -2.418, -7.58]],
};

function ppPValue(stat: number, n: number, type: "level" | "trend"): number {
  const N = n - 1; const c = MACKINNON[type].map(([b0, b1, b2]) => b0! + b1! / N + b2! / (N * N)); const P = [0.01, 0.05, 0.1];
  if (stat <= c[0]!) return 0.01;
  if (stat >= c[2]!) return 0.1;
  for (let k = 0; k < 2; k++) if (stat <= c[k + 1]!) return P[k]! + ((P[k + 1]! - P[k]!) * (stat - c[k]!)) / (c[k + 1]! - c[k]!);
  return 0.1;
}

/** The t value of the lagged level in the ADF regression with one lagged difference. */
function adfStatisticK1(y: readonly number[], type: "level" | "trend"): number {
  const n = y.length; const rows: number[][] = []; const resp: number[] = [];
  for (let t = 2; t < n; t++) { const r = [y[t - 1]!, y[t - 1]! - y[t - 2]!]; if (type === "trend") r.unshift(t); rows.push(r); resp.push(y[t]! - y[t - 1]!); }
  const f = lm(rows, resp, {}); const j = type === "trend" ? 2 : 1;
  return f.coefTable.tValue[j]!;
}

/** The Phillips-Perron Z(t_alpha) with a constant (y_t on 1, y_{t-1}), lag trunc(4 (n/100)^0.25). */
export function ppStatisticConst(y: readonly number[], type: "level" | "trend"): number {
  const n = y.length; const nn = n - 1; const rows: number[][] = []; const resp: number[] = [];
  for (let t = 1; t < n; t++) { rows.push(type === "trend" ? [t, y[t - 1]!] : [y[t - 1]!]); resp.push(y[t]!); }
  const f = lm(rows, resp, {}); const j = type === "trend" ? 2 : 1;
  const rho = f.coefficients[j]!; const se = f.coefTable.stdError[j]!; const u = f.residuals;
  const l = Math.trunc(4 * (nn / 100) ** 0.25); const su2 = u.reduce((a, b) => a + b * b, 0) / nn;
  let lam = su2; for (let s = 1; s <= l; s++) { let c = 0; for (let t = s; t < nn; t++) c += u[t]! * u[t - s]!; lam += (2 * (1 - s / (l + 1)) * c) / nn; }
  const tr = (rho - 1) / se;
  if (type === "trend") {
    // Phillips and Perron's closed form with a trend (as tseries' pp.test, log 8): det(X'X) of X = (1, t, y_{t-1})
    let s00 = 0, s01 = 0, s02 = 0, s11 = 0, s12 = 0, s22 = 0;
    for (let t = 1; t < n; t++) { const a = t, b = y[t - 1]!; s00 += 1; s01 += a; s02 += b; s11 += a * a; s12 += a * b; s22 += b * b; }
    const det = s00 * (s11 * s22 - s12 * s12) - s01 * (s01 * s22 - s12 * s02) + s02 * (s01 * s12 - s11 * s02);
    return Math.sqrt(su2 / lam) * tr - ((lam - su2) * nn ** 3) / (4 * Math.sqrt(3) * Math.sqrt(det) * Math.sqrt(lam));
  }
  const yl = y.slice(0, n - 1); const ym = yl.reduce((a, b) => a + b, 0) / nn; const sxx = yl.reduce((a, b) => a + (b - ym) ** 2, 0);
  return Math.sqrt(su2 / lam) * tr - ((lam - su2) * nn) / (2 * Math.sqrt(lam) * Math.sqrt(sxx));
}

/**
 * The number of first differences needed for stationarity by a unit root test. Equivalent to forecast's `ndiffs()`.
 *
 * @category Time series
 */
export function ndiffs(x: readonly number[], options: { alpha?: number; test?: "kpss" | "adf" | "pp"; type?: "level" | "trend"; maxD?: number } = {}): number {
  const alpha = options.alpha ?? 0.05; const test = options.test ?? "kpss"; const type = options.type ?? "level"; const maxD = options.maxD ?? 2;
  let y = x.filter(Number.isFinite);
  const isConstant = (v: readonly number[]): boolean => v.every((a) => a === v[0]);
  if (isConstant(y)) return 0;
  let d = 0;
  const dodiff = (v: readonly number[]): boolean => {
    if (test === "kpss") return kpssPValue(kpssStatistic(v, type, Math.trunc((3 * Math.sqrt(v.length)) / 13)), type) < alpha;
    if (test === "adf") return dfPValue(adfStatisticK1(v, type), v.length, type) > alpha;
    return ppPValue(ppStatisticConst(v, type), v.length, type) > alpha;
  };
  while (d < maxD && dodiff(y)) {
    d++; y = y.slice(1).map((v, i) => v - y[i]!);
    if (isConstant(y)) break;
  }
  return d;
}
