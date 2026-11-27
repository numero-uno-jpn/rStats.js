// tseries' tests: adf.test, kpss.test, pp.test, po.test, jarque.bera.test, runs.test, white.test and terasvirta.test.
// Written for rStats.js from the behaviour specification oracle/tsmeta-behaviour.md ("tseries") with the details found
// in experiments/tsmeta120-log.md (items 6-9, 14-15, 17-18, 94). The p-value tables are Fuller's (1976) Tables 8.5.1
// and 8.5.2 and Phillips and Ouliaris' (1990) Tables Ia and Ib, as published (log 18, 94). No R or package source was
// read.

import { pchisq } from "../distributions/chisq.js";
import { pf } from "../distributions/f.js";
import { pnorm } from "../distributions/normal.js";
import { prcomp } from "../linalg/lu.js";
import { lm } from "../models/lm.js";
import { runif } from "../random/continuous.js";
import { setSeed } from "../random/rng.js";
import { kpssPValue, kpssStatistic } from "./forecastArima.js";

/** A test result of the tseries functions. */
export interface TseriesTest { statistic: number; parameter: number | number[]; pValue: number; method: string }

const approx = (xs: readonly number[], ys: readonly number[], x: number): number => {
  if (x <= xs[0]!) return ys[0]!;
  if (x >= xs[xs.length - 1]!) return ys[ys.length - 1]!;
  let i = 0; while (xs[i + 1]! < x) i++;
  return ys[i]! + ((ys[i + 1]! - ys[i]!) * (x - xs[i]!)) / (xs[i + 1]! - xs[i]!);
};

// Fuller (1976), with a trend: rows n = 25, 50, 100, 250, 500, infinity (coded 100000, log 94)
const FULLER_N = [25, 50, 100, 250, 500, 100000];
const FULLER_P = [0.01, 0.025, 0.05, 0.1, 0.9, 0.95, 0.975, 0.99];
const TAU_TAU = [[-4.38, -3.95, -3.6, -3.24, -1.14, -0.8, -0.5, -0.15], [-4.15, -3.8, -3.5, -3.18, -1.19, -0.87, -0.58, -0.24], [-4.04, -3.73, -3.45, -3.15, -1.22, -0.9, -0.62, -0.28],
  [-3.99, -3.69, -3.43, -3.13, -1.23, -0.92, -0.64, -0.31], [-3.98, -3.68, -3.42, -3.13, -1.24, -0.93, -0.65, -0.32], [-3.96, -3.66, -3.41, -3.12, -1.25, -0.94, -0.66, -0.33]];
const RHO_TAU = [[-22.5, -19.9, -17.9, -15.6, -3.66, -2.51, -1.53, -0.43], [-25.7, -22.4, -19.8, -16.8, -3.71, -2.6, -1.66, -0.65], [-27.4, -23.6, -20.7, -17.5, -3.74, -2.62, -1.73, -0.75],
  [-28.4, -24.4, -21.3, -18, -3.75, -2.64, -1.78, -0.82], [-28.9, -24.8, -21.5, -18.1, -3.76, -2.65, -1.78, -0.84], [-29.5, -25.1, -21.8, -18.3, -3.77, -2.66, -1.79, -0.87]];
/** The table interpolated over n at N, then over the statistic (clamped to the table's p range). */
function fullerP(table: readonly (readonly number[])[], N: number, stat: number): number {
  const crit = FULLER_P.map((_, j) => approx(FULLER_N, table.map((r) => r[j]!), N));
  return approx(crit, FULLER_P, stat);
}

/** The Bartlett-weighted long-run variance of e (sums over m) with truncation lag l. */
function neweyWest(e: readonly number[], l: number, m = e.length): number {
  let v = e.reduce((a, x) => a + x * x, 0) / m;
  for (let s = 1; s <= l; s++) { let c = 0; for (let t = s; t < e.length; t++) c += e[t]! * e[t - s]!; v += (2 * (1 - s / (l + 1)) * c) / m; }
  return v;
}

