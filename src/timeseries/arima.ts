// ARIMA models fitted by exact maximum likelihood or conditional sum of squares, and their forecasts: R's
// stats::arima and predict.Arima. Written for rStats.js from the behaviour specification oracle/tsmeta-behaviour.md
// (sections "stats' arima") and the textbooks R's help page cites (Brockwell and Davis 1996; Durbin and Koopman
// 2001; Gardner, Harvey and Phillips 1980; Jones 1980), with the details found in experiments/tsmeta120-log.md
// (items 1-4). No R source was read.
//
// The exact likelihood is computed by a Kalman filter on the state space form
//   state  alpha_t = (ARMA state of dimension r = max(p, q + 1); y_{t-1}, ..., y_{t-nd})
//   y_t    = alpha_t[0] + sum_k delta_k y_{t-k}       (delta from (1 - B)^d (1 - B^s)^D)
// with the stationary ARMA covariance as the initial covariance of the ARMA block and kappa I (kappa = 1e6) for the
// presample values (R's finite diffuse prior; log 2-4). Observations whose prediction variance is at least 1e4 (still
// controlled by that prior) are left out of the likelihood. The innovations variance is concentrated out.

import { optim, optimHess } from "../optim/optim.js";
import { eigen } from "../linalg/eigen.js";

/** Seasonal part of an ARIMA model. */
export interface ArimaSeasonal {
  /** (P, D, Q). Default [0, 0, 0]. */
  order?: readonly [number, number, number];
  /** The period. Default the series' frequency. */
  period?: number;
}

/** Options of {@link arima}. */
export interface ArimaOptions {
  /** (p, d, q). Default [0, 0, 0]. */
  order?: readonly [number, number, number];
  /** The seasonal part (an order, or an order and a period). */
  seasonal?: ArimaSeasonal | readonly [number, number, number];
  /** The series' frequency (the seasonal period by default). Default 1. */
  frequency?: number;
  /** Regressors: one array per regressor, each of the series' length. */
  xreg?: readonly (readonly number[])[];
  /** Names of the regressors. Default "xreg1", "xreg2", ... (or "xreg" for one). */
  xregNames?: readonly string[];
  /** Include a mean (ignored when differenced). Default true. */
  includeMean?: boolean;
  /** Transform the AR parameters to stationarity during the ML optimisation. Default true. */
  transformPars?: boolean;
  /** Fixed values (NaN for the free ones), in the order of the coefficients. */
  fixed?: readonly number[];
  /** Starting values (NaN filled by defaults). */
  init?: readonly number[];
  /** "CSS-ML" (default), "ML" or "CSS". */
  method?: "CSS-ML" | "ML" | "CSS";
  /** Initial observations ignored by CSS (at least the AR lags). */
  nCond?: number;
  /** Prior variance multiple of the presample values in a differenced model. Default 1e6. */
  kappa?: number;
  /** "R" (default): the variance matrix from R's numerical Hessian (agrees with R); "exact": a converged Hessian. */
  hessian?: "R" | "exact";
}

/** The state space model behind a fit, for forecasting. */
export interface ArimaStateModel {
  phi: number[];
  theta: number[];
  delta: number[];
  /** Filtered state and covariance at the end of the series (in units of sigma2). */
  a: number[];
  P: number[][];
}

/** Result of {@link arima}. */
export interface ArimaResult {
  /** The coefficients (AR, MA, seasonal AR, seasonal MA, intercept, regressors). */
  coef: number[];
  /** Their names (ar1, ma1, sar1, sma1, intercept, regressor names). */
  coefNames: string[];
  /** The MLE of the innovations variance (CSS: the mean of the squared CSS residuals). */
  sigma2: number;
  /** The variance matrix of the free coefficients (rows and columns as `coefNames` of the free ones). */
  varCoef: number[][];
  /** The maximised log-likelihood of the differenced data (CSS: R's approximation). */
  loglik: number;
  /** -2 loglik + 2 (free coefficients + 1); NaN for CSS. */
  aic: number;
  /** (p, q, P, Q, period, d, D). */
  arma: [number, number, number, number, number, number, number];
  /** The fitted innovations (standardised one-step errors; NaN at missing values). */
  residuals: number[];
  /** "CSS-ML", "ML" or "CSS". */
  method: "CSS-ML" | "ML" | "CSS";
  /** Initial observations not used by CSS. */
  nCond: number;
  /** The number of observations used in the likelihood. */
  nobs: number;
  /** The optimiser's convergence code (0 = converged). */
  code: number;
  /** Mask of the free coefficients. */
  mask: boolean[];
  /** The state space model at the end of the series. */
  model: ArimaStateModel;
  /** The series (as given). */
  x: number[];
  /** The regressors (as given), including no intercept column. */
  xreg: number[][];
  /** Whether a mean was included. */
  includeMean: boolean;
}

