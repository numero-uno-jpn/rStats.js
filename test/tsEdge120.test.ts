// The 1.20.0 edge-case review of the time-series functions (oracle/tsmeta-behaviour.md "Edge-case plan", experiments/
// tsmeta120-log.md 103-104): USAccDeaths times 1e-300 .. 2^1000. Forecasts and level-type outputs are equivariant,
// test statistics and decisions invariant. R's own results on the same inputs (experiments/tsmeta120-tsedge.json) fail
// beyond 1e+-150 for most of these functions (errors, NaN, other models), and its ets, hw and HoltWinters move by 2-40%
// at 1e-150; rStats.js standardises by a power of two (exact) inside the fits and the tests.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  adfTest, ar, arima, autoArima, boxTest, ets, forecastArima, forecastEts, forecastFromArima, holt, holtWinters, hw, jarqueBeraTest,
  kpssTest, meanf, ndiffs, nsdiffs, ocsbTest, poTest, ppTest, predictArima, predictHoltWinters, rwf, ses, stlf, terasvirtaTest,
  thetaf, whiteTest, boxCoxLambda, croston, decompose, findfrequency, mstl, naInterp, naive, snaive, specAr, stl, tsclean, tsFilter, tslm,
  predictAr, accuracy, dmTest, cvLm, supsmu, acf,
} from "../src/entries/timeseries.js";

const R = JSON.parse(readFileSync(new URL("../experiments/tsmeta120-tsedge.json", import.meta.url), "utf8")) as Record<string, any>;
const y0 = (R.y as number[]).map(Number);
const SCALES = [1e-300, 1e-150, 1e-20, 1e-10, 1e10, 1e150, 1e300, 2 ** 1000];
const relMax = (a: readonly number[], b: readonly number[], c: number): number => Math.max(...a.map((v, i) => Math.abs(v / c / b[i]! - 1)));

describe("time series: forecasts equivariant from 1e-300 to 2^1000", () => {
  // tolerances: the optimisers' stopping (ets about 4e-9 on its flat optimum, the arima fits 1e-7, HoltWinters'
  // L-BFGS-B 1e-5)
  const cases: [string, (x: number[]) => number[], number][] = [
    ["ets AAA", (x) => forecastEts(ets(x, { frequency: 12, model: "AAA", damped: false }), { h: 3 }).mean, 1e-8],
    ["ses", (x) => ses(x, { h: 3 }).mean, 1e-10],
    ["holt", (x) => holt(x, { h: 3 }).mean, 1e-8],
    ["hw", (x) => hw(x, { frequency: 12, h: 3 }).mean, 1e-8],
    ["thetaf", (x) => thetaf(x, { frequency: 12, h: 3 }).mean, 1e-8],
    ["stlf", (x) => stlf(x, { frequency: 12, h: 3 }).mean, 1e-7],
    ["holtWinters", (x) => predictHoltWinters(holtWinters(x, { frequency: 12 }), { nAhead: 3 }).fit, 2e-5],
    ["arima airline", (x) => predictArima(arima(x, { order: [0, 1, 1], seasonal: { order: [0, 1, 1], period: 12 }, frequency: 12 }), 3).pred, 1e-6],
    ["arima airline se", (x) => predictArima(arima(x, { order: [0, 1, 1], seasonal: { order: [0, 1, 1], period: 12 }, frequency: 12 }), 3).se, 1e-5],
    ["arima AR with a mean", (x) => predictArima(arima(x, { order: [1, 0, 0], seasonal: { order: [1, 0, 0], period: 12 }, frequency: 12 }), 3).pred, 1e-8],
    ["Arima and forecast", (x) => forecastFromArima(forecastArima(x, { order: [0, 1, 1], seasonal: [0, 1, 1], frequency: 12 }), { h: 3 }).upper.map((r) => r[1]!), 1e-5],
    ["meanf upper", (x) => meanf(x, { h: 2 }).upper.map((r) => r[1]!), 1e-12],
    ["rwf drift upper", (x) => rwf(x, { h: 2, drift: true }).upper.map((r) => r[1]!), 1e-12],
  ];
  for (const [name, f, tol] of cases) {
    it(name, () => {
      const base = f(y0);
      for (const c of SCALES) expect(relMax(f(y0.map((v) => v * c)), base, c), `${name} x ${c}`).toBeLessThan(tol);
    });
  }
  it("ets ZZZ: the same model and forecasts at 1e-300 and 2^1000 (R: SES and ETS(M,Ad,M))", () => {
    const run = (x: number[]): [string, number[]] => { const f = ets(x, { frequency: 12 }); const fc = forecastEts(f, { h: 3 }); return [f.method, [...fc.mean, ...fc.upper.map((r) => r[1]!)]]; };
    const [m0, b] = run(y0);
    for (const c of [1e-300, 2 ** 1000]) { const [m, v] = run(y0.map((u) => u * c)); expect(m).toBe(m0); expect(relMax(v, b, c)).toBeLessThan(1e-5); }
  }, 600_000);
  it("ar: the same order and coefficients, the variance as a square where it is in range", () => {
    const b = ar(y0);
    for (const c of SCALES) {
      const r = ar(y0.map((v) => v * c));
      expect(r.order).toBe(b.order);
      r.ar.forEach((v, i) => expect(Math.abs(v - b.ar[i]!)).toBeLessThan(1e-12));
      if (c * c > 0 && Number.isFinite(c * c)) expect(Math.abs(r.varPred / c / c / b.varPred - 1)).toBeLessThan(1e-12);
    }
  });
  it("autoArima: the same model at 1e-300 and 2^1000", () => {
    const b = autoArima(y0, { frequency: 12 });
    for (const c of [1e-300, 2 ** 1000]) expect(autoArima(y0.map((v) => v * c), { frequency: 12 }).arma).toEqual(b.arma);
  }, 600_000);
});