const finite = (x: readonly number[], what: string): number[] => {
  const y = x.map(Number);
  if (y.some((v) => !Number.isFinite(v))) throw new RangeError(`${what}: x must not contain missing or infinite values`);
  return y;
};

/**
 * The augmented Dickey-Fuller test (tseries' `adf.test()`): Delta y_t on 1, t, y_{t-1} and k lagged differences
 * (default k = trunc((n - 1)^(1/3))), the t value of y_{t-1}; p from Fuller's tau_tau table at n - 1 (clamped to
 * [0.01, 0.99]); "explosive" gives 1 - p.
 *
 * @category Time series
 */
export function adfTest(x: readonly number[], options: { alternative?: "stationary" | "explosive"; k?: number } = {}): TseriesTest {
  const y = finite(x, "adfTest"); const k = options.k ?? Math.trunc((y.length - 1) ** (1 / 3));
  if (!(Number.isInteger(k) && k >= 0)) throw new RangeError("adfTest: k must be a non-negative integer");
  const d = y.slice(1).map((v, i) => v - y[i]!); const n = d.length;
  if (n - k < 4) throw new RangeError("adfTest: the series is too short for k lags");
  const rows: number[][] = [], resp: number[] = [];
  for (let t = k; t < n; t++) { rows.push([y[t]!, t + 1, ...Array.from({ length: k }, (_, i) => d[t - 1 - i]!)]); resp.push(d[t]!); }
  const statistic = lm(rows, resp, {}).coefTable.tValue[1]!;
  let p = fullerP(TAU_TAU, n, statistic); if (options.alternative === "explosive") p = 1 - p;
  return { statistic, parameter: k, pValue: p, method: "Augmented Dickey-Fuller Test" };
}

/**
 * The KPSS test (tseries' `kpss.test()`): the null "Level" or "Trend", truncation lag trunc(4 (n/100)^0.25) (`lshort`)
 * or trunc(12 (n/100)^0.25); p interpolated in the KPSS table (clamped to [0.01, 0.10]).
 *
 * @category Time series
 */
export function kpssTest(x: readonly number[], options: { null?: "Level" | "Trend"; lshort?: boolean } = {}): TseriesTest {
  const y = finite(x, "kpssTest"); const n = y.length; const type = options.null === "Trend" ? "trend" : "level";
  const l = Math.trunc((options.lshort ?? true ? 4 : 12) * (n / 100) ** 0.25);
  const statistic = kpssStatistic(y, type, l);
  return { statistic, parameter: l, pValue: kpssPValue(statistic, type), method: `KPSS Test for ${type === "trend" ? "Trend" : "Level"} Stationarity` };
}

/**
 * The Phillips-Perron test (tseries' `pp.test()`): y_t on 1, t, y_{t-1}; Phillips and Perron's closed forms with
 * det(X'X) (log 8), type "Z(alpha)" (default, as R) or "Z(t_alpha)", truncation lag trunc(4 (n/100)^0.25) (`lshort`)
 * or trunc(12 (n/100)^0.25); p from Fuller's n(rho - 1) or tau_tau table at n - 1; "explosive" gives 1 - p.
 *
 * @category Time series
 */