// ---------------------------------------------------------------------------------------------------------------
// polynomials and parameter maps

function polyMul(a: readonly number[], b: readonly number[]): number[] {
  const r = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) r[i + j]! += a[i]! * b[j]!;
  return r;
}

/** The full AR and MA coefficients (lags 1..) from the non-seasonal and seasonal ones. */
function expandArma(ar: readonly number[], ma: readonly number[], sar: readonly number[], sma: readonly number[], s: number): { phi: number[]; theta: number[] } {
  const seasonalPoly = (c: readonly number[], sign: number): number[] => {
    const p = new Array<number>(s * c.length + 1).fill(0); p[0] = 1;
    for (let i = 0; i < c.length; i++) p[s * (i + 1)] = sign * c[i]!;
    return p;
  };
  const arPoly = polyMul([1, ...ar.map((v) => -v)], sar.length ? seasonalPoly(sar, -1) : [1]);
  const maPoly = polyMul([1, ...ma], sma.length ? seasonalPoly(sma, 1) : [1]);
  return { phi: arPoly.slice(1).map((v) => -v), theta: maPoly.slice(1) };
}

/** (1 - B)^d (1 - B^s)^D as coefficients of lags 1.. (y_t = sum delta_k y_{t-k} + w_t). */
function differencingDelta(d: number, D: number, s: number): number[] {
  let p = [1];
  for (let i = 0; i < d; i++) p = polyMul(p, [1, -1]);
  for (let i = 0; i < D; i++) { const q = new Array<number>(s + 1).fill(0); q[0] = 1; q[s] = -1; p = polyMul(p, q); }
  return p.slice(1).map((v) => -v);
}

/** AR coefficients from partial autocorrelations (Durbin-Levinson). */
function pacfToAr(r: readonly number[]): number[] {
  let a: number[] = [];
  for (const rk of r) { const prev = a.slice(); a = prev.map((v, i) => v - rk * prev[prev.length - 1 - i]!); a.push(rk); }
  return a;
}

/** Partial autocorrelations from AR coefficients (the inverse recursion); NaN when not stationary. */
function arToPacf(aIn: readonly number[]): number[] {
  let a = aIn.slice(); const p = a.length; const r = new Array<number>(p).fill(0);
  for (let k = p; k >= 1; k--) {
    const rk = a[k - 1]!; r[k - 1] = rk;
    if (Math.abs(rk) >= 1) return r.map(() => NaN);
    if (k > 1) { const denom = 1 - rk * rk; const prev = a.slice(0, k - 1); a = prev.map((v, i) => (v + rk * prev[k - 2 - i]!) / denom); }
  }
  return r;
}

/** The roots' smallest modulus of 1 + c_1 z + ... + c_k z^k (Infinity for a constant). */
export function minRootModulus(c: readonly number[]): number {
  let k = c.length; while (k > 0 && c[k - 1] === 0) k--;
  if (k === 0) return Infinity;
  // companion matrix of z^k + (c_{k-1}/c_k) z^{k-1} + ... + 1/c_k
  const lead = c[k - 1]!; const M: number[][] = [];
  for (let i = 0; i < k; i++) { const row = new Array<number>(k).fill(0); if (i > 0) row[i - 1] = 1; M.push(row); }
  const coef = [1, ...c.slice(0, k - 1)];
  for (let i = 0; i < k; i++) M[i]![k - 1] = -coef[i]! / lead;
  const e = eigen(M, { onlyValues: true }) as { values: number[]; valuesIm?: number[] };
  let m = Infinity;
  for (let i = 0; i < k; i++) m = Math.min(m, Math.hypot(e.values[i]!, e.valuesIm?.[i] ?? 0));
  return m;
}

