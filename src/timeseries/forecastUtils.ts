// forecast's small functions: accuracy, ma, fourier, seasonaldummy, monthdays, easter, bizdays, dm.test, CV,
// checkresiduals, tsCV, arimaorder, findfrequency, na.interp, tsoutliers and tsclean. Written for rStats.js from the
// behaviour specification oracle/tsmeta-behaviour.md with the details found in experiments/tsmeta120-log.md (items
// 28-32, 52-60). No R or package source was read.

import { pt } from "../distributions/t.js";
import { lm } from "../models/lm.js";
import { ar } from "./statsTs.js";
import { boxTest } from "./statsTs.js";
import { mstl, seasadj, supsmu } from "./stl.js";
import type { ArimaResult } from "./arima.js";

const meanOf = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0) / v.length;

// ---------------------------------------------------------------------------------------------------------------
// accuracy

/** One row of {@link accuracy}. */
export interface AccuracyRow { ME: number; RMSE: number; MAE: number; MPE: number; MAPE: number; MASE: number; ACF1: number; TheilU?: number }

/**
 * Accuracy measures (forecast's `accuracy()`): ME, RMSE, MAE, MPE, MAPE, MASE (scaled by the training data's mean
 * |y_t - y_{t-m}|), ACF1 of the errors; for a test set also Theil's U.
 *
 * @category Time series
 */
export function accuracy(training: { y: readonly number[]; fitted: readonly number[] }, options: { frequency?: number; test?: { y: readonly number[]; forecast: readonly number[] } } = {}): { training: AccuracyRow; test?: AccuracyRow } {
  const m = options.frequency ?? 1; const y = training.y;
  const scaleDiffs: number[] = []; for (let t = m; t < y.length; t++) if (Number.isFinite(y[t]!) && Number.isFinite(y[t - m]!)) scaleDiffs.push(Math.abs(y[t]! - y[t - m]!));
  const scale = meanOf(scaleDiffs);
  const row = (obs: readonly number[], pred: readonly number[], theil: boolean): AccuracyRow => {
    const e: number[] = [], pe: number[] = [], ys: number[] = [];
    obs.forEach((v, i) => { const f = pred[i]!; if (Number.isFinite(v) && Number.isFinite(f)) { e.push(v - f); pe.push((100 * (v - f)) / v); ys.push(v); } });
    const ME = meanOf(e), RMSE = Math.sqrt(meanOf(e.map((v) => v * v))), MAE = meanOf(e.map(Math.abs));
    const MPE = meanOf(pe), MAPE = meanOf(pe.map(Math.abs)), MASE = MAE / scale;
    const em = meanOf(e); let c0 = 0, c1 = 0; for (let t = 0; t < e.length; t++) { c0 += (e[t]! - em) ** 2; if (t > 0) c1 += (e[t]! - em) * (e[t - 1]! - em); }
    const out: AccuracyRow = { ME, RMSE, MAE, MPE, MAPE, MASE, ACF1: c1 / c0 };
    if (theil) {
      let num = 0, den = 0;
      for (let t = 0; t + 1 < obs.length; t++) { num += ((obs[t + 1]! - pred[t + 1]!) / obs[t]!) ** 2; den += ((obs[t + 1]! - obs[t]!) / obs[t]!) ** 2; }
      out.TheilU = Math.sqrt(num / den);
    }
    return out;
  };
  const tr = row(y, training.fitted, false);
  return options.test ? { training: tr, test: row(options.test.y, options.test.forecast, true) } : { training: tr };
}

// ---------------------------------------------------------------------------------------------------------------
// ma, fourier, seasonaldummy

/** Moving-average smoother (forecast's `ma()`): order k, centred (a 2 x k average) for even k when `centre`. @category Time series */
export function ma(x: readonly number[], order: number, options: { centre?: boolean } = {}): number[] {
  const centre = options.centre ?? true; const n = x.length;
  let w: number[];
  if (order % 2 === 1) w = new Array<number>(order).fill(1 / order);
  else if (centre) w = [0.5, ...new Array<number>(order - 1).fill(1), 0.5].map((v) => v / order);
  else w = new Array<number>(order).fill(1 / order);
  const half = Math.floor(w.length / 2); const off = order % 2 === 0 && !centre ? order / 2 - 1 : half;
  return Array.from({ length: n }, (_, i) => {
    let s = 0;
    for (let j = 0; j < w.length; j++) { const k = i - off + j; if (k < 0 || k >= n) return NaN; s += w[j]! * x[k]!; }
    return s;
  });
}

