// forecast's simple methods and small functions against R (test/fixtures/forecastSimple.json from
// oracle/forecastSimple.R; behaviour in oracle/tsmeta-behaviour.md, experiments/tsmeta120-log.md items 28-35, 47, 51-60).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  accuracy, arima, arimaorder, bizdays, checkresiduals, croston, cvLm, dmTest, easter, findfrequency, fourier, holt, hw, ma, meanf, monthdays,
  mstl, naInterp, naive, remainder, rwf, seasonalComponent, seasonaldummy, ses, snaive, stlf, thetaf, trendcycle, tsCV, tsclean, tslm, tsoutliers,
  type AccuracyRow, type SimpleForecast,
} from "../src/entries/timeseries.js";
import { etsAt, forecastEts, type EtsParameters, type EtsSpec } from "../src/timeseries/ets.js";
import { ar, forecast, forecastStlm, holtWinters, stlm } from "../src/entries/timeseries.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/forecastSimple.json", import.meta.url), "utf8")) as Record<string, any>;
const num = (v: unknown): number => (v === null ? NaN : Number(v));
const arr = (v: unknown): number[] => (Array.isArray(v) ? v.map(num) : [num(v)]);
const mat = (v: unknown): number[][] => (v as unknown[][]).map((r) => (Array.isArray(r) ? r.map(num) : [num(r)]));
/** Largest relative difference (NaN positions must agree). */
const rel = (a: readonly number[], e: readonly number[]): number => {
  if (a.length !== e.length) return Infinity;
  return Math.max(0, ...a.map((v, i) => { const w = e[i]!; if (Number.isNaN(w) || Number.isNaN(v)) return Number.isNaN(w) === Number.isNaN(v) ? 0 : Infinity; return Math.abs(v - w) / Math.max(1, Math.abs(w)); }));
};
const D = fx.data; const nile = arr(D.nile), usacc = arr(D.usacc), air = arr(D.air), ukgas = arr(D.ukgas), rw = arr(D.rw);
const fcDiff = (f: SimpleForecast, r: any): number => Math.max(rel(f.mean, arr(r.mean)), rel(f.lower.flat(), mat(r.lower).flat()), rel(f.upper.flat(), mat(r.upper).flat()),
  rel(f.fitted, arr(r.fitted)), rel(f.residuals, arr(r.residuals)));

const sp = (error: "A" | "M", trend: "N" | "A" | "M", damped: boolean, season: "N" | "A" | "M", m = 1): EtsSpec => ({ error, trend, damped, season, m });
const parOf = (p: any): EtsParameters => {
  const s = Object.keys(p).filter((k) => /^s\d+$/.test(k)).map((k) => num(p[k]));
  const o: Record<string, unknown> = { alpha: num(p.alpha), l: num(p.l) };
  for (const k of ["beta", "gamma", "phi", "b"]) if (p[k] !== undefined) o[k] = num(p[k]);
  if (s.length) o.s = s;
  return o as unknown as EtsParameters;
};

