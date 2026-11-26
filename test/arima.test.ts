// stats' arima and predict.Arima against R 4.6.2 (test/fixtures/arima.json from oracle/arima.R).
// The estimates are compared with the optimum of R's own likelihood (R's default optimiser stops short, log 1 of
// experiments/tsmeta120-log.md); var.coef with R's own (its numerical Hessian, Choice 2) at a looser tolerance.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { arima, predictArima } from "../src/entries/timeseries.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/arima.json", import.meta.url), "utf8")) as Record<string, any>;
const num = (v: unknown): number => (v === null ? NaN : Number(v));
const arr = (v: unknown): number[] => (Array.isArray(v) ? v.map(num) : [num(v)]);
const maxRel = (a: readonly number[], e: readonly number[], floor = 1): number =>
  Math.max(0, ...a.map((v, i) => (Number.isNaN(e[i]!) && Number.isNaN(v) ? 0 : Math.abs(v - e[i]!) / Math.max(floor, Math.abs(e[i]!)))));

describe("arima (stats) against R's optimum", () => {
  for (const [name, c] of Object.entries(fixture)) {
    it(name, () => {
      const x = arr(c.x);
      const fit = arima(x, {
        order: c.order, seasonal: { order: c.seasonal }, frequency: c.frequency, includeMean: c.include_mean, method: c.method,
        ...(c.xreg ? { xreg: [arr(c.xreg)] } : {}),
      });
      const o = c.optimum;
      const scale = Math.max(1, ...x.filter(Number.isFinite).map(Math.abs));
      // 5e-6: the drift model's likelihood is flat along a ridge (loglik equal to 1e-8 below)
      expect(maxRel(fit.coef, arr(o.coef))).toBeLessThan(5e-6);
      expect(Math.abs(fit.loglik - num(o.loglik))).toBeLessThan(1e-8 * Math.max(1, Math.abs(num(o.loglik))));
      expect(Math.abs(fit.sigma2 / num(o.sigma2) - 1)).toBeLessThan(1e-7);
      expect(maxRel(fit.residuals, arr(o.residuals), scale)).toBeLessThan(1e-6);
      expect(fit.nobs).toBe(num(c.R.nobs));
      expect(fit.nCond).toBe(num(c.R.n_cond));
      expect(fit.arma).toEqual(arr(c.R.arma));
      const nx = c.xreg ? [Array.from({ length: 12 }, (_, i) => Math.max(...arr(c.xreg)) + i + 1)] : undefined;
      const p = predictArima(fit, 12, nx ? { newxreg: nx } : {});
      expect(maxRel(p.pred, arr(o.pred), scale)).toBeLessThan(1e-6);
      expect(maxRel(p.se, arr(o.se), 0)).toBeLessThan(1e-5);
      // var.coef: R's numerical Hessian at R's own (slightly short) estimate
      // each element relative to sqrt(V_ii V_jj) (off-diagonal elements can be near 0)
      const rv = (c.R.var_coef as number[][]).map((r) => r.map(num));
      expect(fit.varCoef.length).toBe(rv.length);
      let ve = 0;
      for (let i = 0; i < rv.length; i++) for (let j = 0; j < rv.length; j++)
        ve = Math.max(ve, Math.abs(fit.varCoef[i]![j]! - rv[i]![j]!) / Math.sqrt(rv[i]![i]! * rv[j]![j]!));
      expect(ve).toBeLessThan(c.xreg ? 3e-3 : 2e-3);
      if (c.method !== "CSS") expect(Math.abs(fit.aic - (-2 * fit.loglik + 2 * (fit.coef.length + 1)))).toBeLessThan(1e-9);
    });
  }
});