describe("ets: the same optimum after exact changes of scale and, for additive models, a shift (log 105)", () => {
  // Nelder-Mead alone stopped at points of a flat optimum 1e-2 apart in log-likelihood (beta and gamma at 1e-4)
  const n = y0.length;
  for (const [model, damped, shifts] of [["AAA", false, true], ["ANA", false, true], ["AAA", true, true], ["MNM", false, false], ["MAM", false, false]] as const) {
    it(`${model}${damped ? " damped" : ""}`, () => {
      const base = ets(y0, { frequency: 12, model, damped }).loglik;
      for (const c of [1e-40, 1e-10, 1e5, 1e20]) expect(Math.abs(ets(y0.map((v) => v * c), { frequency: 12, model, damped }).loglik + n * Math.log(c) - base), `${c}`).toBeLessThan(1e-6);
      if (shifts) for (const s of [1e4, 1e8]) expect(Math.abs(ets(y0.map((v) => v + s), { frequency: 12, model, damped }).loglik - base), `+${s}`).toBeLessThan(1e-5);
    }, 300_000);
  }
});

describe("time series: statistics and decisions invariant from 1e-300 to 2^1000", () => {
  const stats: [string, (x: number[]) => number][] = [
    ["adfTest", (x) => adfTest(x).statistic], ["kpssTest", (x) => kpssTest(x).statistic], ["ppTest", (x) => ppTest(x).statistic],
    ["jarqueBeraTest", (x) => jarqueBeraTest(x).statistic], ["terasvirtaTest", (x) => terasvirtaTest(x).statistic],
    ["whiteTest", (x) => whiteTest(x, { seed: 1 }).statistic], ["boxTest", (x) => boxTest(x, { lag: 5, type: "Ljung-Box" }).statistic],
    ["ocsbTest", (x) => ocsbTest(x, { frequency: 12 }).statistic],
  ];
  for (const [name, f] of stats) {
    it(name, () => {
      const base = f(y0);
      expect(Number.isFinite(base)).toBe(true);
      for (const c of SCALES) expect(Math.abs(f(y0.map((v) => v * c)) - base), `${name} x ${c}`).toBeLessThan(1e-12 * Math.max(1, Math.abs(base)));
    });
  }
  it("poTest: each column on its own scale", () => {
    const x2 = y0.map((v, i) => v * 0.5 + 100 * Math.sin(i));
    const base = poTest(y0.map((v, i) => [v, x2[i]!])).statistic;
    for (const [c1, c2] of [[1e-300, 1], [1, 2 ** 1000], [1e150, 1e-150]]) {
      expect(Math.abs(poTest(y0.map((v, i) => [v * c1!, x2[i]! * c2!])).statistic - base)).toBeLessThan(1e-12 * Math.abs(base));
    }
  });
  it("ndiffs and nsdiffs", () => {
    const b = [ndiffs(y0), ndiffs(y0, { test: "adf" }), ndiffs(y0, { test: "pp" }), nsdiffs(y0, { frequency: 12 }), nsdiffs(y0, { frequency: 12, test: "ocsb" })];
    for (const c of SCALES) {
      const x = y0.map((v) => v * c);
      expect([ndiffs(x), ndiffs(x, { test: "adf" }), ndiffs(x, { test: "pp" }), nsdiffs(x, { frequency: 12 }), nsdiffs(x, { frequency: 12, test: "ocsb" })], String(c)).toEqual(b);
    }
  });
});

