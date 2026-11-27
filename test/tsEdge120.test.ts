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
  thetaf, whiteTest,
} from "../src/entries/timeseries.js";

const R = JSON.parse(readFileSync(new URL("../experiments/tsmeta120-tsedge.json", import.meta.url), "utf8")) as Record<string, any>;
const y0 = (R.y as number[]).map(Number);
const SCALES = [1e-300, 1e-150, 1e-20, 1e-10, 1e10, 1e150, 1e300, 2 ** 1000];
const relMax = (a: readonly number[], b: readonly number[], c: number): number => Math.max(...a.map((v, i) => Math.abs(v / c / b[i]! - 1)));

describe("time series: forecasts equivariant from 1e-300 to 2^1000", () => {
  // tolerances: the optimisers' stopping (ets and the arima fits about 1e-10 and 1e-7; HoltWinters' L-BFGS-B 1e-5)
  const cases: [string, (x: number[]) => number[], number][] = [
    ["ets AAA", (x) => forecastEts(ets(x, { frequency: 12, model: "AAA", damped: false }), { h: 3 }).mean, 1e-9],
    ["ses", (x) => ses(x, { h: 3 }).mean, 1e-10],
    ["holt", (x) => holt(x, { h: 3 }).mean, 1e-8],
    ["hw", (x) => hw(x, { frequency: 12, h: 3 }).mean, 1e-9],
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
