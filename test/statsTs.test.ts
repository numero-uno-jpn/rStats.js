// stats' filter, Box.test, diffinv, decompose, ar, predict.ar, arima0, HoltWinters and predict.HoltWinters against R
// (test/fixtures/statsTs.json from oracle/statsTs.R).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ar, arima0, boxTest, decompose, diffinv, tsFilter, holtWinters, predictAr, predictHoltWinters } from "../src/entries/timeseries.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/statsTs.json", import.meta.url), "utf8")) as Record<string, any>;
const num = (v: unknown): number => (v === null ? NaN : Number(v));
const arr = (v: unknown): number[] => (Array.isArray(v) ? v.map(num) : v === undefined ? [] : [num(v)]);
const close = (a: readonly number[], e: readonly number[], tol: number, scale = 1): void => {
  expect(a.length).toBe(e.length);
  a.forEach((v, i) => { if (Number.isNaN(e[i]!)) expect(v).toBeNaN(); else expect(Math.abs(v - e[i]!) / Math.max(scale, 1e-300)).toBeLessThan(tol); });
};

describe("tsFilter (filter), Box.test, diffinv, decompose (stats)", () => {
  it("filter", () => {
    const f = fx.filter; const y = arr(f.y), x = arr(f.x);
    close(tsFilter(y, [1 / 3, 1 / 3, 1 / 3]), arr(f.conv2), 1e-14);
    close(tsFilter(y, [0.25, 0.25, 0.25, 0.25]), arr(f.conv2even), 1e-14);
    close(tsFilter(y, [0.5, 0.3, 0.2], { sides: 1 }), arr(f.conv1), 1e-14);
    close(tsFilter(y, [0.2, 0.5, 0.3], { circular: true }), arr(f.circ), 1e-14);
    close(tsFilter(x, [0.5, 0.5]), arr(f.na), 1e-14);
    close(tsFilter(y, [0.5, -0.2], { method: "recursive" }), arr(f.rec), 1e-13);
    close(tsFilter(y, [0.5, -0.2], { method: "recursive", init: [1.5, -0.7] }), arr(f.recinit), 1e-13);
  });
  for (const [name, c] of Object.entries(fx.box as Record<string, any>)) {
    it(`Box.test ${name}`, () => {
      const r = boxTest(arr(c.x), { lag: num(c.lag), type: c.type, fitdf: num(c.fitdf) });
      expect(Math.abs(r.statistic / num(c.statistic) - 1)).toBeLessThan(1e-13);
      expect(r.parameter).toBe(num(c.df));
      expect(Math.abs(r.pValue - num(c.p))).toBeLessThan(1e-14);
    });
  }
  it("diffinv", () => {
    close(diffinv([1, 4, 2, 7]), arr(fx.diffinv.a), 1e-15);
    close(diffinv([1, 4, 2, 7, 3, 8], { lag: 2, differences: 2, xi: [1, 2, 3, 5] }), arr(fx.diffinv.b), 1e-15);
    close(diffinv(arr(fx.filter.y), { lag: 3, xi: [2, 1, 0] }), arr(fx.diffinv.c), 1e-14);
  });
  for (const [name, c] of Object.entries(fx.decompose as Record<string, any>)) {
    it(`decompose ${name}`, () => {
      const d = decompose(arr(c.x), { frequency: num(c.frequency), type: c.type }); const sc = Math.max(...arr(c.x));
      close(d.trend, arr(c.trend), 1e-13, sc); close(d.seasonal, arr(c.seasonal), 1e-12, c.type === "additive" ? sc : 1);
      close(d.random, arr(c.random), 1e-12, c.type === "additive" ? sc : 1); close(d.figure, arr(c.figure), 1e-12, c.type === "additive" ? sc : 1);
    });
  }
});