/** The MA polynomial made invertible by reflecting roots inside the unit circle (R's "converted to invertible"). */
function maInvert(ma: readonly number[]): number[] {
  let q = ma.length; while (q > 0 && ma[q - 1] === 0) q--;
  if (q === 0) return ma.slice();
  const lead = ma[q - 1]!; const M: number[][] = [];
  for (let i = 0; i < q; i++) { const row = new Array<number>(q).fill(0); if (i > 0) row[i - 1] = 1; M.push(row); }
  const coef = [1, ...ma.slice(0, q - 1)];
  for (let i = 0; i < q; i++) M[i]![q - 1] = -coef[i]! / lead;
  const e = eigen(M, { onlyValues: true }) as { values: number[]; valuesIm?: number[] };
  const re = e.values.slice(0, q), im = (e.valuesIm ?? new Array<number>(q).fill(0)).slice(0, q);
  let changed = false;
  for (let i = 0; i < q; i++) { const m2 = re[i]! ** 2 + im[i]! ** 2; if (m2 < 1) { re[i] = re[i]! / m2; im[i] = -im[i]! / m2; changed = true; } }
  if (!changed) return ma.slice();
  // rebuild prod (1 - z / root_i) with complex arithmetic
  let pr = [1], pi = [0];
  for (let i = 0; i < q; i++) {
    const m2 = re[i]! ** 2 + im[i]! ** 2; const ir = re[i]! / m2, ii = -im[i]! / m2; // 1 / root
    const nr = new Array<number>(pr.length + 1).fill(0), nim = new Array<number>(pr.length + 1).fill(0);
    for (let j = 0; j < pr.length; j++) {
      nr[j]! += pr[j]!; nim[j]! += pi[j]!;
      nr[j + 1]! -= pr[j]! * ir - pi[j]! * ii; nim[j + 1]! -= pr[j]! * ii + pi[j]! * ir;
    }
    pr = nr; pi = nim;
  }
  const out = pr.slice(1);
  return [...out, ...ma.slice(q)];
}

// ---------------------------------------------------------------------------------------------------------------
// the Kalman filter

/** Stationary covariance of the ARMA state (Harvey form) per unit innovations variance, by the doubling algorithm. */
function stationaryCovariance(phi: readonly number[], theta: readonly number[], r: number): number[][] {
  const T: number[][] = []; for (let i = 0; i < r; i++) { const row = new Array<number>(r).fill(0); row[0] = phi[i] ?? 0; if (i + 1 < r) row[i + 1] = 1; T.push(row); }
  // note: T as defined maps alpha_{t+1}[i] = phi_{i+1} alpha_t[0] + alpha_t[i+1]
  const Tm: number[][] = []; for (let i = 0; i < r; i++) { const row = new Array<number>(r).fill(0); row[0] = phi[i] ?? 0; if (i + 1 < r) row[i + 1] = 1; Tm.push(row); }
  const R = [1, ...Array.from({ length: r - 1 }, (_, i) => theta[i] ?? 0)];
  let S: number[][] = R.map((a) => R.map((b) => a * b));
  let A = Tm.map((row) => row.slice());
  const mul = (X: number[][], Y: number[][]): number[][] => X.map((row) => Y[0]!.map((_, j) => row.reduce((s, v, k) => s + v * Y[k]![j]!, 0)));
  const tr = (X: number[][]): number[][] => X[0]!.map((_, j) => X.map((row) => row[j]!));
  for (let it = 0; it < 200; it++) {
    const add = mul(mul(A, S), tr(A));
    let maxAdd = 0, maxS = 0;
    S = S.map((row, i) => row.map((v, j) => { maxAdd = Math.max(maxAdd, Math.abs(add[i]![j]!)); const w = v + add[i]![j]!; maxS = Math.max(maxS, Math.abs(w)); return w; }));
    A = mul(A, A);
    if (maxAdd <= 1e-17 * maxS) break;
  }
  void T;
  return S.map((row, i) => row.map((v, j) => (v + S[j]![i]!) / 2));
}

interface FilterResult { ssq: number; sumlog: number; nu: number; resid: number[]; a: number[]; P: number[][]; }