export function ppTest(x: readonly number[], options: { alternative?: "stationary" | "explosive"; type?: "Z(alpha)" | "Z(t_alpha)"; lshort?: boolean } = {}): TseriesTest {
  const y = finite(x, "ppTest"); const n = y.length; const nn = n - 1;
  const l = Math.trunc((options.lshort ?? true ? 4 : 12) * (n / 100) ** 0.25);
  const rows: number[][] = [], resp: number[] = [];
  for (let t = 1; t < n; t++) { rows.push([t, y[t - 1]!]); resp.push(y[t]!); }
  const f = lm(rows, resp, {}); const rho = f.coefficients[2]!; const tr = (rho - 1) / f.coefTable.stdError[2]!;
  const u = f.residuals; const su2 = u.reduce((a, b) => a + b * b, 0) / nn; const lam = neweyWest(u, l, nn);
  let s00 = 0, s01 = 0, s02 = 0, s11 = 0, s12 = 0, s22 = 0;
  for (let t = 1; t < n; t++) { const a = t, b = y[t - 1]!; s00 += 1; s01 += a; s02 += b; s11 += a * a; s12 += a * b; s22 += b * b; }
  const Dx = s00 * (s11 * s22 - s12 * s12) - s01 * (s01 * s22 - s12 * s02) + s02 * (s01 * s12 - s11 * s02);
  const type = options.type ?? "Z(alpha)";
  const statistic = type === "Z(alpha)"
    ? nn * (rho - 1) - (nn ** 6 / (24 * Dx)) * (lam - su2)
    : Math.sqrt(su2 / lam) * tr - ((lam - su2) * nn ** 3) / (4 * Math.sqrt(3) * Math.sqrt(Dx) * Math.sqrt(lam));
  let p = fullerP(type === "Z(alpha)" ? RHO_TAU : TAU_TAU, nn, statistic); if (options.alternative === "explosive") p = 1 - p;
  return { statistic, parameter: l, pValue: p, method: "Phillips-Perron Unit Root Test" };
}

// Phillips and Ouliaris (1990), Table Ib (demeaned) and Ia, rows: 2..6 variables (log 18)
const PO_P = [0.01, 0.025, 0.05, 0.075, 0.1, 0.125, 0.15];
const PO_TABLE: Record<"demean" | "plain", number[][]> = {
  demean: [[-28.32, -23.81, -20.49, -18.48, -17.04, -15.93, -14.91], [-34.17, -29.74, -26.09, -23.87, -22.19, -21.04, -19.95], [-41.13, -35.71, -32.06, -29.51, -27.58, -26.23, -25.05],
    [-47.51, -41.64, -37.15, -34.71, -32.74, -31.15, -29.88], [-52.17, -46.53, -41.94, -39.11, -37.01, -35.48, -34.2]],
  plain: [[-22.83, -18.89, -15.64, -13.81, -12.54, -11.57, -10.74], [-29.27, -25.21, -21.48, -19.61, -18.18, -17.01, -16.02], [-36.16, -31.54, -27.85, -25.52, -23.92, -22.62, -21.53],
    [-42.87, -37.48, -33.48, -30.93, -28.85, -27.4, -26.17], [-48.52, -42.55, -38.09, -35.51, -33.8, -32.27, -30.9]],
};

/**
 * The Phillips-Ouliaris cointegration test (tseries' `po.test()`): x has 2 to 6 columns (variables) as rows of
 * observations; u = the residuals of the first column on the others (with an intercept when `demean`, default),
 * Z = (n - 1)(rho - 1) - (lambda^2 - s^2) / (2 sum u_{t-1}^2 / (n - 1)^2) from u_t on u_{t-1}; lag trunc((n - 1)/100)
 * (`lshort`) or trunc((n - 1)/30); p from Table Ib / Ia (clamped to [0.01, 0.15]).
 *
 * @category Time series
 */
