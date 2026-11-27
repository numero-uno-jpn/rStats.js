// forecast's ets and forecast.ets against R (test/fixtures/ets.json from oracle/ets.R): the filter, criteria and
// forecasts at R's own estimates, the estimation by its likelihood (ours at least as high), and the ZZZ choice.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ets, etsAt, forecastEts, type EtsParameters, type EtsSpec } from "../src/timeseries/ets.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/ets.json", import.meta.url), "utf8")) as Record<string, any>;
const num = (v: unknown): number => (v === null ? NaN : Number(v));
const arr = (v: unknown): number[] => (Array.isArray(v) ? v.map(num) : [num(v)]);
const maxRel = (a: readonly number[], e: readonly number[], scale: number): number =>
  Math.max(0, ...a.map((v, i) => Math.abs(v - e[i]!) / scale));

function specOf(c: any): EtsSpec {
  const mdl = c.model as string;
  return { error: mdl[0] as "A", trend: mdl[1] as "N", damped: c.damped, season: mdl[2] as "N", m: mdl[2] === "N" ? 1 : num(c.frequency) };
}
function parOf(c: any): EtsParameters {
  const names = (Array.isArray(c.par_names) ? c.par_names : [c.par_names]) as string[]; const v = arr(c.par);
  const g = (n: string): number | undefined => { const i = names.indexOf(n); return i >= 0 ? v[i] : undefined; };
  const s = names.map((n, i) => (/^s\d+$/.test(n) ? v[i]! : NaN)).filter((x) => !Number.isNaN(x));
  const out: Record<string, unknown> = { alpha: g("alpha"), l: g("l") };
  for (const k of ["beta", "gamma", "phi", "b"]) if (g(k) !== undefined) out[k] = g(k);
  if (s.length) out.s = s;
  return out as unknown as EtsParameters;
}

describe("ets at R's estimates (filter, criteria, forecasts)", () => {
  for (const [name, c] of Object.entries(fx.fits as Record<string, any>)) {
    it(name, () => {
      const x = arr(c.x); const spec = specOf(c); const par = parOf(c); const np = arr(c.par).length;
      const f = etsAt(x, spec, par, np); const scale = Math.max(...x.map(Math.abs));
      expect(f.method).toBe(c.method);
      expect(maxRel(f.fitted, arr(c.fitted), scale)).toBeLessThan(1e-12);
      expect(maxRel(f.residuals, arr(c.residuals), spec.error === "M" ? 1 : scale)).toBeLessThan(1e-12);
      expect(maxRel(f.states.flat(), (c.states as number[][]).flat().map(num), scale)).toBeLessThan(1e-12);
      for (const k of ["loglik", "aic", "bic", "aicc"] as const) expect(Math.abs(f[k] - num(c[k]))).toBeLessThan(1e-9 * Math.max(1, Math.abs(num(c[k]))));
      expect(Math.abs(f.sigma2 / num(c.sigma2) - 1)).toBeLessThan(1e-12);
      expect(Math.abs(f.mse / num(c.mse) - 1)).toBeLessThan(1e-12);
      // damped trends: R's in-sample h-step forecasts depart from the model (log 82, not imitated)
      if (!spec.damped) expect(Math.abs(f.amse / num(c.amse) - 1)).toBeLessThan(1e-12);
      const h = arr(c.mean).length; const fc = forecastEts(f, { h, level: [80, 95] });
      // departures from R (the model's formulas): damped class 3 (MAdM) means and intervals; ANA / MNA intervals
      const meanDeparts = name === "air_MAdM"; const intervalDeparts = meanDeparts || /_(ANA|MNA)$/.test(name);
      if (!meanDeparts) expect(maxRel(fc.mean, arr(c.mean), scale)).toBeLessThan(1e-11);
      if (!intervalDeparts) {
        expect(maxRel(fc.lower.flat(), (c.lower as number[][]).flat().map(num), scale)).toBeLessThan(1e-9);
        expect(maxRel(fc.upper.flat(), (c.upper as number[][]).flat().map(num), scale)).toBeLessThan(1e-9);
      }
    });
  }
});

describe("ets estimation (forecast)", () => {
  for (const [name, c] of Object.entries(fx.fits as Record<string, any>)) {
    it(name, () => {
      const x = arr(c.x); const spec = specOf(c);
      const fit = ets(x, { frequency: num(c.frequency), model: c.model, damped: c.damped });
      expect(fit.method).toBe(c.method);
      // R stops early: ours at least as high (to rounding)
      expect(fit.loglik).toBeGreaterThan(num(c.loglik) - 1e-7 * Math.abs(num(c.loglik)));
      void spec;
    });
  }
  for (const [name, c] of Object.entries(fx.auto as Record<string, any>)) {
    it(`ZZZ ${name}`, () => {
      const fit = ets(arr(c.x), { frequency: num(c.frequency) });
      // R's optimiser stops at lower likelihoods (AirPassengers MAM: -682.40 against -676.17 here; uspop MAN: -73.41,
      // at a level of -20.6 with a negative mean, against -40.42), so the smallest AICc can be another model
      const differs: Record<string, string> = { air: "ETS(M,A,M)", uspop: "ETS(M,A,N)" };
      expect(fit.method).toBe(differs[name] ?? c.method);
      expect(fit.aicc).toBeLessThan(num(c.aicc) + 1e-6 * Math.abs(num(c.aicc)));
    });
  }
});