/** Kalman filter of y (NaN missing) for the model; prediction variances in units of sigma2. */
function kalman(y: readonly number[], phi: readonly number[], theta: readonly number[], delta: readonly number[], kappa: number): FilterResult {
  const p = phi.length, q = theta.length; const r = Math.max(p, q + 1); const nd = delta.length; const rd = r + nd;
  const P0 = stationaryCovariance(phi, theta, r);
  let a = new Array<number>(rd).fill(0);
  let P: number[][] = Array.from({ length: rd }, (_, i) => Array.from({ length: rd }, (_, j) => (i < r && j < r ? P0[i]![j]! : i === j ? kappa : 0)));
  const Rv = [1, ...Array.from({ length: r - 1 }, (_, i) => theta[i] ?? 0)];
  const Z = new Array<number>(rd).fill(0); Z[0] = 1; for (let k = 0; k < nd; k++) Z[r + k] = delta[k]!;
  const n = y.length; const resid = new Array<number>(n).fill(NaN);
  let ssq = 0, sumlog = 0, nu = 0;
  const transition = (x: number[]): number[] => {
    const out = new Array<number>(rd).fill(0);
    for (let i = 0; i < r; i++) out[i] = (phi[i] ?? 0) * x[0]! + (i + 1 < r ? x[i + 1]! : 0);
    if (nd > 0) { let z = 0; for (let k = 0; k < rd; k++) z += Z[k]! * x[k]!; out[r] = z; for (let k = 1; k < nd; k++) out[r + k] = x[r + k - 1]!; }
    return out;
  };
  for (let t = 0; t < n; t++) {
    if (t > 0) {
      a = transition(a);
      // P = T P T' + R R' (R only on the ARMA block)
      const TP: number[][] = P.map((_, j) => transition(P.map((row) => row[j]!))); // columns of T P
      const TPT: number[][] = Array.from({ length: rd }, (_, i) => transition(TP.map((col) => col[i]!)));
      P = TPT.map((row, i) => row.map((v, j) => v + (i < r && j < r ? Rv[i]! * Rv[j]! : 0)));
      for (let i = 0; i < rd; i++) for (let j = i + 1; j < rd; j++) { const m = (P[i]![j]! + P[j]![i]!) / 2; P[i]![j] = m; P[j]![i] = m; }
    }
    const yt = y[t]!;
    if (Number.isNaN(yt)) continue;
    let fc = 0; for (let k = 0; k < rd; k++) fc += Z[k]! * a[k]!;
    const PZ = P.map((row) => row.reduce((s, v, k) => s + v * Z[k]!, 0));
    const F = PZ.reduce((s, v, k) => s + v * Z[k]!, 0);
    const v = yt - fc;
    resid[t] = v / Math.sqrt(F);
    if (F < 1e4) { ssq += (v * v) / F; sumlog += Math.log(F); nu++; }
    a = a.map((ak, k) => ak + (PZ[k]! * v) / F);
    P = P.map((row, i) => row.map((pij, j) => pij - (PZ[i]! * PZ[j]!) / F));
  }
  return { ssq, sumlog, nu, resid, a, P };
}

/** CSS residuals of the differenced series w (mean / regression already removed before differencing). */
function cssResiduals(x: readonly number[], phi: readonly number[], theta: readonly number[], delta: readonly number[], nCond: number): { ssq: number; nu: number; resid: number[] } {
  const n = x.length; const nd = delta.length;
  const w = new Array<number>(n).fill(NaN);
  for (let t = 0; t < n; t++) { if (t < nd) continue; let v = x[t]!; for (let k = 0; k < nd; k++) v -= delta[k]! * x[t - k - 1]!; w[t] = v; }
  const e = new Array<number>(n).fill(0); let ssq = 0, nu = 0;
  for (let t = nCond; t < n; t++) {
    let v = w[t]!;
    for (let i = 0; i < phi.length; i++) v -= phi[i]! * (t - i - 1 >= 0 ? w[t - i - 1]! : 0);
    for (let j = 0; j < theta.length; j++) v -= theta[j]! * (t - j - 1 >= 0 ? e[t - j - 1]! : 0);
    e[t] = v;
    if (!Number.isNaN(v)) { ssq += v * v; nu++; } else e[t] = 0;
  }
  const resid = e.map((v, t) => (t < nCond ? 0 : Number.isNaN(w[t]!) ? NaN : v));
  return { ssq, nu, resid };
}

// ---------------------------------------------------------------------------------------------------------------
// the fit

function normalizeSeasonal(opt: ArimaOptions): { P: number; D: number; Q: number; s: number } {
  const seas = opt.seasonal;
  const order = Array.isArray(seas) ? (seas as readonly number[]) : ((seas as ArimaSeasonal | undefined)?.order ?? [0, 0, 0]);
  const period = (!Array.isArray(seas) && (seas as ArimaSeasonal | undefined)?.period) || opt.frequency || 1;
  return { P: order[0]!, D: order[1]!, Q: order[2]!, s: period };
}

/**
 * Fits an ARIMA model by exact maximum likelihood (Kalman filter) or conditional sum of squares. Equivalent to R's
 * `stats::arima()` (the estimates are taken to the optimum, where R's optimiser may stop slightly short).
 *
 * @example
 * ```ts
 * const fit = arima(lh, { order: [1, 0, 0] });
 * fit.coef; // [ar1, intercept]
 * ```
 *
 * @category Time series
 */