// The second part of the 1.20.0 edge-case review (log 107): degenerate series, invalid values, missing values and
// short series against R on the same inputs (experiments/tsmeta120-tsedge2..5.json).
const R2 = JSON.parse(readFileSync(new URL("../experiments/tsmeta120-tsedge2.json", import.meta.url), "utf8")) as Record<string, any>;
const R3 = JSON.parse(readFileSync(new URL("../experiments/tsmeta120-tsedge3.json", import.meta.url), "utf8")) as Record<string, any>;
const yNA = (R2.inputs.na as (number | null)[]).map((v) => v ?? NaN);
const yInf = y0.map((v, i) => (i === 29 ? Infinity : v));

describe("time series: invalid and missing values (log 107)", () => {
  it("an infinite value is an error", () => {
    const calls: [string, () => unknown][] = [
      ["arima", () => arima(yInf, { order: [0, 1, 1] })], ["forecastArima", () => forecastArima(yInf, { order: [0, 1, 0], includeDrift: true })],
      ["autoArima", () => autoArima(yInf, { frequency: 12 })], ["ets", () => ets(yInf, { frequency: 12, model: "ANN" })],
      ["holtWinters", () => holtWinters(yInf, { frequency: 12 })], ["meanf", () => meanf(yInf)], ["rwf", () => rwf(yInf, { drift: true })],
      ["croston", () => croston(yInf)], ["tslm", () => tslm(yInf, { frequency: 12 })], ["ar", () => ar(yInf)],
      ["boxTest", () => boxTest(yInf, { lag: 5 })], ["decompose", () => decompose(yInf, { frequency: 12 })],
      ["stl", () => stl(yInf, { frequency: 12, sWindow: "periodic" })], ["mstl", () => mstl(yInf, { frequency: 12 })],
      ["ndiffs", () => ndiffs(yInf)], ["nsdiffs", () => nsdiffs(yInf, { frequency: 12 })], ["ocsbTest", () => ocsbTest(yInf, { frequency: 12 })],
      ["naInterp", () => naInterp(yInf, { frequency: 12 })], ["tsclean", () => tsclean(yInf, { frequency: 12 })],
      ["findfrequency", () => findfrequency(yInf)], ["boxCoxLambda", () => boxCoxLambda(yInf, { frequency: 12 })],
      ["kpssTest", () => kpssTest(yInf)], ["jarqueBeraTest", () => jarqueBeraTest(yInf)],
    ];
    for (const [name, f] of calls) expect(f, name).toThrow(/infinite/);
  });
  it("a missing value is an error where R's function fails too", () => {
    const calls: [string, () => unknown][] = [
      ["ar", () => ar(yNA)], ["ar burg", () => ar(yNA, { method: "burg" })], ["ar mle", () => ar(yNA, { method: "mle" })],
      ["decompose", () => decompose(yNA, { frequency: 12 })], ["specAr", () => specAr(yNA)], ["croston", () => croston(yNA)],
      ["thetaf", () => thetaf(yNA, { frequency: 12 })], ["ocsbTest", () => ocsbTest(yNA, { frequency: 12 })],
      ["holtWinters", () => holtWinters(yNA, { frequency: 12 })],
    ];
    for (const [name, f] of calls) expect(f, name).toThrow(/missing/);
  });
  it("boxTest with a missing value: R's (the pairs both observed, n the number observed)", () => {
    expect(Math.abs(boxTest(yNA, { lag: 5, type: "Ljung-Box" }).statistic / R3.na.Box.statistic - 1)).toBeLessThan(1e-13);
    expect(Math.abs(boxTest(yNA, { lag: 5 }).statistic / R3.na.Box_pierce.statistic - 1)).toBeLessThan(1e-13);
  });
  it("boxCoxLambda with a missing value: R's (the groups and the trend keep their positions)", () => {
    expect(Math.abs(boxCoxLambda(yNA, { frequency: 12 }) - R3.na.lambda.guerrero)).toBeLessThan(1e-8);
    expect(boxCoxLambda(yNA, { frequency: 12, method: "loglik" })).toBeCloseTo(R3.na.lambda.loglik, 10);
  });
});

