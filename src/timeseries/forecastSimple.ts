// forecast's simple methods: meanf, naive, snaive, rwf, ses, holt, hw, thetaf, croston, stlf / stlm and tslm. Written
// for rStats.js from the behaviour specification oracle/tsmeta-behaviour.md ("Simple methods and small functions") with
// the details found in experiments/tsmeta120-log.md (items 28-35, 47, 51). No R or package source was read.

import { qnorm } from "../distributions/normal.js";
import { qt } from "../distributions/t.js";
import { lm } from "../models/lm.js";
import { ets, etsFixedInitial, forecastEts, type EtsResult, type EtsSpec } from "./ets.js";
import { decompose } from "./statsTs.js";
import { mstl } from "./stl.js";

/** A forecast with intervals and the in-sample fit. */
export interface SimpleForecast {
  mean: number[]; lower: number[][]; upper: number[][]; level: number[];
  fitted: number[]; residuals: number[]; method: string;
  /** The ets model behind ses / holt / hw / stlf. */
  model?: EtsResult;
}

const meanOf = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0) / v.length;
const sdOf = (v: readonly number[]): number => { const m = meanOf(v); return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)); };
const intervals = (mean: readonly number[], se: readonly number[], level: readonly number[], q: (l: number) => number): { lower: number[][]; upper: number[][] } => ({
  lower: mean.map((m, i) => level.map((l) => m - q(l) * se[i]!)), upper: mean.map((m, i) => level.map((l) => m + q(l) * se[i]!)),
});
const zq = (l: number): number => qnorm(0.5 + l / 200);

/**
 * Forecasts by the mean (forecast's `meanf()`): intervals mean +- qt(level, n - 1) sd(y) sqrt(1 + 1/n).
 *
 * @category Time series
 */
export function meanf(y: readonly number[], options: { h?: number; level?: readonly number[] } = {}): SimpleForecast {
  const h = options.h ?? 10; const level = [...(options.level ?? [80, 95])]; const x = y.filter(Number.isFinite); const n = x.length;
  const mu = meanOf(x); const s = sdOf(x) * Math.sqrt(1 + 1 / n);
  const mean = new Array<number>(h).fill(mu);
  const iv = intervals(mean, new Array<number>(h).fill(s), level, (l) => qt(0.5 + l / 200, n - 1) as number);
  return { mean, ...iv, level, fitted: y.map(() => mu), residuals: y.map((v) => v - mu), method: "Mean" };
}

/**
 * Random walk forecasts (forecast's `rwf()`), with a drift (y_n - y_1)/(n - 1) when `drift`. sigma = sqrt(mean(res^2))
 * without a drift, sd(res) with one; se_h = sigma sqrt(h) or sigma sqrt(h (1 + h/(n - 1))).
 *
 * @category Time series
 */
export function rwf(y: readonly number[], options: { h?: number; drift?: boolean; level?: readonly number[]; lag?: number } = {}): SimpleForecast {
  const h = options.h ?? 10; const level = [...(options.level ?? [80, 95])]; const drift = options.drift ?? false; const lag = options.lag ?? 1;
  const n = y.length; const b = drift ? (y[n - 1]! - y[0]!) / (n - 1) : 0;
  const fitted = y.map((_, t) => (t < lag ? NaN : y[t - lag]! + b));
  const residuals = y.map((v, t) => v - fitted[t]!);
  const res = residuals.filter(Number.isFinite);
  const sigma = drift ? sdOf(res) : Math.sqrt(meanOf(res.map((r) => r * r)));
  const mean = Array.from({ length: h }, (_, i) => (lag === 1 ? y[n - 1]! + (i + 1) * b : y[n - lag + (i % lag)]!));
  const se = Array.from({ length: h }, (_, i) => {
    const k = i + 1;
    if (lag > 1) return sigma * Math.sqrt(Math.floor((k - 1) / lag) + 1);
    return drift ? sigma * Math.sqrt(k * (1 + k / (n - 1))) : sigma * Math.sqrt(k);
  });
  return { mean, ...intervals(mean, se, level, zq), level, fitted, residuals,
    method: lag > 1 ? "Seasonal naive method" : drift ? "Random walk with drift" : "Random walk" };
}

/** Naive forecasts (forecast's `naive()`): {@link rwf} without a drift. @category Time series */
export function naive(y: readonly number[], options: { h?: number; level?: readonly number[] } = {}): SimpleForecast {
  return { ...rwf(y, options), method: "Naive method" };
}