export function arima(xIn: readonly number[], options: ArimaOptions = {}): ArimaResult {
  const x = xIn.map((v) => (v === null || v === undefined ? NaN : Number(v)));
  const n = x.length;
  const [p, d, q] = (options.order ?? [0, 0, 0]) as [number, number, number];
  const { P, D, Q, s } = normalizeSeasonal(options);
  const delta = differencingDelta(d, D, s);
  const xreg0 = (options.xreg ?? []).map((col) => col.map(Number));
  const includeMean = (options.includeMean ?? true) && d + D === 0;
  const xreg = includeMean ? [new Array<number>(n).fill(1), ...xreg0] : xreg0;
  const nreg = xreg.length; const narma = p + q + P + Q; const ncoef = narma + nreg;
  const xregNames = options.xregNames ?? (xreg0.length === 1 ? ["xreg"] : xreg0.map((_, i) => `xreg${i + 1}`));
  const coefNames = [...Array.from({ length: p }, (_, i) => `ar${i + 1}`), ...Array.from({ length: q }, (_, i) => `ma${i + 1}`),
    ...Array.from({ length: P }, (_, i) => `sar${i + 1}`), ...Array.from({ length: Q }, (_, i) => `sma${i + 1}`),
    ...(includeMean ? ["intercept"] : []), ...xregNames];
  const fixed = options.fixed ? options.fixed.map(Number) : new Array<number>(ncoef).fill(NaN);
  if (fixed.length !== ncoef) throw new RangeError(`wrong length for 'fixed' (${fixed.length} instead of ${ncoef})`);
  const mask = fixed.map((v) => Number.isNaN(v));
  let method = options.method ?? "CSS-ML";
  if (method === "CSS-ML" && x.some((v) => Number.isNaN(v))) method = "ML"; // R: ML when there are missing values
  const kappa = options.kappa ?? 1e6;
  let transformPars = (options.transformPars ?? true) && method !== "CSS";
  if (transformPars && mask.slice(0, p).some((m) => !m) || transformPars && mask.slice(p + q, p + q + P).some((m) => !m)) transformPars = false;
  const nCondCss = d + D * s + Math.max(options.nCond ?? 0, p + P * s) - (options.nCond !== undefined ? 0 : 0);
  const nCond = Math.max(options.nCond ?? 0, d + D * s + p + P * s);
  void nCondCss;

  // regression starting values: least squares of the differenced series on the differenced regressors
  const init = new Array<number>(ncoef).fill(0);
  if (nreg > 0) {
    const diffed = (v: number[]): number[] => { const out: number[] = []; for (let t = delta.length; t < n; t++) { let z = v[t]!; for (let k = 0; k < delta.length; k++) z -= delta[k]! * v[t - k - 1]!; out.push(z); } return out; };
    const yy = diffed(x); const XX = xreg.map(diffed);
    const ok = yy.map((v, i) => !Number.isNaN(v) && XX.every((c) => !Number.isNaN(c[i]!)));
    const k = XX.length; const A = Array.from({ length: k }, () => new Array<number>(k).fill(0)); const b = new Array<number>(k).fill(0);
    for (let i = 0; i < yy.length; i++) { if (!ok[i]) continue; for (let a1 = 0; a1 < k; a1++) { b[a1]! += XX[a1]![i]! * yy[i]!; for (let a2 = 0; a2 < k; a2++) A[a1]![a2]! += XX[a1]![i]! * XX[a2]![i]!; } }
    const sol = solveSymmetric(A, b);
    for (let i = 0; i < k; i++) init[narma + i] = Number.isFinite(sol[i]!) ? sol[i]! : 0;
  }
  if (options.init) options.init.forEach((v, i) => { if (!Number.isNaN(Number(v))) init[i] = Number(v); });
  for (let i = 0; i < ncoef; i++) if (!mask[i]) init[i] = fixed[i]!;

  const split = (cf: readonly number[]): { ar: number[]; ma: number[]; sar: number[]; sma: number[]; reg: number[] } => ({
    ar: cf.slice(0, p), ma: cf.slice(p, p + q), sar: cf.slice(p + q, p + q + P), sma: cf.slice(p + q + P, narma), reg: cf.slice(narma) });
  const residualSeries = (reg: readonly number[]): number[] => x.map((v, t) => { let z = v; for (let k = 0; k < nreg; k++) z -= reg[k]! * xreg[k]![t]!; return z; });
  // transformed <-> natural parameters
  const toNatural = (u: readonly number[]): number[] => {
    if (!transformPars) return u.slice();
    const out = u.slice();
    if (p > 0) { const a = pacfToAr(u.slice(0, p).map(Math.tanh)); for (let i = 0; i < p; i++) out[i] = a[i]!; }
    if (P > 0) { const a = pacfToAr(u.slice(p + q, p + q + P).map(Math.tanh)); for (let i = 0; i < P; i++) out[p + q + i] = a[i]!; }
    return out;
  };
  const toTransformed = (c: readonly number[]): number[] => {
    if (!transformPars) return c.slice();
    const out = c.slice();
    if (p > 0) { const r = arToPacf(c.slice(0, p)); for (let i = 0; i < p; i++) out[i] = Math.atanh(r[i]!); }
    if (P > 0) { const r = arToPacf(c.slice(p + q, p + q + P)); for (let i = 0; i < P; i++) out[p + q + i] = Math.atanh(r[i]!); }
    return out;
  };
  // the optimiser works on regression coefficients times the regressors' scales (R also rescales regressors), so that
  // the numerical derivatives see comparable sensitivities
  const regScale = xreg.map((col) => { const v = col.filter(Number.isFinite); const m = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, v.length - 1)); return sd > 0 ? sd : Math.max(1e-300, Math.abs(m)) || 1; });
  const full = (free: readonly number[]): number[] => { const out = fixed.slice(); let j = 0; for (let i = 0; i < ncoef; i++) if (mask[i]) out[i] = i >= narma ? free[j++]! / regScale[i - narma]! : free[j++]!; return out; };
  const freeOf = (all: readonly number[]): number[] => all.map((v, i) => (i >= narma ? v * regScale[i - narma]! : v)).filter((_, i) => mask[i]);

  const cssObjective = (cfNat: readonly number[]): number => {
    const { ar, ma, sar, sma, reg } = split(cfNat); const { phi, theta } = expandArma(ar, ma, sar, sma, s);
    const r = cssResiduals(residualSeries(reg), phi, theta, delta, nCond);
    return r.nu > 0 ? 0.5 * Math.log(r.ssq / r.nu) : Infinity;
  };
  const mlObjectiveNat = (cfNat: readonly number[]): number => {
    const { ar, ma, sar, sma, reg } = split(cfNat); const { phi, theta } = expandArma(ar, ma, sar, sma, s);
    if (phi.length && minRootModulus(phi.map((v) => -v)) <= 1) return Infinity;
    const f = kalman(residualSeries(reg), phi, theta, delta, kappa);
    return f.nu > 0 ? 0.5 * Math.log(f.ssq / f.nu) + (0.5 * f.sumlog) / f.nu : Infinity;
  };

  const tightBfgs = (fn: (par: number[]) => number, start: number[]): { par: number[]; code: number } => {
    if (start.length === 0) return { par: [], code: 0 };
    let cur = start.slice(); let code = 0; let last = fn(cur);
    for (let round = 0; round < 6; round++) {
      const r = optim(cur, (v) => { const f = fn(v); return Number.isFinite(f) ? f : 1e300; }, { method: "BFGS", control: { reltol: 1e-15, maxit: 5000 } });
      code = r.convergence; const improved = last - r.value; cur = r.par; last = r.value;
      if (!(improved > 1e-15 * Math.max(1, Math.abs(last)))) break;
    }
    // BFGS with numerical gradients of step 1e-3 (as R) stops about 1e-6 short; finish with Newton steps whose gradient
    // and Hessian are central differences with Richardson extrapolation
    for (let it = 0; it < 30; it++) {
      const g = convergedGradient(fn, cur); const H = convergedHessian(fn, cur);
      const step = solveSymmetric(H.map((r) => r.slice()), g.map((v) => -v));
      if (step.some((v) => !Number.isFinite(v))) break;
      let t = 1, accepted = false;
      while (t > 1e-6) {
        const cand = cur.map((v, i) => v + t * step[i]!); const fc = fn(cand);
        if (Number.isFinite(fc) && fc <= last) { const gain = last - fc; cur = cand; last = fc; accepted = true; if (gain <= 1e-16 * Math.max(1, Math.abs(fc))) it = 1e9; break; }
        t /= 2;
      }
      if (!accepted || Math.max(...step.map(Math.abs)) < 1e-12) break;
    }
    return { par: cur, code };
  };

  let coefNat = init.slice(); let code = 0;
  if (method === "CSS" || method === "CSS-ML") {
    const res = tightBfgs((u) => cssObjective(full(u)), freeOf(coefNat));
    coefNat = full(res.par); code = res.code;
    if (method === "CSS-ML") {
      const { ar, sar } = split(coefNat);
      if ((p > 0 && minRootModulus(ar.map((v) => -v)) <= 1) || (P > 0 && minRootModulus(sar.map((v) => -v)) <= 1))
        throw new Error("non-stationary AR part from CSS");
    }
  }
  let sigma2: number, loglik: number, resid: number[], nobs: number, model: ArimaStateModel;
  if (method === "CSS") {
    const { ar, ma, sar, sma, reg } = split(coefNat); const { phi, theta } = expandArma(ar, ma, sar, sma, s);
    const r = cssResiduals(residualSeries(reg), phi, theta, delta, nCond);
    sigma2 = r.ssq / r.nu;
    nobs = x.filter((v) => !Number.isNaN(v)).length - delta.length;
    loglik = -0.5 * nobs * (Math.log(2 * Math.PI * sigma2) + 1);
    resid = r.resid;
    const f = kalman(residualSeries(reg), phi, theta, delta, kappa);
    model = { phi, theta, delta, a: f.a, P: f.P };
  } else {
    const startU = toTransformed(coefNat);
    const res = tightBfgs((u) => mlObjectiveNat(toNatural(full(u))), freeOf(startU));
    coefNat = toNatural(full(res.par)); code = res.code;
    if (transformPars) {
      const invertible = (c: readonly number[]): boolean => { const { ma, sma } = split(c);
        return (q === 0 || minRootModulus(ma) > 1) && (Q === 0 || minRootModulus(sma) > 1); };
      if (!invertible(coefNat)) {
        const { ma, sma } = split(coefNat);
        if (q > 0 && mask.slice(p, p + q).every(Boolean)) { const m2 = maInvert(ma); for (let i = 0; i < q; i++) coefNat[p + i] = m2[i]!; }
        if (Q > 0 && mask.slice(p + q + P, narma).every(Boolean)) {
          const m2 = maInvert(sma); for (let i = 0; i < Q; i++) coefNat[p + q + P + i] = m2[i]!;
        }
        // with a differenced model the kappa prior scales with sigma2, so the reflected MA is not an optimum: refit
        // inside the invertible region from it (R's optimiser stays at the invertible local optimum, the fixture's
        // first run)
        if (invertible(coefNat)) {
          const res2 = tightBfgs((u) => { const c = toNatural(full(u)); return invertible(c) ? mlObjectiveNat(c) : Infinity; }, freeOf(toTransformed(coefNat)));
          coefNat = toNatural(full(res2.par)); code = res2.code;
        }
      }
    }
    const { ar, ma, sar, sma, reg } = split(coefNat); const { phi, theta } = expandArma(ar, ma, sar, sma, s);
    const f = kalman(residualSeries(reg), phi, theta, delta, kappa);
    sigma2 = f.ssq / f.nu; nobs = f.nu;
    loglik = -0.5 * (f.nu * Math.log(2 * Math.PI * sigma2) + f.sumlog + f.nu);
    resid = f.resid;
    model = { phi, theta, delta, a: f.a, P: f.P };
  }
  // variance matrix (R's numerical Hessian, log 4): Hu = optimHess of n * objective at the transformed estimate,
  // J the forward difference (step 1e-3) of the map back
  const nFree = mask.filter(Boolean).length;
  let varCoef: number[][] = [];
  if (nFree > 0) {
    const objective = method === "CSS" ? (c: number[]) => cssObjective(c) : (c: number[]) => mlObjectiveNat(c);
    // R scales the CSS objective by nobs (n - d - sD, n.cond not subtracted; log of the fixture's first run)
    const scale = nobs;
    const useTrans = transformPars && method !== "CSS";
    const u0 = freeOf(useTrans ? toTransformed(coefNat) : coefNat);
    const g = (u: number[]): number => scale * objective(useTrans ? toNatural(full(u)) : full(u));
    let H: number[][];
    if ((options.hessian ?? "R") === "R") H = optimHess(u0, g);
    else H = convergedHessian(g, u0);
    const Hinv = invertSymmetric(H);
    if (useTrans) {
      const J: number[][] = Array.from({ length: nFree }, () => new Array<number>(nFree).fill(0));
      const base = freeOf(toNatural(full(u0)));
      for (let j = 0; j < nFree; j++) {
        const uj = u0.slice(); uj[j]! += 1e-3; const nat = freeOf(toNatural(full(uj)));
        for (let i = 0; i < nFree; i++) J[i]![j] = (nat[i]! - base[i]!) / 1e-3;
      }
      varCoef = J.map((row) => J.map((row2) => row.reduce((acc, v, a2) => acc + v * Hinv[a2]!.reduce((acc2, h, b2) => acc2 + h * row2[b2]!, 0), 0)));
    } else varCoef = Hinv;
  }
  // back from the optimiser's scaled regression coefficients
  if (nFree > 0) {
    const freeIdx = mask.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
    const sc = freeIdx.map((i) => (i >= narma ? regScale[i - narma]! : 1));
    varCoef = varCoef.map((row, a) => row.map((v, b) => v / (sc[a]! * sc[b]!)));
  }
  const npar = nFree + 1;
  const aic = method === "CSS" ? NaN : -2 * loglik + 2 * npar;
  return { coef: coefNat, coefNames, sigma2, varCoef, loglik, aic, arma: [p, q, P, Q, s, d, D], residuals: resid, method,
    nCond: method === "CSS" ? nCond : 0, nobs, code, mask, model, x, xreg: xreg0, includeMean };
}