export function poTest(x: readonly (readonly number[])[], options: { demean?: boolean; lshort?: boolean } = {}): TseriesTest {
  const X = x.map((r) => finite(r, "poTest")); const n = X.length; const k = X[0]?.length ?? 0;
  if (k < 2 || k > 6) throw new RangeError("poTest: x must have 2 to 6 columns");
  const demean = options.demean ?? true; const nn = n - 1;
  const l = Math.trunc((nn) / (options.lshort ?? true ? 100 : 30));
  const u = lm(X.map((r) => r.slice(1)), X.map((r) => r[0]!), { intercept: demean }).residuals;
  const g = lm(u.slice(0, n - 1).map((v) => [v]), u.slice(1), { intercept: false });
  const rho = g.coefficients[0]!; const e = g.residuals;
  const su2 = e.reduce((a, b) => a + b * b, 0) / nn; const lam = neweyWest(e, l, nn);
  const sxx = u.slice(0, n - 1).reduce((a, b) => a + b * b, 0);
  const statistic = nn * (rho - 1) - (lam - su2) / ((2 * sxx) / (nn * nn));
  const pValue = approx(PO_TABLE[demean ? "demean" : "plain"][k - 2]!, PO_P, statistic);
  return { statistic, parameter: l, pValue, method: "Phillips-Ouliaris Cointegration Test" };
}

/**
 * The Jarque-Bera test for normality (tseries' `jarque.bera.test()`): n (S^2/6 + (K - 3)^2/24) with the moments over n,
 * chi-squared with 2 df.
 *
 * @category Time series
 */
export function jarqueBeraTest(x: readonly number[]): TseriesTest {
  const y = finite(x, "jarqueBeraTest"); const n = y.length; const m = y.reduce((a, b) => a + b, 0) / n;
  const c = y.map((v) => v - m); const m2 = c.reduce((a, v) => a + v * v, 0) / n;
  const S = c.reduce((a, v) => a + v ** 3, 0) / n / m2 ** 1.5; const K = c.reduce((a, v) => a + v ** 4, 0) / n / m2 ** 2;
  const statistic = n * (S * S / 6 + (K - 3) ** 2 / 24);
  return { statistic, parameter: 2, pValue: pchisq(statistic, 2, { lowerTail: false }) as number, method: "Jarque Bera Test" };
}

/**
 * The Wald-Wolfowitz runs test (tseries' `runs.test()`) of a two-valued sequence: z = (R - mean) / sd with mean 1 +
 * 2 n1 n2 / n and variance 2 n1 n2 (2 n1 n2 - n) / (n^2 (n - 1)), normal p for "two.sided" (default), "less" or
 * "greater".
 *
 * @category Time series
 */
export function runsTest(x: readonly (boolean | number | string)[], options: { alternative?: "two.sided" | "less" | "greater" } = {}): TseriesTest {
  const levels = [...new Set(x)];
  if (levels.length !== 2) throw new RangeError("runsTest: x must take exactly two values");
  const n = x.length; const n1 = x.filter((v) => v === levels[0]).length; const n2 = n - n1;
  let R = 1; for (let i = 1; i < n; i++) if (x[i] !== x[i - 1]) R++;
  const mean = 1 + (2 * n1 * n2) / n; const v = (2 * n1 * n2 * (2 * n1 * n2 - n)) / (n * n * (n - 1));
  const z = (R - mean) / Math.sqrt(v); const alt = options.alternative ?? "two.sided";
  const pValue = alt === "two.sided" ? 2 * (pnorm(-Math.abs(z)) as number) : alt === "less" ? (pnorm(z) as number) : (pnorm(z, { lowerTail: false }) as number);
  return { statistic: z, parameter: [], pValue, method: "Runs Test" };
}