/** Seasonal naive forecasts (forecast's `snaive()`): y_{n - m + ...}, se_h = sigma sqrt(floor((h - 1)/m) + 1). @category Time series */
export function snaive(y: readonly number[], options: { frequency: number; h?: number; level?: readonly number[] }): SimpleForecast {
  return rwf(y, { h: options.h ?? 2 * options.frequency, lag: options.frequency, ...(options.level ? { level: options.level } : {}) });
}

function fromEts(fit: EtsResult, h: number, level: number[], method: string): SimpleForecast {
  const fc = forecastEts(fit, { h, level });
  return { mean: fc.mean, lower: fc.lower, upper: fc.upper, level, fitted: fit.fitted, residuals: fit.x.map((v, i) => v - fit.fitted[i]!), method, model: fit };
}

/**
 * Simple exponential smoothing (forecast's `ses()`): ets(y, "ANN"), or with `initial: "simple"` the level started at
 * y_1 and alpha minimising the one-step SSE.
 *
 * @category Time series
 */
export function ses(y: readonly number[], options: { h?: number; level?: readonly number[]; initial?: "optimal" | "simple"; alpha?: number } = {}): SimpleForecast {
  const h = options.h ?? 10; const level = [...(options.level ?? [80, 95])];
  const fixed = options.alpha !== undefined ? { alpha: options.alpha } : {};
  const fit = options.initial === "simple"
    ? etsFixedInitial(y, { error: "A", trend: "N", damped: false, season: "N", m: 1 }, { l: y[0]! }, fixed, "mse")
    : ets(y, { model: "ANN", ...fixed });
  return fromEts(fit, h, level, "Simple exponential smoothing");
}

/**
 * Holt's linear trend method (forecast's `holt()`): ets AAN (AAdN damped, MMN exponential); `initial: "simple"`
 * starts at l = y_1, b = y_2 - y_1.
 *
 * @category Time series
 */
export function holt(y: readonly number[], options: { h?: number; level?: readonly number[]; damped?: boolean; exponential?: boolean; initial?: "optimal" | "simple" } = {}): SimpleForecast {
  const h = options.h ?? 10; const level = [...(options.level ?? [80, 95])];
  const damped = options.damped ?? false; const expo = options.exponential ?? false;
  const spec: EtsSpec = { error: expo ? "M" : "A", trend: expo ? "M" : "A", damped, season: "N", m: 1 };
  const fit = options.initial === "simple"
    ? etsFixedInitial(y, spec, expo ? { l: y[0]!, b: y[1]! / y[0]! } : { l: y[0]!, b: y[1]! - y[0]! }, {}, "mse")
    : ets(y, { model: expo ? "MMN" : "AAN", damped });
  const method = damped ? (expo ? "Damped Holt's method with exponential trend" : "Damped Holt's method") : expo ? "Holt's method with exponential trend" : "Holt's method";
  return fromEts(fit, h, level, method);
}

/**
 * Holt-Winters seasonal method (forecast's `hw()`): ets AAA or MAM (damped: AAdA, MAdM); `initial: "simple"` starts at
 * l = mean(y[1:m]), b = (mean(y[m+1:2m]) - mean(y[1:m]))/m, s = y[1:m] - l (or / l).
 *
 * @category Time series
 */
export function hw(y: readonly number[], options: { frequency: number; h?: number; level?: readonly number[]; seasonal?: "additive" | "multiplicative"; damped?: boolean; initial?: "optimal" | "simple" }): SimpleForecast {
  const m = options.frequency; const h = options.h ?? 2 * m; const level = [...(options.level ?? [80, 95])];
  const mult = options.seasonal === "multiplicative"; const damped = options.damped ?? false;
  const spec: EtsSpec = { error: mult ? "M" : "A", trend: "A", damped, season: mult ? "M" : "A", m };
  let fit: EtsResult;
  if (options.initial === "simple") {
    const l = meanOf(y.slice(0, m)); const b = (meanOf(y.slice(m, 2 * m)) - l) / m;
    // s1 = the most recent (period m), ..., sm = period 1
    const s = y.slice(0, m).map((v) => (mult ? v / l : v - l)).reverse();
    fit = etsFixedInitial(y, spec, { l, b, s }, {}, "mse");
  } else fit = ets(y, { frequency: m, model: mult ? "MAM" : "AAA", damped });
  const method = `${damped ? "Damped " : ""}Holt-Winters' ${mult ? "multiplicative" : "additive"} method`;
  return fromEts(fit, h, level, method);
}