describe("time series: degenerate and short series (log 107)", () => {
  const cst = new Array<number>(48).fill(5); const zero = new Array<number>(48).fill(0);
  it("a constant series: ets and the methods on it forecast the constant (R likewise)", () => {
    for (const x of [cst, zero]) {
      const v = x[0]!;
      for (const model of ["ZZZ", "ANN", "AAA"]) expect(forecastEts(ets(x, { frequency: 12, model }), { h: 3 }).mean, model).toEqual([v, v, v]);
      for (const f of [ses(x, { h: 3 }), holt(x, { h: 3 }), hw(x, { frequency: 12, h: 3 }), thetaf(x, { frequency: 12, h: 3 })]) f.mean.forEach((m) => expect(Math.abs(m - v)).toBeLessThan(1e-12));
    }
  });
  it("stl with robustness weights on an exact fit: no NaN (6 median |R| = 0)", () => {
    const s = stl(cst, { frequency: 12, sWindow: 7, robust: true });
    expect(s.seasonal.every(Number.isFinite) && s.trend.every(Number.isFinite)).toBe(true);
    expect(tsclean(cst, { frequency: 12 })).toEqual(cst);
  });
  it("too short for the method: errors as R's", () => {
    expect(() => naive([9007])).toThrow(/at least 2/);
    expect(() => snaive(y0.slice(0, 12), { frequency: 12 })).toThrow(/at least 13/);
    expect(() => tsFilter([1, 2], [1 / 3, 1 / 3, 1 / 3])).toThrow(/longer/);
    expect(() => ar([9007])).toThrow(/at least 2/);
    expect(() => croston([0, 0, 3, 0])).toThrow(/two non-zero/);
    expect(() => tslm([9007], { frequency: 12 })).toThrow(/at least 2/);
  });
  it("ets on 12 = m values: the seasonal component dropped, as R's", () => {
    const x = y0.slice(0, 12);
    expect(ets(x, { frequency: 12, model: "AAA", damped: false }).method).toBe(R2.runs.len12.ets_AAA.method);
    expect(ets(x, { frequency: 12 }).method).toBe(R2.runs.len12.ets_ZZZ.method);
  });
  it("stlf on fewer than two periods: forecasts without a seasonal component (no NaN)", () => {
    expect(stlf(y0.slice(0, 20), { frequency: 12, h: 3 }).mean.every(Number.isFinite)).toBe(true);
  });
  it("ndiffs and nsdiffs: a test that fails stops the differencing (R warns and does the same)", () => {
    for (const n of [2, 3]) for (const test of ["kpss", "adf", "pp"] as const) expect(ndiffs(y0.slice(0, n), { test }), `${n} ${test}`).toBe(0);
    expect(nsdiffs(R2.inputs.line as number[], { frequency: 12 })).toBe(0);
  });
  it("autoArima on short series: R's models (seasonal orders at most n / 3m, the AIC below four values)", () => {
    for (const nm of ["len2", "len3", "len12", "len24", "len25"]) {
      expect(autoArima(R2.inputs[nm] as number[], { frequency: 12 }).arma, nm).toEqual(R2.runs[nm].auto_arima.arma);
    }
  }, 300_000);
});