describe("ar and predict.ar (stats)", () => {
  for (const [name, c] of Object.entries(fx.ar as Record<string, any>)) {
    for (const method of ["yule-walker", "burg", "ols", "mle"] as const) {
      it(`${name} ${method}`, () => {
        const x = arr(c.x); const r = c[method]; const a = ar(x, { method });
        expect(a.order).toBe(num(r.order));
        // mle: arima0's fits with the default delta (log 87); inside ar.mle R's optimiser stops short of the maximum
        // (sunspot, order 9: var.pred 6e-4), while ours reaches it, hence looser
        const tol = method === "mle" ? 1e-3 : 1e-11;
        close(a.ar, arr(r.ar), tol);
        expect(Math.abs(a.varPred / num(r.var_pred) - 1)).toBeLessThan(method === "mle" ? 1e-3 : 1e-12);
        if (method !== "mle") close(a.aic, arr(r.aic), 1e-9, Math.max(1, ...arr(r.aic)));
        if (method === "yule-walker" || method === "burg") close(a.partialacf!, arr(r.partialacf), 1e-11);
        const p = predictAr(a, 8); const sc = Math.max(...x.map(Math.abs));
        close(p.pred, arr(r.pred), method === "mle" ? 3e-3 : 1e-11, sc); close(p.se, arr(r.se), method === "mle" ? 1e-3 : 1e-11, Math.max(...arr(r.se)));
      });
    }
    it(`${name} burg var.method 2`, () => {
      const a = ar(arr(c.x), { method: "burg", varMethod: 2 }); const r = c.burg2;
      expect(a.order).toBe(num(r.order)); close(a.ar, arr(r.ar), 1e-11);
      expect(Math.abs(a.varPred / num(r.var_pred) - 1)).toBeLessThan(1e-12);
    });
  }
});

describe("arima0 (stats)", () => {
  for (const [name, c] of Object.entries(fx.arima0 as Record<string, any>)) {
    it(name, () => {
      const f = arima0(arr(c.x), { order: c.order, seasonal: c.seasonal, frequency: num(c.frequency), delta: -1 });
      // the default delta = 0.01: R's fast recursions (log 87)
      const g = arima0(arr(c.x), { order: c.order, seasonal: c.seasonal, frequency: num(c.frequency) });
      expect(g.loglik).toBeGreaterThan(num(c.fast.loglik) - 1e-9 * Math.abs(num(c.fast.loglik)));
      expect(Math.abs(g.loglik - num(c.fast.loglik))).toBeLessThan(1e-7 * Math.abs(num(c.fast.loglik)));
      close(g.coef, arr(c.fast.coef), 1e-4, 1);
      // (R's arima0 returns its coefficients without names)
      // against R's arima0(delta = -1), the exact likelihood; R's fit tightened with reltol 1e-14
      expect(f.loglik).toBeGreaterThan(num(c.loglik) - 1e-9 * Math.abs(num(c.loglik)));
      expect(Math.abs(f.loglik - num(c.loglik))).toBeLessThan(1e-7 * Math.abs(num(c.loglik)));
      close(f.coef, arr(c.coef), 1e-4, 1);
      expect(Math.abs(f.sigma2 / num(c.sigma2) - 1)).toBeLessThan(1e-6);
    });
  }
});

describe("HoltWinters and predict (stats)", () => {
  for (const [name, c] of Object.entries(fx.hw as Record<string, any>)) {
    it(name, () => {
      const a = (Array.isArray(c.args) ? {} : c.args) as Record<string, unknown>;
      const f = holtWinters(arr(c.x), { frequency: num(c.frequency), ...(a as object) });
      const sc = Math.max(...arr(c.x));
      expect(f.coefficientNames).toEqual(Array.isArray(c.names) ? c.names : [c.names]);
      // R's L-BFGS-B equals a tight refit to 1e-13 for co2 and AirPassengers (log 12); elsewhere it stops short (the
      // level-only optimize 6e-6 in alpha, USAccDeaths 3e-6), and the SSE here is at most R's
      const tol = name === "co2" || name === "air_mult" || name === "co2_given" ? 1e-7 : 1e-4;
      expect(Math.abs(f.alpha - num(c.alpha))).toBeLessThan(tol);
      if (f.beta !== false) expect(Math.abs((f.beta as number) - num(c.beta))).toBeLessThan(tol);
      if (f.gamma !== false) expect(Math.abs((f.gamma as number) - num(c.gamma))).toBeLessThan(tol);
      expect(f.SSE).toBeLessThan(num(c.SSE) * (1 + 1e-9));
      close(f.fitted, arr(c.xhat), tol, sc);
      const h = arr(c.fit).length; const p = predictHoltWinters(f, { nAhead: h, predictionInterval: true });
      close(p.fit, arr(c.fit), tol * 10, sc);
      // multiplicative intervals: R reads the seasonal factors at fixed positions (R bug 19369); equal for h < f
      const nCompare = f.seasonal === "multiplicative" ? f.frequency - 1 : h;
      close(p.upr!.slice(0, nCompare), arr(c.upr).slice(0, nCompare), tol * 10, sc);
      close(p.lwr!.slice(0, nCompare), arr(c.lwr).slice(0, nCompare), tol * 10, sc);
    });
  }
});