/** The lag-k autocorrelations (mean removed, over n). */
function acfValues(x: readonly number[], maxLag: number): number[] {
  const n = x.length; const m = meanOf(x); const c0 = x.reduce((a, v) => a + (v - m) ** 2, 0) / n;
  return Array.from({ length: maxLag }, (_, k) => { let s = 0; for (let t = k + 1; t < n; t++) s += (x[t]! - m) * (x[t - k - 1]! - m); return s / n / c0; });
}

/**
 * The theta method (forecast's `thetaf()`): a seasonality test |r_m| > qnorm(0.95) sqrt((1 + 2 sum_{i<m} r_i^2)/n), a
 * multiplicative decompose when seasonal, ses by MSE, mean = ses mean + b/2 (h - 1 + 1/alpha - (1 - alpha)^n / alpha)
 * with b the slope of lm(y ~ t), reseasonalised.
 *
 * @category Time series
 */
export function thetaf(y: readonly number[], options: { frequency?: number; h?: number; level?: readonly number[] } = {}): SimpleForecast {
  const m = options.frequency ?? 1; const h = options.h ?? (m > 1 ? 2 * m : 10); const level = [...(options.level ?? [80, 95])];
  const n = y.length;
  let seasonal = false;
  if (m > 1 && n >= 2 * m) {
    const r = acfValues(y, m);
    const stat = Math.abs(r[m - 1]!); const crit = qnorm(0.95) * Math.sqrt((1 + 2 * r.slice(0, m - 1).reduce((a, v) => a + v * v, 0)) / n);
    seasonal = stat > crit;
  }
  let adj = y.slice(); let sidx: number[] = [];
  if (seasonal) { const d = decompose(y, { frequency: m, type: "multiplicative" }); sidx = d.figure; adj = y.map((v, i) => v / sidx[i % m]!); }
  const fit = ets(adj, { model: "ANN", optCrit: "mse" }); const alpha = fit.par.alpha;
  const fc = forecastEts(fit, { h, level });
  const b = lm(adj.map((_, t) => [t + 1]), adj, {}).coefficients[1]!;
  const add = Array.from({ length: h }, (_, i) => (b / 2) * (i + 1 - 1 + 1 / alpha - (1 - alpha) ** n / alpha));
  const seasonOf = (k: number): number => (seasonal ? sidx[(n + k) % m]! : 1);
  const mean = fc.mean.map((v, i) => (v + add[i]!) * seasonOf(i));
  const lower = fc.lower.map((row, i) => row.map((v) => (v + add[i]!) * seasonOf(i)));
  const upper = fc.upper.map((row, i) => row.map((v) => (v + add[i]!) * seasonOf(i)));
  const fitted = fit.fitted.map((v, i) => v * (seasonal ? sidx[i % m]! : 1));
  return { mean, lower, upper, level, fitted, residuals: y.map((v, i) => v - fitted[i]!), method: "Theta" };
}

/**
 * Croston's method for intermittent demand (forecast's `croston()`): SES with alpha on the non-zero demands and on the
 * intervals between them (counted from time 0), each started at its first value; forecast k z / p with k = 1 (croston),
 * 1 - alpha/2 (sba) or 1 - alpha/(2 - alpha) (sbj). No intervals.
 *
 * @category Time series
 */
export function croston(y: readonly number[], options: { h?: number; alpha?: number; type?: "croston" | "sba" | "sbj" } = {}): { mean: number[]; fitted: number[]; method: string } {
  const h = options.h ?? 10; const alpha = options.alpha ?? 0.1; const type = options.type ?? "croston";
  const k = type === "croston" ? 1 : type === "sba" ? 1 - alpha / 2 : 1 - alpha / (2 - alpha);
  const n = y.length; const fitted = new Array<number>(n).fill(NaN);
  let z = NaN, p = NaN; let last = 0; // time of the last demand (time 0 before the series)
  for (let t = 0; t < n; t++) {
    if (t > 0) fitted[t] = Number.isNaN(z) ? 0 : (k * z) / p;
    if (y[t]! !== 0) {
      const interval = t + 1 - last; last = t + 1;
      if (Number.isNaN(z)) { z = y[t]!; p = interval; } else { z += alpha * (y[t]! - z); p += alpha * (interval - p); }
    }
  }
  const f = Number.isNaN(z) ? 0 : (k * z) / p;
  return { mean: new Array<number>(h).fill(f), fitted, method: "Croston's method" };
}

