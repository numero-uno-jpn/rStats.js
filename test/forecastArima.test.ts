// forecast's Arima, forecast.Arima, BoxCox, InvBoxCox, BoxCox.lambda and ndiffs against R (test/fixtures/
// forecastArima.json from oracle/forecastArima.R). R's ARIMA fits stop about 1e-6 short of the optimum (stats' arima is
// checked at the optimum in test/arima.test.ts), hence 1e-5 on the fitted quantities here.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boxCox, boxCoxLambda, forecastArima, forecastFromArima, invBoxCox, ndiffs } from "../src/entries/timeseries.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/forecastArima.json", import.meta.url), "utf8")) as Record<string, any>;
const num = (v: unknown): number => (v === null ? NaN : Number(v));
const arr = (v: unknown): number[] => (Array.isArray(v) ? v.map(num) : [num(v)]);
const maxRel = (a: readonly number[], e: readonly number[], floor = 1): number =>
  Math.max(0, ...a.map((v, i) => Math.abs(v - e[i]!) / Math.max(floor, Math.abs(e[i]!))));

describe("Arima and forecast (forecast)", () => {
  for (const [name, c] of Object.entries(fx.arima as Record<string, any>)) {
    it(name, () => {
      const y = arr(c.y);
      const fit = forecastArima(y, {
        order: c.order, seasonal: c.seasonal, frequency: c.frequency, includeDrift: c.drift,
        ...(c.constant ? { includeConstant: true } : {}), ...(c.lambda !== undefined && c.lambda !== null ? { lambda: num(c.lambda) } : {}),
        biasadj: c.biasadj, ...(c.xreg ? { xreg: [arr(c.xreg)], xregNames: ["trend"] } : {}),
      });
      expect(fit.coefNames).toEqual(Array.isArray(c.names) ? c.names : [c.names]);
      // in units of R's standard errors: R's default fit stops short where the likelihood is flat (the USAccDeaths
      // trend: ours is 2e-7 higher in loglik, 4e-3 se away)
      const se = arr(c.se_coef);
      expect(Math.max(...fit.coef.map((v, i) => Math.abs(v - arr(c.coef)[i]!) / se[i]!))).toBeLessThan(1e-2);
      expect(fit.loglik).toBeGreaterThan(num(c.loglik) - 1e-7);
      expect(Math.abs(fit.sigma2 / num(c.sigma2) - 1)).toBeLessThan(1e-5);
      for (const k of ["loglik", "aic", "aicc", "bic"] as const) expect(Math.abs((fit as any)[k] - num(c[k]))).toBeLessThan(1e-6 * Math.max(1, Math.abs(num(c[k]))) + 1e-7);
      expect(fit.nobs).toBe(num(c.nobs));
      const scale = Math.max(...y.map(Math.abs));
      // R's short stop moves the fitted values and forecasts by up to 1.4e-5 of the scale (USAccDeaths with a trend)
      const tol = 3e-5;
      expect(maxRel(fit.fitted, arr(c.fitted), scale)).toBeLessThan(tol);
      const fc = forecastFromArima(fit, { h: 12, level: [80, 95], ...(c.newxreg ? { xreg: [arr(c.newxreg)] } : {}) });
      expect(fc.method).toBe(c.method);
      expect(maxRel(fc.mean, arr(c.mean), scale)).toBeLessThan(tol);
      expect(maxRel(fc.lower.flat(), (c.lower as number[][]).flat().map(num), scale)).toBeLessThan(tol);
      expect(maxRel(fc.upper.flat(), (c.upper as number[][]).flat().map(num), scale)).toBeLessThan(tol);
    });
  }
});

describe("BoxCox, InvBoxCox, BoxCox.lambda", () => {
  it("BoxCox / InvBoxCox", () => {
    const b = fx.boxcox; const x = arr(b.x);
    expect(maxRel(boxCox(x, 0), arr(b.l0))).toBeLessThan(1e-15);
    expect(maxRel(boxCox(x, 0.5), arr(b.l05))).toBeLessThan(1e-15);
    expect(maxRel(boxCox(x, -0.7), arr(b.lneg))).toBeLessThan(1e-15);
    expect(maxRel(boxCox([-2, -0.5, 0, 1.5], 0.5), arr(b.negx))).toBeLessThan(1e-15);
    expect(maxRel(invBoxCox([-3, -2.5, 0.1, 2], 0.5), arr(b.inv))).toBeLessThan(1e-15);
    expect(maxRel(invBoxCox([-1, 0, 2], 0), arr(b.inv0))).toBeLessThan(1e-15);
    expect(maxRel(invBoxCox([5, 5.5], 0.3, { biasadj: true, fvar: [0.01, 0.04] }), arr(b.inv_bias))).toBeLessThan(1e-15);
  });
  for (const [name, c] of Object.entries(fx.boxcoxLambda as Record<string, any>)) {
    it(name, () => {
      const x = arr(c.x); const f = num(c.frequency);
      // optimize's tolerance (as R's) leaves differences of order 1e-10
      expect(Math.abs(boxCoxLambda(x, { frequency: f }) - num(c.guerrero))).toBeLessThan(1e-8);
      expect(Math.abs(boxCoxLambda(x, { frequency: f, method: "loglik" }) - num(c.loglik))).toBeLessThan(1e-12);
      expect(Math.abs(boxCoxLambda(x, { frequency: f, lower: 0, upper: 1 }) - num(c.limited))).toBeLessThan(1e-8);
    });
  }
});

describe("ndiffs", () => {
  it("150 series x 3 tests x 2 types x 4 alphas", () => {
    const bad: string[] = [];
    (fx.ndiffs as any[]).forEach((r, i) => {
      const y = arr(r.y);
      for (const test of ["kpss", "adf", "pp"] as const) for (const type of ["level", "trend"] as const) for (const alpha of [0.01, 0.025, 0.05, 0.1]) {
        const key = `${test}_${type}_${alpha}`; const got = ndiffs(y, { test, type, alpha });
        if (got !== num(r[key])) bad.push(`${i} ${key}: ${got} != ${r[key]}`);
      }
    });
    // PP: the critical values of urca's ur.pp = MacKinnon (1991) at N = n - 1 (log 85); the statistic differs from
    // ur.pp's by up to 0.05 (p by up to 3.4e-3), which changes none of these decisions
    expect(bad.slice(0, 20)).toEqual([]);
  });
});