/**
 * Fourier terms (forecast's `fourier()`): S_k = sin(2 pi k t / m), C_k = cos(2 pi k t / m) for k = 1..K, t = 1..n (or
 * n + 1..n + h), the sine dropped at k = m / 2; columns named "S1-12", "C1-12", ...
 *
 * @category Time series
 */
export function fourier(options: { frequency: number; K: number; n: number; h?: number }): { names: string[]; columns: number[][] } {
  const m = options.frequency; const t0 = options.h !== undefined ? options.n : 0; const len = options.h ?? options.n;
  const names: string[] = [], columns: number[][] = [];
  for (let k = 1; k <= options.K; k++) {
    const t = Array.from({ length: len }, (_, i) => t0 + i + 1);
    if (2 * k !== m) { names.push(`S${k}-${m}`); columns.push(t.map((v) => Math.sin((2 * Math.PI * k * v) / m))); }
    names.push(`C${k}-${m}`); columns.push(t.map((v) => Math.cos((2 * Math.PI * k * v) / m)));
  }
  return { names, columns };
}

/** Seasonal dummies (forecast's `seasonaldummy()`): m - 1 columns, the last period omitted; `start` the cycle position (1-based) of the first row. @category Time series */
export function seasonaldummy(options: { frequency: number; n: number; start?: number; h?: number }): number[][] {
  const m = options.frequency; const s0 = (options.start ?? 1) - 1 + (options.h !== undefined ? options.n : 0); const len = options.h ?? options.n;
  return Array.from({ length: m - 1 }, (_, k) => Array.from({ length: len }, (_, i) => ((s0 + i) % m === k ? 1 : 0)));
}

// ---------------------------------------------------------------------------------------------------------------
// calendars

const daysInMonth = (Y: number, mo: number): number => new Date(Date.UTC(Y, mo, 0)).getUTCDate();
const periodsOf = (startYear: number, startPeriod: number, n: number, frequency: 12 | 4): { Y: number; p: number }[] =>
  Array.from({ length: n }, (_, i) => { const k = startPeriod - 1 + i; return { Y: startYear + Math.floor(k / frequency), p: (k % frequency) + 1 }; });
const monthsOf = (p: number, frequency: 12 | 4): number[] => (frequency === 12 ? [p] : [3 * p - 2, 3 * p - 1, 3 * p]);

/** Days in each month or quarter (forecast's `monthdays()`). @category Time series */
export function monthdays(options: { startYear: number; startPeriod?: number; n: number; frequency?: 12 | 4 }): number[] {
  const f = options.frequency ?? 12;
  return periodsOf(options.startYear, options.startPeriod ?? 1, options.n, f).map(({ Y, p }) => monthsOf(p, f).reduce((a, mo) => a + daysInMonth(Y, mo), 0));
}

/** Easter Sunday of year Y (anonymous Gregorian algorithm) as [month, day]. */
export function easterSunday(Y: number): [number, number] {
  const a = Y % 19, b = Math.floor(Y / 100), c = Y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451); const v = h + l - 7 * m + 114;
  return [Math.floor(v / 31), (v % 31) + 1];
}

/**
 * The Easter holidays in each month or quarter (forecast's `easter()`): the share of Good Friday .. Easter Sunday (..
 * Monday with `easterMon`) falling in the period, rounded to two decimals (as R).
 *
 * @category Time series
 */
export function easter(options: { startYear: number; startPeriod?: number; n: number; frequency?: 12 | 4; easterMon?: boolean }): number[] {
  const f = options.frequency ?? 12;
  return periodsOf(options.startYear, options.startPeriod ?? 1, options.n, f).map(({ Y, p }) => {
    const [mo, d] = easterSunday(Y); const sun = Date.UTC(Y, mo - 1, d);
    const days = Array.from({ length: options.easterMon ? 4 : 3 }, (_, i) => new Date(sun + (i - 2) * 86400000));
    const months = monthsOf(p, f);
    const share = days.filter((dd) => dd.getUTCFullYear() === Y && months.includes(dd.getUTCMonth() + 1)).length / days.length;
    return Math.round(share * 100) / 100;
  });
}