describe("time series: missing values and exact fits as R's (log 108, the user's decisions 2026-11-28)", () => {
  const close = (a: readonly number[], b: readonly number[], tol: number): void => a.forEach((v, i) => expect(Math.abs(v / b[i]! - 1), `${i}`).toBeLessThan(tol));
  it("naive / snaive / rwf: the step from the last observed value of the same season", () => {
    close(naive(yNA, { h: 2 }).upper.map((r) => r[1]!), R3.na.naive.upper, 1e-15);
    close(snaive(yNA, { frequency: 12, h: 2 }).upper.map((r) => r[1]!), R3.na.snaive.upper, 1e-15);
    const d = rwf(yNA, { h: 2, drift: true }); close(d.mean, R3.na.rwf_drift.mean, 1e-15); close(d.upper.map((r) => r[1]!), R3.na.rwf_drift.upper, 1e-14);
  });
  it("kpssTest: the residuals of the observed values, n the length", () => {
    expect(Math.abs(kpssTest(yNA).statistic / R3.na.kpss.statistic - 1)).toBeLessThan(1e-13);
    expect(Math.abs(kpssTest(yNA, { null: "Trend" }).statistic / R3.na.kpss_trend.statistic - 1)).toBeLessThan(1e-13);
  });
  it("mstl: the decomposition of naInterp(x), data and remainder missing there", () => {
    const m = mstl(yNA, { frequency: 12 });
    expect(Number.isNaN(m.data[29]!) && Number.isNaN(m.remainder[29]!)).toBe(true);
    close([m.trend[29]!, m.seasonal![29]!], R3.na.mstl.row30.slice(1, 3), 1e-12);
    close([m.trend[0]!, m.seasonal![0]!, m.remainder[0]!], R3.na.mstl.first.slice(1), 1e-12);
  });
  it("ets: missing values skipped by the filter; R's log-likelihood (n the length) or a higher one", () => {
    const f = ets(yNA, { frequency: 12, model: "ANN" });
    expect(f.loglik).toBeGreaterThanOrEqual(R3.na.ets_ANN.loglik - 1e-9);
    expect(Math.abs(f.sigma2 / R3.na.ets_ANN.sigma2 - 1)).toBeLessThan(1e-6);
    expect(Number.isNaN(f.residuals[29]!)).toBe(true);
    const z = ets(yNA, { frequency: 12 });
    expect(z.method).toBe(R3.na.ets_ZZZ.method); expect(z.loglik).toBeGreaterThanOrEqual(R3.na.ets_ZZZ.loglik);
  }, 300_000);
  it("autoArima on exact fits: ARIMA(0,d,0)(0,D,0) with the constant, sigma2 0", () => {
    for (const nm of ["const", "zero", "line", "season"]) {
      const f = autoArima(R2.inputs[nm] as number[], { frequency: 12 }); const r = R2.runs[nm].auto_arima;
      expect(f.arma, nm).toEqual(r.arma); expect(f.coef, nm).toEqual([r.coef]);
      expect(forecastFromArima(f, { h: 3 }).mean, nm).toEqual(r.mean);
    }
  });
});

describe("ets on short series as R's (log 108, the user's decision 2026-11-28)", () => {
  const R5 = JSON.parse(readFileSync(new URL("../experiments/tsmeta120-tsedge5.json", import.meta.url), "utf8")) as Record<string, any>;
  const g0 = [160.1, 129.7, 84.8, 120.1, 160.1, 124.9, 84.8, 116.9, 169.7, 140.9, 89.7, 123.3, 187.3, 144.1];
  const opts: Record<string, Record<string, unknown>> = { ANN: { model: "ANN" }, AAN: { model: "AAN", damped: false }, AAdN: { model: "AAN", damped: true },
    MNN: { model: "MNN" }, ZZZ: {}, AAA: { model: "AAA", damped: false }, ANA: { model: "ANA" }, MNM: { model: "MNM" } };
  it("the model and whether it has a likelihood (n <= npars + 4: none), for n = 2..10 and the seasonal limits", () => {
    for (const [sec, m, src] of [["nonseasonal", 1, y0], ["seasonal4", 4, g0], ["seasonal12", 12, y0]] as const) for (const [n, r] of Object.entries<any>(R5[sec])) for (const [k, rv] of Object.entries<any>(r)) {
      if (k === "hw" || rv.error) continue;
      if (sec === "seasonal12" && k === "ZZZ" && n === "26") continue; // rStats.js's ANA reaches a higher likelihood than R's and wins
      const x = src.slice(0, +n);
      // R's seasonal simple fits below 2m values have NA forecasts: an error here
      if (m > 1 && +n < 2 * m && /,[AM]\)$/.test(rv.method) && rv.loglik === null) { expect(() => ets(x, { frequency: m, ...opts[k] }), `${sec} ${n} ${k}`).toThrow(/two seasonal periods/); continue; }
      if (sec === "seasonal12" && k !== "ZZZ" && +n > 12) continue; // likelihood fits of 14-16 parameters: slow, covered above
      const f = ets(x, { frequency: m, ...opts[k] });
      expect(f.method, `${sec} ${n} ${k}`).toBe(rv.method);
      expect(Number.isNaN(f.loglik), `${sec} ${n} ${k}`).toBe(rv.loglik === null);
      // the forecasts of the simple fits: 1e-5 without a season, 1e-3 with one (three parameters: the optimisers stop
      // at points 2e-4 apart at m = 4, n = 10)
      if (rv.loglik === null && +n >= 3) forecastEts(f, { h: 2 }).mean.forEach((v, i) => expect(Math.abs(v / rv.mean[i] - 1), `${sec} ${n} ${k}`).toBeLessThan(m > 1 && f.spec.season !== "N" ? 1e-3 : 1e-5));
    }
  }, 600_000);
});