describe("simple methods (forecast)", () => {
  it("meanf, naive, rwf, snaive", () => {
    const b = fx.basic; const out: Record<string, number> = {
      meanf: fcDiff(meanf(nile, { h: 7 }), b.meanf), meanf_lvl: fcDiff(meanf(nile, { h: 3, level: [50, 90, 99] }), b.meanf_lvl),
      naive: fcDiff(naive(nile, { h: 6 }), b.naive), rwf: fcDiff(rwf(rw, { h: 8 }), b.rwf), rwf_drift: fcDiff(rwf(rw, { h: 8, drift: true }), b.rwf_drift),
      snaive_usacc: fcDiff(snaive(usacc, { frequency: 12 }), b.snaive_usacc), snaive_ukgas: fcDiff(snaive(ukgas, { frequency: 4, h: 11 }), b.snaive_ukgas),
    };
    for (const [k, v] of Object.entries(out)) expect(v, k).toBeLessThan(1e-10);
    expect(meanf(nile).method).toBe(b.meanf.method);
  });
  // ses, holt, hw: at R's own estimates (no estimation) the filter and forecasts must be R's; the estimation itself must
  // reach R's criterion or better (experiments/tsmeta120-log.md item 91: ours is higher in every case)
  const E = fx.ets_based;
  const etsCases: [string, () => SimpleForecast, number[], EtsSpec, boolean][] = [
    ["ses", () => ses(nile, { h: 5 }), nile, sp("A", "N", false, "N"), false],
    ["ses_simple", () => ses(nile, { h: 5, initial: "simple" }), nile, sp("A", "N", false, "N"), true],
    ["ses_alpha", () => ses(nile, { h: 5, alpha: 0.3 }), nile, sp("A", "N", false, "N"), false],
    ["holt", () => holt(rw, { h: 6 }), rw, sp("A", "A", false, "N"), false],
    ["holt_damped", () => holt(rw, { h: 6, damped: true }), rw, sp("A", "A", true, "N"), false],
    ["holt_simple", () => holt(rw, { h: 6, initial: "simple" }), rw, sp("A", "A", false, "N"), true],
    ["holt_exp", () => holt(nile, { h: 6, exponential: true }), nile, sp("M", "M", false, "N"), false],
    ["hw_add", () => hw(usacc, { frequency: 12 }), usacc, sp("A", "A", false, "A", 12), false],
    ["hw_add_damped", () => hw(usacc, { frequency: 12, damped: true }), usacc, sp("A", "A", true, "A", 12), false],
    ["hw_add_simple", () => hw(usacc, { frequency: 12, initial: "simple" }), usacc, sp("A", "A", false, "A", 12), true],
    ["hw_mult_simple", () => hw(air, { frequency: 12, seasonal: "multiplicative", initial: "simple" }), air, sp("M", "A", false, "M", 12), true],
  ];
  for (const [name, run, y, spec, simple] of etsCases) {
    it(`${name}: at R's estimates`, () => {
      const r = E[name]; const par = parOf(r.model.par);
      // initial = "simple": R's beta is the Holt-Winters beta*, the ets beta is alpha beta*; R's sigma2 is SSE / n
      if (simple && par.beta !== undefined) par.beta *= par.alpha;
      const f = etsAt(y, spec, par, Object.keys(r.model.par).length);
      if (simple) f.sigma2 = f.residuals.reduce((a, v) => a + v * v, 0) / y.length;
      const fc = forecastEts(f, { h: arr(r.mean).length, level: arr(r.level) });
      // the multiplicative mean carries the variance, so hw(multiplicative, "simple") departs there too
      if (!(simple && spec.season === "M")) expect(rel(fc.mean, arr(r.mean))).toBeLessThan(1e-12);
      expect(rel(f.fitted, arr(r.fitted))).toBeLessThan(1e-12);
      const res = simple ? y.map((v, i) => v - f.fitted[i]!) : f.residuals;
      expect(rel(res, arr(r.residuals))).toBeLessThan(1e-12);
      // R's MMN intervals are simulated (unseeded); hw's "simple" intervals put R's beta* into the ets variance as if
      // it were beta (a departure, log 91), checked against our formula's own consistency only
      if (spec.trend !== "M" && !(simple && spec.season !== "N")) {
        expect(rel(fc.lower.flat(), mat(r.lower).flat())).toBeLessThan(1e-12);
        expect(rel(fc.upper.flat(), mat(r.upper).flat())).toBeLessThan(1e-12);
      }
    });
    it(`${name}: the estimate reaches R's criterion`, () => {
      const r = E[name]; const f = run();
      expect(f.method).toBe(r.method);
      if (simple) {
        const sse = (v: readonly number[]): number => v.reduce((a, x) => a + x * x, 0);
        expect(sse(f.residuals)).toBeLessThanOrEqual(sse(arr(r.residuals)) * (1 + 1e-9));
      } else expect(f.model!.loglik).toBeGreaterThanOrEqual(num(r.model.loglik) - 1e-6);
    });
  }

  it("stlf: the ets part at R's estimates, and the estimate", () => {
    for (const [k, y, m, h] of [["usacc", usacc, 12, 24], ["ukgas", ukgas, 4, 6]] as const) {
      const r = fx.stlf[k]; const seas = mstl(y, { frequency: m }).seasonal!; const adj = y.map((v, i) => v - seas[i]!);
      const mm = /^ETS\((\w),(\w)(d?),(\w)\)$/.exec(r.model.method as string)!;
      const spec = sp(mm[1] as "A", mm[2] as "N", mm[3] === "d", mm[4] as "N");
      const f = etsAt(adj, spec, parOf(r.model.par), Object.keys(r.model.par).length); const fc = forecastEts(f, { h, level: [80, 95] });
      const last = seas.slice(y.length - m); const add = (i: number): number => last[i % m]!;
      expect(rel(fc.mean.map((v, i) => v + add(i)), arr(r.mean)), k).toBeLessThan(1e-10);
      expect(rel(fc.lower.flatMap((row, i) => row.map((v) => v + add(i))), mat(r.lower).flat()), k).toBeLessThan(1e-10);
      expect(rel(fc.upper.flatMap((row, i) => row.map((v) => v + add(i))), mat(r.upper).flat()), k).toBeLessThan(1e-10);
      expect(rel(f.fitted.map((v, i) => v + seas[i]!), arr(r.fitted)), k).toBeLessThan(1e-10);
      const mine = stlf(y, { frequency: m, h });
      expect(mine.model!.method, k).toBe(r.model.method);
      expect(mine.model!.loglik, k).toBeGreaterThanOrEqual(num(r.model.loglik) - 1e-6);
    }
  });
  it("croston", () => {
    const c = fx.croston; const y = arr(c.y);
    expect(rel(croston(y).fitted, arr(c.croston.fitted))).toBeLessThan(1e-12);
    // R's forecast is the state before the last observation (its last fitted value; log 91, not imitated): ours is
    // the state after it, i.e. what the next fitted value would be
    expect(arr(c.croston.mean)[0]).toBe(arr(c.croston.fitted).at(-1));
    for (const [type, alpha, e] of [["croston", 0.1, c.croston.mean], ["sba", 0.1, c.sba], ["sbj", 0.2, c.sbj]] as const) {
      const f = croston(y, { h: 4, type, alpha }); const next = croston([...y, 0], { type, alpha }).fitted.at(-1)!;
      expect(f.mean, type).toEqual(new Array(4).fill(next));
      // R's value is that of the series without its last demand
      expect(Math.abs(croston(y, { type, alpha }).fitted.at(-1)! - arr(e)[0]!), type).toBeLessThan(1e-12);
    }
  });
  it("thetaf", () => {
    // ses inside is estimated: R's optimiser stops earlier (as for ses: 3e-3 in the residuals of Nile)
    const t = fx.theta;
    for (const [k, f] of [["nile", thetaf(nile, { h: 5 })], ["rw", thetaf(rw)]] as const) {
      expect(rel(f.mean, arr(t[k].mean)), k).toBeLessThan(1e-4);
      expect(rel(f.lower.flat(), mat(t[k].lower).flat()), k).toBeLessThan(1e-4);
      expect(rel(f.upper.flat(), mat(t[k].upper).flat()), k).toBeLessThan(1e-4);
      expect(rel(f.fitted, arr(t[k].fitted)), k).toBeLessThan(1e-4);
    }
    // seasonal: R's intervals are the reseasonalised mean +- the adjusted-scale width, its residuals on the adjusted
    // scale (log 91); ours reseasonalise the bounds. Only the mean and the fitted values are compared
    for (const [k, f] of [["air", thetaf(air, { frequency: 12 })], ["usacc", thetaf(usacc, { frequency: 12, h: 6 })]] as const) {
      expect(rel(f.mean, arr(t[k].mean)), k).toBeLessThan(1e-4);
      expect(rel(f.fitted, arr(t[k].fitted)), k).toBeLessThan(1e-4);
    }
  });
  it("tslm", () => {
    const tl = tslm(usacc, { frequency: 12 }); const tf = tl.forecast(14);
    expect(tl.coefficientNames).toEqual(fx.tslm.usacc.names);
    expect(rel(tl.coefficients, arr(fx.tslm.usacc.coef))).toBeLessThan(1e-12);
    expect(rel(tl.fitted, arr(fx.tslm.usacc.fitted))).toBeLessThan(1e-12);
    expect(rel(tf.mean, arr(fx.tslm.usacc.fc.mean))).toBeLessThan(1e-12);
    expect(rel([...tf.lower.flat(), ...tf.upper.flat()], [...mat(fx.tslm.usacc.fc.lower).flat(), ...mat(fx.tslm.usacc.fc.upper).flat()])).toBeLessThan(1e-12);
    const tl2 = tslm(nile, { trend: true }); const tf2 = tl2.forecast(4, [90]);
    expect(rel(tl2.coefficients, arr(fx.tslm.nile.coef))).toBeLessThan(1e-12);
    expect(rel([...tf2.lower.flat(), ...tf2.upper.flat()], [...mat(fx.tslm.nile.fc.lower).flat(), ...mat(fx.tslm.nile.fc.upper).flat()])).toBeLessThan(1e-12);
  });
});