function solveSymmetric(A: number[][], b: number[]): number[] {
  const n = b.length; const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const d = M[c]![c]!; if (d === 0) continue;
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r]![c]! / d; for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!; }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

function invertSymmetric(A: number[][]): number[][] {
  const n = A.length;
  return Array.from({ length: n }, (_, j) => solveSymmetric(A.map((r) => r.slice()), Array.from({ length: n }, (_, i) => (i === j ? 1 : 0))))
    .reduce((acc, col, j) => { col.forEach((v, i) => { acc[i]![j] = v; }); return acc; }, Array.from({ length: n }, () => new Array<number>(n).fill(0)));
}

/** A Hessian by central differences with Richardson extrapolation over halved steps (the "exact" option). */
function convergedHessian(f: (u: number[]) => number, u0: readonly number[]): number[][] {
  const k = u0.length;
  const at = (h: number): number[][] => Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => {
    const e = (a: number, b: number): number => { const v = u0.slice(); v[i]! += a; v[j]! += b; return f(v); };
    return (e(h, h) - e(h, -h) - e(-h, h) + e(-h, -h)) / (4 * h * h);
  }));
  const h1 = at(1e-3), h2 = at(5e-4);
  return h1.map((row, i) => row.map((v, j) => (4 * h2[i]![j]! - v) / 3));
}