describe("tseries: short series and degenerate input (log 109)", () => {
  const RT = JSON.parse(readFileSync(new URL("../experiments/tsmeta120-netedge.json", import.meta.url), "utf8")).tseries as Record<string, any>;
  const e = RT.e as number[]; const cum = (v: number[]): number[] => { let s = 0; return v.map((u) => (s += u)); };
  it("too short: errors where R fails or returns NaN", () => {
    expect(() => ppTest(cum(e.slice(0, 3)))).toThrow(/too short/);
    for (const n of [3, 4, 5]) { expect(() => terasvirtaTest(cum(e.slice(0, n))), `${n}`).toThrow(/too short/); expect(() => whiteTest(cum(e.slice(0, n)), { seed: 1 }), `${n}`).toThrow(/too short/); }
    const x6 = cum(e.slice(0, 6));
    expect(Math.abs(terasvirtaTest(x6).statistic / RT.n6.terasvirta.statistic - 1)).toBeLessThan(1e-12);
  });
  it("poTest with collinear columns: an error (R's value is rounding noise)", () => {
    const x = cum(e); expect(() => poTest(x.map((v) => [v, 2 * v]))).toThrow(/collinear/);
  });
  it("the options as R's", () => {
    const x = cum(e);
    const cases: [string, number][] = [["adf_explosive", adfTest(x, { alternative: "explosive" }).pValue], ["adf_k10", adfTest(x, { k: 10 }).statistic],
      ["kpss_long", kpssTest(x, { lshort: false }).statistic], ["pp_alpha", ppTest(x, { type: "Z(alpha)" }).statistic], ["pp_long", ppTest(x, { lshort: false }).statistic],
      ["terasvirta_F", terasvirtaTest(x, { type: "F" }).statistic], ["white_F", whiteTest(x, { type: "F", seed: 1 }).statistic]];
    for (const [k, v] of cases) expect(Math.abs(v / (k === "adf_explosive" ? RT.options[k].p : RT.options[k].statistic) - 1), k).toBeLessThan(1e-12);
  });
});