describe("small functions (forecast)", () => {
  it("accuracy", () => {
    // R omits ACF1 and Theil's U for a test set that is not a ts (nile here): compared on R's columns
    for (const [k, a] of Object.entries(fx.accuracy as Record<string, any>)) {
      const m = k === "usacc" ? 12 : 1;
      const r = accuracy({ y: arr(a.train), fitted: arr(a.fitted) }, { frequency: m, test: { y: arr(a.test), forecast: arr(a.forecast) } });
      const cols = (a.cols as string[]).map((c) => (c === "Theil's U" ? "TheilU" : c)) as (keyof AccuracyRow)[]; const rows = mat(a.rows);
      const pick = (row: AccuracyRow | undefined, e: number[]): [number[], number[]] => {
        const ok = cols.map((_, j) => !Number.isNaN(e[j]!)); return [cols.filter((_, j) => ok[j]).map((c) => num(row?.[c])), e.filter((_, j) => ok[j])];
      };
      expect(rel(...pick(r.training, rows[0]!)), `${k} training`).toBeLessThan(1e-10);
      expect(rel(...pick(r.test, rows[1]!)), `${k} test`).toBeLessThan(1e-10);
    }
  });
  it("ma, fourier, seasonaldummy", () => {
    const M = fx.ma;
    expect(rel(ma(nile, 5), arr(M.o5))).toBeLessThan(1e-12); expect(rel(ma(nile, 4), arr(M.o4))).toBeLessThan(1e-12);
    expect(rel(ma(nile, 4, { centre: false }), arr(M.o4nc))).toBeLessThan(1e-12); expect(rel(ma(usacc, 12), arr(M.o12))).toBeLessThan(1e-12);
    expect(rel(ma(nile, 3, { centre: false }), arr(M.o3nc))).toBeLessThan(1e-12);
    const F = fx.fourier;
    for (const [k, o] of [["k6", fourier({ frequency: 12, K: 6, n: usacc.length })], ["k3h", fourier({ frequency: 12, K: 3, n: usacc.length, h: 10 })], ["q2", fourier({ frequency: 4, K: 2, n: ukgas.length })]] as const) {
      expect(o.names, k).toEqual(F[k].names);
      const cols = mat(F[k].cols); expect(rel(o.columns.flatMap((c, j) => c.map((_, i) => o.columns[j]![i]!)), o.names.flatMap((_, j) => cols.map((r) => r[j]!))), k).toBeLessThan(1e-12);
    }
    const S = fx.seasonaldummy;
    const cmp = (o: number[][], e: number[][]): number => rel(o.flatMap((c) => c), o.flatMap((_, j) => e.map((r) => r[j]!)));
    expect(cmp(seasonaldummy({ frequency: 12, n: usacc.length }), mat(S.usacc))).toBe(0);
    expect(cmp(seasonaldummy({ frequency: 12, n: usacc.length, h: 15 }), mat(S.usacc_h))).toBe(0);
    expect(cmp(seasonaldummy({ frequency: 4, n: 10, start: 3 }), mat(S.ukgas_q3))).toBe(0);
  });
  it("monthdays, easter, bizdays", () => {
    for (const [k, c] of Object.entries(fx.calendar as Record<string, any>)) {
      const o = { startYear: num(c.startYear), startPeriod: num(c.startPeriod), n: num(c.n), frequency: num(c.frequency) as 12 | 4 };
      expect(monthdays(o), k).toEqual(arr(c.monthdays));
      expect(easter(o), k).toEqual(arr(c.easter));
      // quarterly with Easter Monday: R shifts the shares where the holidays span two quarters (Easter 2013, 31 March:
      // R warns about a replacement length; a departure, log 91). Ours: 2012 Q2 1, 2013 Q1 0.75, 2013 Q2 0.25
      const em = easter({ ...o, easterMon: true }); const rm = arr(c.easter_mon);
      const differ = em.map((v, i) => (v === rm[i] ? -1 : i)).filter((i) => i >= 0);
      expect(differ, k).toEqual(k === "q2010_2" ? [8, 11, 12] : []);
      if (k === "q2010_2") expect([em[8], em[11], em[12]]).toEqual([1, 0.75, 0.25]);
      for (const fc of ["New York", "London", "NERC", "Toronto", "Zurich"] as const) expect(bizdays({ ...o, finCenter: fc }), `${k} ${fc}`).toEqual(arr(c.bizdays[fc]));
    }
  });
  it("dm.test, CV, checkresiduals, arimaorder, tsCV", () => {
    const e1 = arr(fx.dm.e1), e2 = arr(fx.dm.e2);
    for (const [k, c] of Object.entries(fx.dm.cases as Record<string, any>)) {
      const r = dmTest(e1, e2, { alternative: c.alternative, h: num(c.h), power: num(c.power) });
      // R's parameter is (h, power); the t distribution has n - 1 degrees of freedom
      expect(rel([r.statistic, r.pValue], [num(c.statistic), num(c.p)]), k).toBeLessThan(1e-10);
      expect(r.parameter).toBe(e1.length - 1);
    }
    const season = (t: number): number[] => Array.from({ length: 11 }, (_, k) => (t % 12 === k + 1 ? 1 : 0));
    const cv1 = cvLm(usacc.map((_, t) => [t + 1, ...season(t)]), usacc); const cv2 = cvLm(nile.map((_, t) => [t + 1]), nile);
    for (const [o, e] of [[cv1, fx.cv.usacc], [cv2, fx.cv.nile]] as const) expect(rel([o.CV, o.AIC, o.AICc, o.BIC, o.AdjR2], [e.CV, e.AIC, e.AICc, e.BIC, e.AdjR2].map(num))).toBeLessThan(1e-10);
    for (const [k, c] of Object.entries(fx.checkresiduals as Record<string, any>)) {
      const r = checkresiduals(arr(c.residuals), { frequency: num(c.frequency), df: num(c.df) });
      expect(rel([r.statistic, r.parameter, r.pValue], [num(c.statistic), num(c.parameter), num(c.p)]), k).toBeLessThan(1e-10);
    }
    expect(arimaorder(arima(usacc, { order: [1, 0, 1], seasonal: { order: [0, 1, 1], period: 12 } }))).toEqual(Object.fromEntries(Object.entries(fx.arimaorder.s).map(([k, v]) => [k, num(v)])));
    expect(arimaorder(arima(nile, { order: [1, 1, 1] }))).toEqual(Object.fromEntries(Object.entries(fx.arimaorder.ns).map(([k, v]) => [k, num(v)])));
    // origin 1: R's naive fails on one observation ("missing value where TRUE/FALSE needed", tsmeta120-simple3) and
    // tsCV records NA; rStats.js's naive gives y_1 (NaN intervals), so that one error is 40 here
    const cv = tsCV(nile, (y, h) => naive(y, { h }).mean); expect(cv[0]).toEqual([nile[1]! - nile[0]!]);
    expect(rel(cv.slice(1).flat(), mat(fx.tscv.naive_h1).slice(1).flat())).toBeLessThan(1e-12);
    expect(rel(tsCV(rw, (y, h) => rwf(y, { h, drift: true }).mean, { h: 3 }).flat(), mat(fx.tscv.rwf_h3).flat())).toBeLessThan(1e-10);
  });
  it("findfrequency", () => {
    expect((fx.findfrequency as any[]).map((c) => findfrequency(arr(c.x)))).toEqual((fx.findfrequency as any[]).map((c) => num(c.f)));
  });
  it("na.interp, tsoutliers, tsclean, components", () => {
    const C = fx.clean; const out: Record<string, number> = {};
    for (const k of ["nainterp_ns", "nainterp_s"]) out[k] = rel(naInterp(arr(C[k].x), { frequency: num(C[k].frequency) }), arr(C[k].r));
    for (const k of ["tsout_s", "tsout_ns"]) { const o = tsoutliers(arr(C[k].x), { frequency: num(C[k].frequency) }); out[k] = o.index.length === arr(C[k].index).length ? Math.max(rel(o.index.map((i) => i + 1), arr(C[k].index)), rel(o.replacements, arr(C[k].replacements))) : Infinity; }
    for (const k of ["tsclean_s", "tsclean_ns"]) out[k] = rel(tsclean(arr(C[k].x), { frequency: num(C[k].frequency) }), arr(C[k].r));
    const dec = mstl(usacc, { frequency: 12 }) as any;
    out.components = Math.max(rel(seasonalComponent(dec), arr(fx.components.seasonal)), rel(trendcycle(dec), arr(fx.components.trendcycle)), rel(remainder(dec), arr(fx.components.remainder)));
    for (const [k, v] of Object.entries(out)) expect(v, k).toBeLessThan(1e-10);
  });
});