const scaleSeries = (y: readonly number[]): number[] => {
  const n = y.length; const m = y.reduce((a, b) => a + b, 0) / n; const s = Math.sqrt(y.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  return y.map((v) => (v - m) / s);
};
/** y_t and its lags 1..lag (rows t = lag..n-1). */
const embedLags = (y: readonly number[], lag: number): { resp: number[]; lags: number[][] } => {
  const resp: number[] = [], lags: number[][] = [];
  for (let t = lag; t < y.length; t++) { resp.push(y[t]!); lags.push(Array.from({ length: lag }, (_, i) => y[t - 1 - i]!)); }
  return { resp, lags };
};
const ssr = (X: number[][], y: number[]): number => lm(X, y, {}).residuals.reduce((a, b) => a + b * b, 0);

function nonlinearityResult(n: number, m: number, df: number, ssr0: number, ssr1: number, type: "Chisq" | "F", method: string): TseriesTest {
  if (type === "F") {
    const statistic = ((ssr0 - ssr1) / df) / (ssr1 / (m - df));
    return { statistic, parameter: [df, m - df], pValue: pf(statistic, df, m - df, { lowerTail: false }) as number, method };
  }
  const statistic = n * Math.log(ssr0 / ssr1);
  return { statistic, parameter: df, pValue: pchisq(statistic, df, { lowerTail: false }) as number, method };
}

/**
 * Teraesvirta's neural network test for neglected nonlinearity (tseries' `terasvirta.test()`): y_t on 1 and its lags,
 * then also on the second and third order products of the lags; Chisq = n log(SSR0 / SSR1) (n the series length) or
 * F on (df, n - lag - df) (log 14). The series is standardised when `scale` (default).
 *
 * @category Time series
 */
export function terasvirtaTest(x: readonly number[], options: { lag?: number; type?: "Chisq" | "F"; scale?: boolean } = {}): TseriesTest {
  let y = finite(x, "terasvirtaTest"); const lag = options.lag ?? 1; if (options.scale ?? true) y = scaleSeries(y);
  const { resp, lags } = embedLags(y, lag); const m = resp.length;
  const prods = lags.map((r) => {
    const out: number[] = [];
    for (let i = 0; i < lag; i++) for (let j = i; j < lag; j++) out.push(r[i]! * r[j]!);
    for (let i = 0; i < lag; i++) for (let j = i; j < lag; j++) for (let k = j; k < lag; k++) out.push(r[i]! * r[j]! * r[k]!);
    return out;
  });
  const df = prods[0]!.length;
  return nonlinearityResult(y.length, m, df, ssr(lags, resp), ssr(lags.map((r, t) => [...r, ...prods[t]!]), resp), options.type ?? "Chisq", "Teraesvirta Neural Network Test");
}

/**
 * White's neural network test for neglected nonlinearity (tseries' `white.test()`): q logistic hidden units with
 * weights runif((lag + 1) q, -range/2, range/2) (by columns, the first row on the constant), their principal components
 * 2..qstar + 1 (standardised), then the statistic as {@link terasvirtaTest} (log 15). The weights come from rStats.js's
 * R-compatible generator: with `seed` (R's `set.seed`) the value equals R's; without, the current stream is used.
 *
 * @category Time series
 */
export function whiteTest(x: readonly number[], options: { lag?: number; qstar?: number; q?: number; range?: number; type?: "Chisq" | "F"; scale?: boolean; seed?: number } = {}): TseriesTest {
  let y = finite(x, "whiteTest"); const lag = options.lag ?? 1; const q = options.q ?? 10; const qstar = options.qstar ?? 2; const range = options.range ?? 4;
  if (options.scale ?? true) y = scaleSeries(y);
  const { resp, lags } = embedLags(y, lag); const m = resp.length;
  if (options.seed !== undefined) setSeed(options.seed);
  const w = runif((lag + 1) * q, { min: -range / 2, max: range / 2 });
  const W = (i: number, j: number): number => w[j * (lag + 1) + i]!; // column-major (lag + 1) x q
  const hidden = lags.map((r) => Array.from({ length: q }, (_, j) => {
    let s = W(0, j); for (let i = 0; i < lag; i++) s += r[i]! * W(i + 1, j);
    return 1 / (1 + Math.exp(-s));
  }));
  const pc = prcomp(hidden, { scale: true }).x.map((r) => r.slice(1, qstar + 1));
  return nonlinearityResult(y.length, m, qstar, ssr(lags, resp), ssr(lags.map((r, t) => [...r, ...pc[t]!]), resp), options.type ?? "Chisq", "White Neural Network Test");
}
