// stats' filter, Box.test, diffinv, decompose, ar (yule-walker, burg, ols, mle), predict.ar and arima0. Written for
// rStats.js from the behaviour specification oracle/tsmeta-behaviour.md with the details found in
// experiments/tsmeta120-log.md (items 10-12). No R or package source was read.

import { pchisq } from "../distributions/chisq.js";
import { lm } from "../models/lm.js";
import { arima, type ArimaResult } from "./arima.js";

// ---------------------------------------------------------------------------------------------------------------
// filter

/**
 * Linear filtering of a series (stats' `filter()`): convolution, y_i = sum_j f_j x_{i + o - (j - 1)} with o = 0 for
 * `sides: 1` and floor(p / 2) for `sides: 2` (NaN where an index falls outside, or wrapped with `circular`), or
 * recursive, y_i = x_i + sum_j f_j y_{i - j} with `init` (the most recent value first, as R).
 *
 * @category Time series
 */
export function filter(x: readonly number[], f: readonly number[], options: { method?: "convolution" | "recursive"; sides?: 1 | 2; circular?: boolean; init?: readonly number[] } = {}): number[] {
  const n = x.length; const p = f.length; const method = options.method ?? "convolution";
  if (method === "convolution") {
    const o = (options.sides ?? 2) === 2 ? Math.floor(p / 2) : 0; const circ = options.circular ?? false;
    return Array.from({ length: n }, (_, i) => {
      let s = 0;
      for (let j = 0; j < p; j++) {
        let k = i + o - j;
        if (k < 0 || k >= n) { if (!circ) return NaN; k = ((k % n) + n) % n; }
        const v = x[k]!; if (Number.isNaN(v)) return NaN; s += f[j]! * v;
      }
      return s;
    });
  }
  // init in reverse time order: init[0] is y_0, init[1] is y_{-1}, ...
  const init = options.init ?? new Array<number>(p).fill(0);
  const prev = [...init]; const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let s = x[i]!;
    for (let j = 0; j < p; j++) s += f[j]! * (j < out.length ? out[out.length - 1 - j]! : prev[j - out.length]!);
    out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Box.test

/**
 * Box-Pierce or Ljung-Box test of white noise (stats' `Box.test()`): r_k the autocorrelations (mean removed, divided by
 * n), Q = n sum r_k^2 or n (n + 2) sum r_k^2 / (n - k), chi-squared on lag - fitdf degrees of freedom.
 *
 * @category Time series
 */
export function boxTest(x: readonly number[], options: { lag?: number; type?: "Box-Pierce" | "Ljung-Box"; fitdf?: number } = {}): { statistic: number; parameter: number; pValue: number; method: string } {
  const lag = options.lag ?? 1; const type = options.type ?? "Box-Pierce"; const fitdf = options.fitdf ?? 0;
  const v = x.filter((a) => !Number.isNaN(a)); const n = v.length; const mean = v.reduce((a, b) => a + b, 0) / n;
  const c0 = v.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  let q = 0;
  for (let k = 1; k <= lag; k++) {
    let ck = 0; for (let t = k; t < n; t++) ck += (v[t]! - mean) * (v[t - k]! - mean); ck /= n;
    const r = ck / c0; q += type === "Box-Pierce" ? r * r : (r * r) / (n - k);
  }
  const statistic = type === "Box-Pierce" ? n * q : n * (n + 2) * q;
  const df = lag - fitdf;
  return { statistic, parameter: df, pValue: pchisq(statistic, df, { lowerTail: false }) as number, method: type === "Box-Pierce" ? "Box-Pierce test" : "Box-Ljung test" };
}

// ---------------------------------------------------------------------------------------------------------------
// diffinv

/**
 * The inverse of differencing (stats' `diffinv()`): the cumulative sums at the given lag, repeated `differences`
 * times, starting from `xi` (zeros by default).
 *
 * @category Time series
 */
export function diffinv(x: readonly number[], options: { lag?: number; differences?: number; xi?: readonly number[] } = {}): number[] {
  const lag = options.lag ?? 1; const d = options.differences ?? 1;
  const xi = options.xi ?? new Array<number>(lag * d).fill(0);
  if (xi.length !== lag * d) throw new RangeError("'xi' does not have the right length");
  if (d === 1) {
    const out = xi.slice(0, lag);
    for (let i = 0; i < x.length; i++) out.push(x[i]! + out[i]!);
    return out;
  }
  // recursively: the inner inverse starts from the lag-th differences of xi
  const xiDiff = xi.slice(lag).map((v, i) => v - xi[i]!);
  const inner = diffinv(x, { lag, differences: d - 1, xi: xiDiff });
  return diffinv(inner, { lag, differences: 1, xi: xi.slice(0, lag) });
}

// ---------------------------------------------------------------------------------------------------------------
// decompose

/** Result of {@link decompose}. */
export interface DecomposeResult { x: number[]; seasonal: number[]; trend: number[]; random: number[]; figure: number[]; type: "additive" | "multiplicative" }

/**
 * Classical seasonal decomposition by moving averages (stats' `decompose()`). `start` is the position (1..frequency)
 * of the first observation in the cycle; `figure` starts at that position, as R's.
 *
 * @category Time series
 */
export function decompose(x: readonly number[], options: { frequency: number; type?: "additive" | "multiplicative"; filter?: readonly number[] }): DecomposeResult {
  const f = options.frequency; const type = options.type ?? "additive"; const n = x.length;
  if (f <= 1 || n < 2 * f) throw new RangeError("time series has no or less than 2 periods");
  const filt = options.filter ?? (f % 2 === 0 ? [0.5, ...new Array<number>(f - 1).fill(1), 0.5].map((v) => v / f) : new Array<number>(f).fill(1 / f));
  const trend = filter(x, filt, { sides: 2 });
  const detr = x.map((v, i) => (type === "additive" ? v - trend[i]! : v / trend[i]!));
  const sums = new Array<number>(f).fill(0), cnt = new Array<number>(f).fill(0);
  detr.forEach((v, i) => { if (!Number.isNaN(v)) { sums[i % f]! += v; cnt[i % f]!++; } });
  let figure = sums.map((s, i) => s / cnt[i]!);
  const mean = figure.reduce((a, b) => a + b, 0) / f;
  figure = figure.map((v) => (type === "additive" ? v - mean : v / mean));
  const seasonal = x.map((_, i) => figure[i % f]!);
  const random = x.map((v, i) => (type === "additive" ? v - seasonal[i]! - trend[i]! : v / (seasonal[i]! * trend[i]!)));
  return { x: x.slice(), seasonal, trend, random, figure, type };
}

// ---------------------------------------------------------------------------------------------------------------
// ar

/** Result of {@link ar}. */
export interface ArResult {
  order: number;
  ar: number[];
  varPred: number;
  xMean: number;
  /** ar.ols's intercept (of the demeaned series). */
  xIntercept?: number;
  /** aic minus its minimum, for orders 0..orderMax. */
  aic: number[];
  partialacf?: number[];
  residuals: number[];
  method: string;
  orderMax: number;
  /** The series (for predictions). */
  x: number[];
}

/**
 * Fits an autoregressive model with the order chosen by AIC (stats' `ar()`): Yule-Walker (default), Burg, OLS or MLE
 * (arima0 for each order).
 *
 * @category Time series
 */
export function ar(x: readonly number[], options: { method?: "yule-walker" | "burg" | "ols" | "mle"; orderMax?: number; aic?: boolean; demean?: boolean; varMethod?: 1 | 2 } = {}): ArResult {
  const method = options.method ?? "yule-walker"; const xs = x.map(Number); const n = xs.length;
  const demean = options.demean ?? true; const useAic = options.aic ?? true;
  const xMean = demean ? xs.reduce((a, b) => a + b, 0) / n : 0; const z = xs.map((v) => v - xMean);
  const orderMax = Math.min(options.orderMax ?? Math.floor(Math.min(n - 1, 10 * Math.log10(n))), method === "mle" ? 12 : Infinity, n - 1);
  const pickOrder = (aic: number[]): number => { if (!useAic) return orderMax; let b = 0; for (let k = 1; k < aic.length; k++) if (aic[k]! < aic[b]!) b = k; return b; };
  const rel = (a: number[]): number[] => { const m = Math.min(...a); return a.map((v) => v - m); };
  const residualsOf = (coef: number[], mean: number, intercept = 0): number[] => xs.map((_, t) => {
    if (t < coef.length) return NaN; let v = xs[t]! - mean - intercept; for (let j = 0; j < coef.length; j++) v -= coef[j]! * (xs[t - j - 1]! - mean); return v;
  });
  if (method === "yule-walker" || method === "burg") {
    const aicAll: number[] = []; const coefs: number[][] = [[]]; const vs: number[] = []; const pacf: number[] = [];
    if (method === "yule-walker") {
      const c = Array.from({ length: orderMax + 1 }, (_, k) => { let s = 0; for (let t = k; t < n; t++) s += z[t]! * z[t - k]!; return s / n; });
      let v = c[0]!; vs.push(v); aicAll.push(n * Math.log(v));
      let phi: number[] = [];
      for (let k = 1; k <= orderMax; k++) {
        let num = c[k]!; for (let j = 0; j < phi.length; j++) num -= phi[j]! * c[k - 1 - j]!;
        const a = num / v; const next = phi.map((p, j) => p - a * phi[phi.length - 1 - j]!); next.push(a);
        phi = next; v *= 1 - a * a; vs.push(v); pacf.push(a); coefs.push(phi.slice()); aicAll.push(n * Math.log(v) + 2 * k);
      }
      const order = pickOrder(aicAll); const coef = coefs[order]!;
      // var.pred = v_p n / (n - (p + 1)) (log 10)
      return { order, ar: coef, varPred: (vs[order]! * n) / (n - (order + 1)), xMean, aic: rel(aicAll), partialacf: pacf, residuals: residualsOf(coef, xMean), method: "Yule-Walker", orderMax, x: xs };
    }
    // Burg: forward and backward errors, reflection coefficients (log 11)
    const varMethod = options.varMethod ?? 1;
    let fwd = z.slice(), bwd = z.slice(); let phi: number[] = [];
    let v1 = z.reduce((a, b) => a + b * b, 0) / n; const v1s = [v1]; const v2s = [v1];
    for (let k = 1; k <= orderMax; k++) {
      let num = 0, den = 0; for (let t = k; t < n; t++) { num += fwd[t]! * bwd[t - 1]!; den += fwd[t]! ** 2 + bwd[t - 1]! ** 2; }
      const a = (2 * num) / den; const next = phi.map((p, j) => p - a * phi[phi.length - 1 - j]!); next.push(a); phi = next;
      const nf = fwd.slice(), nb = bwd.slice();
      for (let t = k; t < n; t++) { nf[t] = fwd[t]! - a * bwd[t - 1]!; nb[t] = bwd[t - 1]! - a * fwd[t]!; }
      fwd = nf; bwd = nb;
      v1 *= 1 - a * a; v1s.push(v1);
      let sf = 0, sb = 0; for (let t = k; t < n; t++) { sf += fwd[t]! ** 2; sb += bwd[t]! ** 2; }
      v2s.push((sf + sb) / (2 * (n - k)));
      pacf.push(a); coefs.push(phi.slice());
    }
    const vv = varMethod === 1 ? v1s : v2s;
    const aicB = vv.map((v, k) => n * Math.log(v) + 2 * k);
    const order = pickOrder(aicB); const coef = coefs[order]!;
    return { order, ar: coef, varPred: vv[order]!, xMean, aic: rel(aicB), partialacf: pacf, residuals: residualsOf(coef, xMean), method: "Burg", orderMax, x: xs };
  }
  if (method === "ols") {
    // each order on its own n - k rows: aic = n log(RSS_k / (n - k)) + 2k (log 11)
    const fits: { coef: number[]; intercept: number; rss: number }[] = [];
    const aicO: number[] = [];
    for (let k = 0; k <= orderMax; k++) {
      const rows: number[][] = [], resp: number[] = [];
      for (let t = k; t < n; t++) { rows.push(Array.from({ length: k }, (_, j) => z[t - j - 1]!)); resp.push(z[t]!); }
      let coef: number[] = [], intercept: number, rss: number;
      if (k === 0) { intercept = resp.reduce((a, b) => a + b, 0) / resp.length; rss = resp.reduce((a, b) => a + (b - intercept) ** 2, 0); }
      else { const f = lm(rows, resp, {}); intercept = f.coefficients[0]!; coef = f.coefficients.slice(1); rss = f.residuals.reduce((a, b) => a + b * b, 0); }
      fits.push({ coef, intercept, rss }); aicO.push(n * Math.log(rss / (n - k)) + 2 * k);
    }
    const order = pickOrder(aicO); const ff = fits[order]!;
    return { order, ar: ff.coef, varPred: ff.rss / (n - order), xMean, xIntercept: ff.intercept, aic: rel(aicO), residuals: residualsOf(ff.coef, xMean, ff.intercept), method: "Unconstrained LS", orderMax, x: xs };
  }
  // mle: arima0 for each order (log 12)
  const fits = Array.from({ length: orderMax + 1 }, (_, k) => arima0(xs, { order: [k, 0, 0], includeMean: demean }));
  const aicM = fits.map((f) => f.aic); const order = pickOrder(aicM); const ff = fits[order]!;
  const mean = demean ? ff.coef[ff.coef.length - 1]! : 0;
  return { order, ar: ff.coef.slice(0, order), varPred: ff.sigma2, xMean: mean, aic: rel(aicM), residuals: residualsOf(ff.coef.slice(0, order), mean), method: "MLE", orderMax, x: xs };
}

/** Predictions from an {@link ar} fit (stats' `predict.ar`): the AR recursion about the mean, se = sqrt(var.pred cumsum(psi^2)). */
export function predictAr(fit: ArResult, nAhead = 1): { pred: number[]; se: number[] } {
  const p = fit.order; const x = fit.x; const mu = fit.xMean; const c = fit.xIntercept ?? 0;
  const hist = x.map((v) => v - mu); const pred: number[] = [];
  for (let h = 0; h < nAhead; h++) {
    let v = c; for (let j = 0; j < p; j++) v += fit.ar[j]! * hist[hist.length - 1 - j]!;
    hist.push(v); pred.push(v + mu);
  }
  const psi = [1];
  for (let j = 1; j < nAhead; j++) { let v = 0; for (let k = 1; k <= Math.min(j, p); k++) v += fit.ar[k - 1]! * psi[j - k]!; psi.push(v); }
  let acc = 0; const se = psi.map((ps) => { acc += ps * ps; return Math.sqrt(fit.varPred * acc); });
  return { pred, se };
}

// ---------------------------------------------------------------------------------------------------------------
// arima0

/**
 * stats' `arima0()`: an ARIMA model by exact maximum likelihood of the differenced series (no diffuse prior; the mean
 * of the differenced series with `includeMean` when d + D = 0).
 *
 * @category Time series
 */
export function arima0(x: readonly number[], options: { order?: readonly [number, number, number]; seasonal?: readonly [number, number, number]; frequency?: number; includeMean?: boolean } = {}): ArimaResult {
  const order = options.order ?? [0, 0, 0]; const seasonal = options.seasonal ?? [0, 0, 0]; const s = options.frequency ?? 1;
  let w = x.map(Number);
  for (let k = 0; k < order[1]; k++) w = w.slice(1).map((v, i) => v - w[i]!);
  for (let k = 0; k < seasonal[1]; k++) w = w.slice(s).map((v, i) => v - w[i]!);
  const fit = arima(w, { order: [order[0], 0, order[2]], seasonal: { order: [seasonal[0], 0, seasonal[2]], period: s }, frequency: s,
    includeMean: (options.includeMean ?? true) && order[1] + seasonal[1] === 0, method: "ML" });
  return { ...fit, arma: [order[0], order[2], seasonal[0], seasonal[2], s, order[1], seasonal[1]] };
}