describe("stlm and forecast() (forecast)", () => {
  const X = fx.dispatch;
  const fcRel = (f: { mean: number[]; lower: number[][]; upper: number[][] }, r: any): number =>
    Math.max(rel(f.mean, arr(r.mean)), rel(f.lower.flat(), mat(r.lower).flat()), rel(f.upper.flat(), mat(r.upper).flat()));
  it("stlm(ets): at R's estimates, and the estimate", () => {
    const r = X.stlm_ets; const fit = stlm(usacc, { frequency: 12 });
    expect(fit.model.method).toBe(r.model.method);
    expect((fit.model as any).loglik).toBeGreaterThanOrEqual(num(r.model.loglik) - 1e-6);
    const at = { ...fit, model: etsAt(fit.adjusted, sp("A", "N", false, "N"), parOf(r.model.par), 2) };
    expect(fcRel(forecastStlm(at, { h: 14 }), r.fc)).toBeLessThan(1e-10);
    expect(forecastStlm(fit, { h: 14 }).method).toBe(r.fc.method);
  });
  it("stlm(arima): auto.arima without seasonal terms, with and without lambda", () => {
    for (const [k, y, h, lambda] of [["stlm_arima", usacc, 14, undefined], ["stlm_arima_log", air, 6, 0]] as const) {
      const r = X[k]; const fit = stlm(y, { frequency: 12, method: "arima", ...(lambda !== undefined ? { lambda } : {}) });
      expect((fit.model as any).arma, k).toEqual(arr(r.model.arma));
      expect(rel((fit.model as any).coef, Object.values(r.model.coef).map(num)), k).toBeLessThan(1e-5);
      const f = forecastStlm(fit, { h }); expect(f.method, k).toBe(r.fc.method);
      // the ARIMA estimate's own optimiser tolerance (coefficients within 3e-6 of R's)
      expect(fcRel(f, r.fc), k).toBeLessThan(1e-6);
    }
  });
  it("forecast() on a series: ets, or stlf for periods of 13 or more", () => {
    expect(forecast(nile).method).toBe(X.ts_nile.fc.method);
    expect(forecast(ukgas, { frequency: 4 }).method).toBe(X.ts_ukgas.fc.method);
    expect(forecast(ukgas, { frequency: 4 }).mean.length).toBe(8);
    const z = arr(X.ts_z24.y); const f = forecast(z, { frequency: 24 });
    expect(f.method).toBe(X.ts_z24.fc.method); expect(f.mean.length).toBe(48);
    expect(rel(f.mean, arr(X.ts_z24.fc.mean))).toBeLessThan(1e-3);
  });
  it("forecast() on HoltWinters, ar and stats' arima fits", () => {
    const hwf = forecast(holtWinters(arr(X.hw.x), { frequency: 12 }), { h: 6 });
    expect(hwf.method).toBe("HoltWinters"); expect(fcRel(hwf, X.hw)).toBeLessThan(1e-6);
    const af = forecast(ar(arr(X.ar.x)), { h: 5 });
    expect(af.method).toBe(X.ar.method); expect(fcRel(af, X.ar)).toBeLessThan(1e-10);
    const lh = arr(X.ar.x);
    // stats' arima: R's default fit stops a little short (log 1-13), 2e-6 in these forecasts
    const s1 = forecast(arima(lh, { order: [1, 0, 0] }), { h: 5 }); expect(s1.method).toBe(X.arima.method); expect(fcRel(s1, X.arima)).toBeLessThan(1e-5);
    const s2 = forecast(arima(usacc, { order: [0, 1, 1], seasonal: { order: [0, 1, 1], period: 12 } }), { h: 5 });
    expect(s2.method).toBe(X.arima_s.method); expect(fcRel(s2, X.arima_s)).toBeLessThan(1e-5);
  });
});