// The function x axis matrix (log 110): the functions not covered by the scale battery of log 104, the shift by 1e15
// for the statistics that do not depend on a common value, and the new paths at extreme scales.
describe("time series: the rest of the function x axis matrix (log 110)", () => {
  const nile = [1120, 1160, 963, 1210, 1160, 1160, 813, 1230, 1370, 1140, 995, 935, 1110, 994, 1020, 960, 1180, 799, 958, 1140, 1100, 1210, 1150, 1250, 1260, 1220, 1030, 1100, 774, 840, 874, 694, 940, 833, 701, 916, 692, 1020, 1050, 969];
  const EXT = [1e-300, 1e300, 2 ** 1000];
  const close = (a: readonly number[], b: readonly number[], f: (v: number) => number, tol: number, what: string): void => a.forEach((v, i) => expect(Math.abs(v / f(b[i]!) - 1), `${what} ${i}`).toBeLessThan(tol));
  it("tslm, predictAr, accuracy, dmTest, cvLm at 1e+-300: in range", () => {
    const t = (x: number[]) => { const f = tslm(x, { frequency: 12 }).forecast(2); return [...f.mean, ...f.upper.map((r) => r[1]!)]; };
    const p = (x: number[]) => { const r = predictAr(ar(x), 3); return [...r.pred, ...r.se]; };
    const a = (x: number[]) => { const r = accuracy({ y: x, fitted: x.map((v, i) => (i ? x[i - 1]! : v)) }).training; return [r.RMSE, r.MAE, r.MAPE, r.MASE, r.ACF1]; };
    const d = (x: number[]) => { const r = dmTest(x.slice(2).map((v, i) => v - x[i + 1]!), x.slice(2).map((v, i) => v - x[i]!)); return [r.statistic, r.pValue]; };
    const bt = t(y0), bp = p(nile), ba = a(nile), bd = d(nile), bc = cvLm(nile.map((_, i) => [i + 1]), nile).AdjR2;
    for (const c of EXT) {
      close(t(y0.map((v) => v * c)), bt, (v) => v * c, 1e-12, `tslm ${c}`);
      close(p(nile.map((v) => v * c)), bp, (v) => v * c, 1e-12, `predictAr ${c}`);
      close(d(nile.map((v) => v * c)), bd, (v) => v, 1e-12, `dmTest ${c}`);
      expect(Math.abs(cvLm(nile.map((_, i) => [i + 1]), nile.map((v) => v * c)).AdjR2 / bc - 1)).toBeLessThan(1e-12);
    }
  });
  it("accuracy's RMSE and MAE scale, MAPE / MASE / ACF1 do not", () => {
    const a = (x: number[]) => accuracy({ y: x, fitted: x.map((v, i) => (i ? x[i - 1]! : v)) }).training; const b = a(nile);
    for (const c of EXT) { const r = a(nile.map((v) => v * c)); expect(Math.abs(r.RMSE / c / b.RMSE - 1)).toBeLessThan(1e-12); expect(Math.abs(r.MAPE / b.MAPE - 1)).toBeLessThan(1e-12); expect(Math.abs(r.ACF1 / b.ACF1 - 1)).toBeLessThan(1e-12); }
  });
  it("dmTest: errors of different lengths are an error", () => { expect(() => dmTest([1, 2, 3], [1, 2])).toThrow(/same length/); });
  it("supsmu: the same smooth for x times 1e+-300 (the span's threshold)", () => {
    const b = supsmu(nile, y0.slice(0, 40)).y;
    for (const c of EXT) close(supsmu(nile.map((v) => v * c), y0.slice(0, 40)).y, b, (v) => v, 1e-12, `supsmu ${c}`);
  });
  it("statistics that do not depend on a common value: the same at + 1e15 (the sums passed 2^53)", () => {
    const stats: [string, (x: number[]) => number][] = [["kpss", (x) => kpssTest(x).statistic], ["adf", (x) => adfTest(x).statistic], ["pp", (x) => ppTest(x).statistic],
      ["jarque", (x) => jarqueBeraTest(x).statistic], ["box", (x) => boxTest(x, { lag: 5 }).statistic], ["acf", (x) => acf(x, { lagMax: 3 }).acf[3]!],
      ["tslm season", (x) => tslm(x, { frequency: 12 }).coefficients[5]!], ["cvLm AdjR2", (x) => cvLm(x.map((_, i) => [i + 1]), x).AdjR2]];
    for (const [k, f] of stats) { const b = f(y0); expect(Math.abs(f(y0.map((v) => v + 1e15)) / b - 1), k).toBeLessThan(1e-12); }
  });
  it("additive ets with a large common value: the same optimum as without it", () => {
    const b = ets(nile, { model: "AAN", damped: true });
    for (const s of [1e8, 1e15]) expect(Math.abs(ets(nile.map((v) => v + s), { model: "AAN", damped: true }).loglik - b.loglik), `+${s}`).toBeLessThan(1e-9);
  });
  it("the new paths at extreme scales: ets with a missing value, the simple fits, the exact auto.arima fit, naInterp, tsclean", () => {
    const cases: [string, number[], (x: number[]) => number[]][] = [
      ["ets NA", yNA, (x) => forecastEts(ets(x, { frequency: 12, model: "ANN" }), { h: 2 }).mean],
      ["ets simple", y0.slice(0, 5), (x) => forecastEts(ets(x, { model: "AAN" }), { h: 2 }).mean],
      ["autoArima exact", Array.from({ length: 48 }, (_, i) => 3 + 2 * i), (x) => forecastFromArima(autoArima(x), { h: 2 }).mean],
      ["naInterp", yNA, (x) => naInterp(x, { frequency: 12 })], ["tsclean", y0.map((v, i) => (i === 30 ? v + 5000 : v)), (x) => tsclean(x, { frequency: 12 })],
    ];
    for (const [k, x, f] of cases) { const b = f(x); for (const c of EXT) close(f(x.map((v) => v * c)), b, (v) => v * c, 1e-9, `${k} ${c}`); }
  });
});