type Ymd = number; // days since epoch (UTC)
const D = (Y: number, m: number, d: number): Ymd => Date.UTC(Y, m - 1, d) / 86400000;
const wday = (x: Ymd): number => { const w = new Date(x * 86400000).getUTCDay(); return w === 0 ? 7 : w; }; // 1 = Monday .. 7 = Sunday
const nthDow = (Y: number, m: number, dow: number, k: number): Ymd => { let x = D(Y, m, 1); while (wday(x) !== dow) x++; return x + 7 * (k - 1); };
const lastDow = (Y: number, m: number, dow: number): Ymd => { let x = D(Y, m, daysInMonth(Y, m)); while (wday(x) !== dow) x--; return x; };
const wkMon = (x: Ymd): Ymd => (wday(x) === 6 ? x + 2 : wday(x) === 7 ? x + 1 : x);
const easterDay = (Y: number): Ymd => { const [m, d] = easterSunday(Y); return D(Y, m, d); };
function xmasPair(Y: number, toronto = false): Ymd[] {
  const c25 = D(Y, 12, 25); const w = wday(c25);
  if (w === 5) return [c25, c25 + 3];
  if (w === 6) return toronto ? [c25 + 2] : [c25 + 2, c25 + 3];
  if (w === 7) return [c25 + 1, c25 + 2];
  return [c25, c25 + 1];
}
const HOLIDAYS: Record<string, (Y: number) => Ymd[]> = {
  London: (Y) => {
    const em = Y === 1995 || Y === 2020 ? D(Y, 5, 8) : nthDow(Y, 5, 1, 1);
    const sp = Y === 2002 || Y === 2012 ? D(Y, 6, 4) : Y === 2022 ? D(Y, 6, 2) : lastDow(Y, 5, 1);
    const ex: Record<number, Ymd[]> = { 1999: [D(1999, 12, 31)], 2002: [D(2002, 6, 3)], 2011: [D(2011, 4, 29)], 2012: [D(2012, 6, 5)], 2022: [D(2022, 6, 3), D(2022, 9, 19)], 2023: [D(2023, 5, 8)] };
    return [wkMon(D(Y, 1, 1)), easterDay(Y) - 2, easterDay(Y) + 1, em, sp, lastDow(Y, 8, 1), ...xmasPair(Y), ...(ex[Y] ?? [])];
  },
  Toronto: (Y) => {
    let vic = D(Y, 5, 24); while (wday(vic) !== 1) vic--;
    return [wkMon(D(Y, 1, 1)), ...(Y >= 2008 ? [nthDow(Y, 2, 1, 3)] : []), easterDay(Y) - 2, vic, wkMon(D(Y, 7, 1)), nthDow(Y, 8, 1, 1),
      nthDow(Y, 9, 1, 1), nthDow(Y, 10, 1, 2), ...xmasPair(Y, true)];
  },
  Zurich: (Y) => [D(Y, 1, 1), D(Y, 1, 2), easterDay(Y) - 2, easterDay(Y) + 1, D(Y, 5, 1), easterDay(Y) + 39, easterDay(Y) + 50, D(Y, 8, 1),
    D(Y, 12, 25), D(Y, 12, 26), nthDow(Y, 4, 1, 3), nthDow(Y, 9, 1, 2)],
  "New York": (Y) => {
    const obsSF = (x: Ymd): Ymd => (wday(x) === 6 ? x - 1 : wday(x) === 7 ? x + 1 : x);
    const h = [wday(D(Y, 1, 1)) === 7 ? D(Y, 1, 2) : D(Y, 1, 1), ...(Y >= 1998 ? [nthDow(Y, 1, 1, 3)] : []), nthDow(Y, 2, 1, 3), easterDay(Y) - 2,
      lastDow(Y, 5, 1), obsSF(D(Y, 7, 4)), nthDow(Y, 9, 1, 1), nthDow(Y, 11, 4, 4), obsSF(D(Y, 12, 25))];
    if (Y >= 2022) h.push(obsSF(D(Y, 6, 19)));
    // the NYSE's special closings (log 30, 32)
    const sp: Record<number, Ymd[]> = { 1994: [D(1994, 4, 27)], 2001: [0, 1, 2, 3].map((k) => D(2001, 9, 11) + k), 2004: [D(2004, 6, 11)], 2007: [D(2007, 1, 2)], 2012: [D(2012, 10, 29), D(2012, 10, 30)] };
    return [...h, ...(sp[Y] ?? [])];
  },
  NERC: (Y) => {
    const obs = (x: Ymd): Ymd => (wday(x) === 7 ? x + 1 : x);
    return [obs(D(Y, 1, 1)), lastDow(Y, 5, 1), obs(D(Y, 7, 4)), nthDow(Y, 9, 1, 1), nthDow(Y, 11, 4, 4), obs(D(Y, 12, 25))];
  },
};