/** A gradient by central differences with Richardson extrapolation. */
function convergedGradient(f: (u: number[]) => number, u0: readonly number[]): number[] {
  return u0.map((_, i) => {
    const d = (h: number): number => { const a = u0.slice(), b = u0.slice(); a[i]! += h; b[i]! -= h; return (f(a) - f(b)) / (2 * h); };
    const h = 1e-4 * Math.max(1, Math.abs(u0[i]!));
    return (4 * d(h / 2) - d(h)) / 3;
  });
}

/** Result of {@link predictArima}. */
export interface PredictArimaResult { pred: number[]; se: number[]; }

/**
 * Forecasts from an {@link arima} fit by the Kalman filter (the exact predictor from the finite past). Equivalent to
 * R's `predict.Arima()`.
 *
 * @category Time series
 */
export function predictArima(fit: ArimaResult, nAhead = 1, options: { newxreg?: readonly (readonly number[])[]; sigma2?: number } = {}): PredictArimaResult {
  const { phi, theta, delta } = fit.model; let a = fit.model.a.slice(); let P = fit.model.P.map((r) => r.slice());
  const p = phi.length, q = theta.length; const r = Math.max(p, q + 1); const nd = delta.length; const rd = r + nd;
  const Rv = [1, ...Array.from({ length: r - 1 }, (_, i) => theta[i] ?? 0)];
  const Z = new Array<number>(rd).fill(0); Z[0] = 1; for (let k = 0; k < nd; k++) Z[r + k] = delta[k]!;
  const transition = (x: number[]): number[] => {
    const out = new Array<number>(rd).fill(0);
    for (let i = 0; i < r; i++) out[i] = (phi[i] ?? 0) * x[0]! + (i + 1 < r ? x[i + 1]! : 0);
    if (nd > 0) { let z = 0; for (let k = 0; k < rd; k++) z += Z[k]! * x[k]!; out[r] = z; for (let k = 1; k < nd; k++) out[r + k] = x[r + k - 1]!; }
    return out;
  };
  const narma = fit.arma[0] + fit.arma[1] + fit.arma[2] + fit.arma[3];
  const reg = fit.coef.slice(narma);
  const newx = options.newxreg ?? [];
  if (fit.xreg.length > 0 && newx.length !== fit.xreg.length) throw new RangeError("'xreg' and 'newxreg' have different numbers of columns");
  const sigma2 = options.sigma2 ?? fit.sigma2;
  const pred: number[] = [], se: number[] = [];
  for (let h = 0; h < nAhead; h++) {
    a = transition(a);
    const TP: number[][] = P.map((_, j) => transition(P.map((row) => row[j]!)));
    const TPT: number[][] = Array.from({ length: rd }, (_, i) => transition(TP.map((col) => col[i]!)));
    P = TPT.map((row, i) => row.map((v, j) => v + (i < r && j < r ? Rv[i]! * Rv[j]! : 0)));
    let fc = 0; for (let k = 0; k < rd; k++) fc += Z[k]! * a[k]!;
    const F = P.reduce((s, row, i) => s + Z[i]! * row.reduce((s2, v, j) => s2 + v * Z[j]!, 0), 0);
    let m = fc; let k = 0;
    if (fit.includeMean) m += reg[k++]!;
    for (let c = 0; c < newx.length; c++) m += reg[k++]! * Number(newx[c]![h]!);
    pred.push(m); se.push(Math.sqrt(sigma2 * F));
  }
  return { pred, se };
}