/**
 * STL + ETS forecasts (forecast's `stlf()`): mstl(y), forecast(ets(seasonally adjusted, "ZZN")), plus the last cycle of
 * the seasonal component repeated.
 *
 * @category Time series
 */
export function stlf(y: readonly number[], options: { frequency: number; h?: number; level?: readonly number[] }): SimpleForecast {
  const m = options.frequency; const h = options.h ?? 2 * m; const level = [...(options.level ?? [80, 95])];
  const d = mstl(y, { frequency: m }); const seas = d.seasonal ?? new Array<number>(y.length).fill(0);
  const adj = y.map((v, i) => v - seas[i]!);
  const fit = ets(adj, { model: "ZZN" }); const fc = forecastEts(fit, { h, level });
  const n = y.length; const lastCycle = seas.slice(n - m);
  const sAt = (i: number): number => lastCycle[i % m]!;
  const fitted = fit.fitted.map((v, i) => v + seas[i]!);
  return { mean: fc.mean.map((v, i) => v + sAt(i)), lower: fc.lower.map((r, i) => r.map((v) => v + sAt(i))), upper: fc.upper.map((r, i) => r.map((v) => v + sAt(i))),
    level, fitted, residuals: y.map((v, i) => v - fitted[i]!), method: `STL +  ${fit.method}`, model: fit };
}

/** Result of {@link tslm}. */
export interface TslmResult {
  coefficients: number[]; coefficientNames: string[]; fitted: number[]; residuals: number[];
  /** Forecasts with t intervals from the regression. */
  forecast: (h: number, level?: readonly number[]) => { mean: number[]; lower: number[][]; upper: number[][]; level: number[] };
}

/**
 * Linear regression on a trend (1..n) and seasonal dummies (forecast's `tslm(y ~ trend + season)`), the first season
 * the baseline.
 *
 * @category Time series
 */
export function tslm(y: readonly number[], options: { frequency?: number; trend?: boolean; season?: boolean } = {}): TslmResult {
  const m = options.frequency ?? 1; const useT = options.trend ?? true; const useS = (options.season ?? true) && m > 1;
  const row = (t: number): number[] => [...(useT ? [t + 1] : []), ...(useS ? Array.from({ length: m - 1 }, (_, k) => (t % m === k + 1 ? 1 : 0)) : [])];
  const n = y.length; const X = y.map((_, t) => row(t)); const f = lm(X, y, {});
  const names = ["(Intercept)", ...(useT ? ["trend"] : []), ...(useS ? Array.from({ length: m - 1 }, (_, k) => `season${k + 2}`) : [])];
  const Xf = X.map((r) => [1, ...r]); const k = Xf[0]!.length;
  // (X'X)^{-1} for the prediction variances
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => Xf.reduce((s, r) => s + r[i]! * r[j]!, 0)));
  const inv = invert(A); const s2 = f.residuals.reduce((a, v) => a + v * v, 0) / (n - k);
  return {
    coefficients: f.coefficients, coefficientNames: names, fitted: f.fittedValues, residuals: f.residuals,
    forecast: (h, lev = [80, 95]) => {
      const rows = Array.from({ length: h }, (_, i) => [1, ...row(n + i)]);
      const mean = rows.map((r) => r.reduce((s, v, j) => s + v * f.coefficients[j]!, 0));
      const se = rows.map((r) => Math.sqrt(s2 * (1 + r.reduce((s, v, i) => s + v * r.reduce((s2_, w, j) => s2_ + inv[i]![j]! * w, 0), 0))));
      const level = [...lev];
      return { mean, ...intervals(mean, se, level, (l) => qt(0.5 + l / 200, n - k) as number), level };
    },
  };
}

function invert(A: number[][]): number[][] {
  const k = A.length; const M = A.map((r, i) => [...r, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < k; i++) {
    let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(M[r]![i]!) > Math.abs(M[p]![i]!)) p = r;
    [M[i], M[p]] = [M[p]!, M[i]!]; const d = M[i]![i]!;
    for (let c = 0; c < 2 * k; c++) M[i]![c]! /= d;
    for (let r = 0; r < k; r++) if (r !== i) { const f = M[r]![i]!; for (let c = 0; c < 2 * k; c++) M[r]![c]! -= f * M[i]![c]!; }
  }
  return M.map((r) => r.slice(k));
}