/**
 * Trading days in each month or quarter (forecast's `bizdays()`): weekdays minus the holidays of the financial centre
 * ("New York" (NYSE, default), "London", "NERC", "Toronto", "Zurich"; the rules of log 30-32).
 *
 * @category Time series
 */
export function bizdays(options: { startYear: number; startPeriod?: number; n: number; frequency?: 12 | 4; finCenter?: "New York" | "London" | "NERC" | "Toronto" | "Zurich" }): number[] {
  const f = options.frequency ?? 12; const hol = HOLIDAYS[options.finCenter ?? "New York"]!;
  const cache = new Map<number, Set<Ymd>>();
  const isHol = (x: Ymd): boolean => { const Y = new Date(x * 86400000).getUTCFullYear(); if (!cache.has(Y)) cache.set(Y, new Set(hol(Y))); return cache.get(Y)!.has(x); };
  return periodsOf(options.startYear, options.startPeriod ?? 1, options.n, f).map(({ Y, p }) => {
    let c = 0;
    for (const mo of monthsOf(p, f)) for (let d = 1; d <= daysInMonth(Y, mo); d++) { const x = D(Y, mo, d); if (wday(x) <= 5 && !isHol(x)) c++; }
    return c;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// dm.test, CV, checkresiduals, tsCV, arimaorder

/**
 * The Diebold-Mariano test with the Harvey-Leybourne-Newbold correction (forecast's `dm.test()`): d = |e1|^power -
 * |e2|^power, its variance from the autocovariances up to h - 1 (over n), t(n - 1).
 *
 * @category Time series
 */
export function dmTest(e1: readonly number[], e2: readonly number[], options: { alternative?: "two.sided" | "less" | "greater"; h?: number; power?: number } = {}): { statistic: number; parameter: number; pValue: number } {
  const h = options.h ?? 1; const power = options.power ?? 2; const alt = options.alternative ?? "two.sided";
  const d = e1.map((v, i) => Math.abs(v) ** power - Math.abs(e2[i]!) ** power); const n = d.length; const dm = meanOf(d);
  const gamma = (k: number): number => { let s = 0; for (let t = k; t < n; t++) s += (d[t]! - dm) * (d[t - k]! - dm); return s / n; };
  let v = gamma(0); for (let k = 1; k < h; k++) v += 2 * gamma(k);
  const stat0 = dm / Math.sqrt(v / n);
  const k = Math.sqrt((n + 1 - 2 * h + (h * (h - 1)) / n) / n); const statistic = stat0 * k;
  const df = n - 1;
  const pValue = alt === "two.sided" ? 2 * (pt(-Math.abs(statistic), df) as number) : alt === "less" ? (pt(statistic, df) as number) : (pt(statistic, df, { lowerTail: false }) as number);
  return { statistic, parameter: df, pValue };
}

/**
 * Cross-validation and information criteria of a linear model (forecast's `CV()`): CV = mean((e / (1 - h_ii))^2), AIC =
 * n log(SSE/n) + 2(k + 2), AICc, BIC, adjusted R^2 (k = the number of predictors).
 *
 * @category Time series
 */
export function cvLm(x: readonly (readonly number[])[], y: readonly number[]): { CV: number; AIC: number; AICc: number; BIC: number; AdjR2: number } {
  const f = lm(x as number[][], y as number[], {}); const n = y.length; const k = x[0]!.length;
  const X = x.map((r) => [1, ...r]); const p = k + 1;
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((s, r) => s + r[i]! * r[j]!, 0)));
  const inv = invertSmall(A);
  const hii = X.map((r) => r.reduce((s, v, i) => s + v * r.reduce((s2, w, j) => s2 + inv[i]![j]! * w, 0), 0));
  const e = f.residuals; const sse = e.reduce((a, v) => a + v * v, 0);
  const CV = meanOf(e.map((v, i) => (v / (1 - hii[i]!)) ** 2));
  const AIC = n * Math.log(sse / n) + 2 * (k + 2);
  const AICc = AIC + (2 * (k + 2) * (k + 3)) / (n - k - 3);
  const BIC = AIC + (k + 2) * (Math.log(n) - 2);
  const ym = meanOf(y); const sst = y.reduce((a, v) => a + (v - ym) ** 2, 0);
  const AdjR2 = 1 - ((sse / sst) * (n - 1)) / (n - k - 1);
  return { CV, AIC, AICc, BIC, AdjR2 };
}

function invertSmall(A: number[][]): number[][] {
  const k = A.length; const M = A.map((r, i) => [...r, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < k; i++) {
    let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(M[r]![i]!) > Math.abs(M[p]![i]!)) p = r;
    [M[i], M[p]] = [M[p]!, M[i]!]; const d = M[i]![i]!;
    for (let c = 0; c < 2 * k; c++) M[i]![c]! /= d;
    for (let r = 0; r < k; r++) if (r !== i) { const fct = M[r]![i]!; for (let c = 0; c < 2 * k; c++) M[r]![c]! -= fct * M[i]![c]!; }
  }
  return M.map((r) => r.slice(k));
}

/**
 * The Ljung-Box test of a model's residuals (forecast's `checkresiduals()`, without the plots): lag = min(2m, n/5) for
 * seasonal data or min(10, n/5), at least df + 3, df = the number of ARMA coefficients (0 for plain residuals).
 *
 * @category Time series
 */
export function checkresiduals(residuals: readonly number[], options: { frequency?: number; df?: number } = {}): { statistic: number; parameter: number; pValue: number; lag: number } {
  const res = residuals.filter(Number.isFinite); const n = res.length; const m = options.frequency ?? 1; const df = options.df ?? 0;
  let lag = m > 1 ? Math.min(2 * m, n / 5) : Math.min(10, n / 5);
  lag = Math.max(df + 3, lag); lag = Math.floor(lag);
  const r = boxTest(res, { lag, type: "Ljung-Box", fitdf: df });
  return { statistic: r.statistic, parameter: r.parameter, pValue: r.pValue, lag };
}

/** The number of ARMA coefficients of a fit (for checkresiduals' df). */
export function armaCoefficients(fit: ArimaResult): number { return fit.arma[0] + fit.arma[1] + fit.arma[2] + fit.arma[3]; }

/**
 * Time series cross-validation (forecast's `tsCV()`): for each origin t the forecast errors of y_{t+1..t+h} from the fit
 * to y_1..y_t, stored in row t (NaN where unavailable).
 *
 * @category Time series
 */
export function tsCV(y: readonly number[], forecastFun: (y: number[], h: number) => readonly number[], options: { h?: number } = {}): number[][] {
  const h = options.h ?? 1; const n = y.length;
  return Array.from({ length: n }, (_, t) => {
    let fc: readonly number[] | null = null;
    try { fc = forecastFun(y.slice(0, t + 1), h); } catch { fc = null; }
    return Array.from({ length: h }, (_, k) => (fc && t + k + 1 < n ? y[t + k + 1]! - fc[k]! : NaN));
  });
}

/** The (p, d, q) or (p, d, q, P, D, Q, frequency) of an ARIMA fit (forecast's `arimaorder()`). @category Time series */
export function arimaorder(fit: ArimaResult): Record<string, number> {
  const [p, q, P, Q, s, d, D] = fit.arma;
  return P + D + Q > 0 && s > 1 ? { p, d, q, P, D, Q, Frequency: s } : { p, d, q };
}

// ---------------------------------------------------------------------------------------------------------------
// findfrequency (spec.ar)

/** The AR spectrum (stats' `spec.ar()` at n.freq frequencies 0..0.5) of x: var.pred / |1 - sum a_k e^{-2 pi i f k}|^2. */
export function specAr(x: readonly number[], options: { nFreq?: number } = {}): { freq: number[]; spec: number[]; order: number } {
  const fit = ar(x); const nf = options.nFreq ?? 500;
  const freq = Array.from({ length: nf }, (_, i) => (0.5 * i) / (nf - 1));
  const spec = freq.map((f) => {
    let re = 1, im = 0;
    for (let k = 0; k < fit.order; k++) { re -= fit.ar[k]! * Math.cos(2 * Math.PI * f * (k + 1)); im += fit.ar[k]! * Math.sin(2 * Math.PI * f * (k + 1)); }
    return fit.varPred / (re * re + im * im);
  });
  return { freq, spec, order: fit.order };
}

/**
 * The dominant period of a series (forecast's `findfrequency()`): 1 unless the maximum of the AR spectrum of the
 * detrended series exceeds 10; then round(1 / f) at the maximum, or, when the maximum is at the lowest frequency, at
 * the largest value after the spectrum first rises (1 if that is the last frequency).
 *
 * @category Time series
 */
export function findfrequency(x: readonly number[]): number {
  const xs = x.filter(Number.isFinite); const res = lm(xs.map((_, t) => [t + 1]), xs, {}).residuals;
  const { freq, spec } = specAr(res);
  if (Math.max(...spec) <= 10) return 1;
  let jm = 0; for (let j = 1; j < spec.length; j++) if (spec[j]! > spec[jm]!) jm = j;
  if (jm > 0) return Math.round(1 / freq[jm]!);
  let st = -1; for (let j = 0; j + 1 < spec.length; j++) if (spec[j + 1]! - spec[j]! > 0) { st = j; break; }
  if (st < 0) return 1;
  let j = st + 1; for (let k = st + 1; k < spec.length; k++) if (spec[k]! > spec[j]!) j = k;
  return j < spec.length - 1 ? Math.round(1 / freq[j]!) : 1;
}

// ---------------------------------------------------------------------------------------------------------------
// na.interp, tsoutliers, tsclean

/** Linear interpolation of the NaNs, constant beyond the ends (approx rule = 2). */
function approxRule2(x: readonly number[]): number[] {
  const idx = x.map((v, i) => (Number.isNaN(v) ? -1 : i)).filter((i) => i >= 0);
  if (idx.length === 0) return x.slice();
  return x.map((v, i) => {
    if (!Number.isNaN(v)) return v;
    if (i < idx[0]!) return x[idx[0]!]!; if (i > idx[idx.length - 1]!) return x[idx[idx.length - 1]!]!;
    let k = 0; while (idx[k + 1]! < i) k++; const a = idx[k]!, b = idx[k + 1]!;
    return x[a]! + ((x[b]! - x[a]!) * (i - a)) / (b - a);
  });
}

/**
 * Interpolation of missing values (forecast's `na.interp()`): linear for non-seasonal series (or at most two periods
 * observed); for seasonal series the seasonal component of a robust mstl of a first filling (lm on Fourier terms K =
 * min(5, floor(m/2)) and a polynomial of degree min(6, floor(n/10))), the seasonally adjusted series interpolated
 * linearly.
 *
 * @category Time series
 */
export function naInterp(x: readonly number[], options: { frequency?: number } = {}): number[] {
  const m = options.frequency ?? 1; const n = x.length; const obs = x.filter((v) => !Number.isNaN(v)).length;
  if (!x.some((v) => Number.isNaN(v))) return x.slice();
  if (m <= 1 || obs <= 2 * m) return approxRule2(x);
  const K = Math.min(5, Math.floor(m / 2)); const deg = Math.min(6, Math.floor(n / 10));
  const four = fourier({ frequency: m, K, n }).columns;
  // the polynomial in t centred and scaled (the fit is invariant to the basis)
  const tm = (n + 1) / 2, ts = n / 2;
  const rowsAll = x.map((_, t) => [...four.map((c) => c[t]!), ...Array.from({ length: deg }, (_, d) => ((t + 1 - tm) / ts) ** (d + 1))]);
  const okIdx = x.map((v, i) => (Number.isNaN(v) ? -1 : i)).filter((i) => i >= 0);
  const f = lm(okIdx.map((i) => rowsAll[i]!), okIdx.map((i) => x[i]!), {});
  const pred = (r: number[]): number => f.coefficients[0]! + r.reduce((s, v, j) => s + v * f.coefficients[j + 1]!, 0);
  const filled = x.map((v, i) => (Number.isNaN(v) ? pred(rowsAll[i]!) : v));
  const seas = mstl(filled, { frequency: m, robust: true }).seasonal ?? new Array<number>(n).fill(0);
  const adj = approxRule2(x.map((v, i) => v - seas[i]!));
  return adj.map((v, i) => v + seas[i]!);
}

const quantile7 = (v: readonly number[], p: number): number => {
  const s = v.filter(Number.isFinite).sort((a, b) => a - b); const h = (s.length - 1) * p; const lo = Math.floor(h);
  return s[lo]! + (h - lo) * ((s[Math.min(lo + 1, s.length - 1)] ?? s[lo]!) - s[lo]!);
};

function outlierPass(x: readonly number[], m: number): number[] {
  const n = x.length; const xi = naInterp(x, { frequency: m });
  let resid: number[];
  if (m > 1 && n > 2 * m) {
    const adj = seasadj(mstl(xi, { frequency: m, robust: true }));
    const sm = supsmu(adj.map((_, t) => t + 1), adj).y; resid = adj.map((v, i) => v - sm[i]!);
  } else { const sm = supsmu(xi.map((_, t) => t + 1), xi).y; resid = xi.map((v, i) => v - sm[i]!); }
  resid = resid.map((v, i) => (Number.isNaN(x[i]!) ? NaN : v));
  const q1 = quantile7(resid, 0.25), q3 = quantile7(resid, 0.75); const iqr = q3 - q1;
  return resid.map((v, i) => (Number.isFinite(v) && (v < q1 - 3 * iqr || v > q3 + 3 * iqr) ? i : -1)).filter((i) => i >= 0);
}

/**
 * Outliers and their replacements (forecast's `tsoutliers()`): the remainder of seasadj(robust mstl) minus supsmu (or x
 * minus supsmu), points outside [Q1 - 3 IQR, Q3 + 3 IQR], replaced by na.interp with them removed; `iterate` passes
 * (default 2), the union of the flags.
 *
 * @category Time series
 */
export function tsoutliers(x: readonly number[], options: { frequency?: number; iterate?: number } = {}): { index: number[]; replacements: number[] } {
  const m = options.frequency ?? 1; const it = options.iterate ?? 2;
  let flags = new Set<number>(); let cur = x.slice();
  for (let k = 0; k < it; k++) {
    const idx = outlierPass(cur, m);
    if (idx.length === 0) break;
    idx.forEach((i) => flags.add(i));
    const removed = x.map((v, i) => (flags.has(i) ? NaN : v));
    cur = naInterp(removed, { frequency: m });
  }
  const index = [...flags].sort((a, b) => a - b);
  if (index.length === 0) return { index: [], replacements: [] };
  const filled = naInterp(x.map((v, i) => (flags.has(i) ? NaN : v)), { frequency: m });
  flags = new Set(index);
  return { index, replacements: index.map((i) => filled[i]!) };
}

/**
 * The series with missing values interpolated and outliers replaced (forecast's `tsclean()`).
 *
 * @category Time series
 */
export function tsclean(x: readonly number[], options: { frequency?: number; replaceMissing?: boolean; iterate?: number } = {}): number[] {
  const m = options.frequency ?? 1;
  const base = options.replaceMissing ?? true ? naInterp(x, { frequency: m }) : x.slice();
  const o = tsoutliers(x, { frequency: m, ...(options.iterate !== undefined ? { iterate: options.iterate } : {}) });
  const out = base.slice(); o.index.forEach((i, k) => { out[i] = o.replacements[k]!; });
  return out;
}

/** mstl's components (forecast's `seasonal()`, `trendcycle()`, `remainder()`). @category Time series */
export function seasonalComponent(dec: { seasonal?: number[]; data: number[] }): number[] { return dec.seasonal ?? dec.data.map(() => 0); }
export function trendcycle(dec: { trend: number[] }): number[] { return dec.trend.slice(); }
export function remainder(dec: { remainder: number[] }): number[] { return dec.remainder.slice(); }
