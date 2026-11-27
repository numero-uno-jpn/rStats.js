// forecast's auto.arima against R (test/fixtures/autoArima.json from oracle/autoArima.R): the chosen model, its fit,
// and the search trace (the models in R's order, their criterion; with approximation only the models and the Inf
// marks, since R's printed values carry a per-series constant, experiments/tsmeta120-log.md items 45-46).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { autoArima, type AutoArimaOptions } from "../src/entries/timeseries.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/autoArima.json", import.meta.url), "utf8")) as Record<string, any>;
const num = (v: unknown): number => (v === null ? NaN : Number(v));
const arr = (v: unknown): number[] => (Array.isArray(v) ? v.map(num) : [num(v)]);

interface TraceLine { model: string; value: number }
/** R's trace lines "ARIMA(p,d,q)(P,D,Q)[m] with ... : value" (the search part, before "Now re-fitting" / "Best model"). */
function parseTrace(lines: readonly string[]): TraceLine[] {
  const out: TraceLine[] = [];
  for (const l of lines) {
    if (/re-fitting|Best model/.test(l)) break;
    const mm = /^\s*(ARIMA\([^)]*\)(?:\([^)]*\)\[\d+\])?(?:\s+with [a-z -]+?)?)\s*:\s*(\S+)/.exec(l);
    if (mm) out.push({ model: mm[1]!.replace(/\s+/g, " ").trim(), value: mm[2] === "Inf" ? Infinity : Number(mm[2]) });
  }
  return out;
}
function modelName(e: { order: number[]; seasonal: number[]; constant: boolean }, m: number): string {
  const [p, d, q] = e.order; const [P, D, Q] = e.seasonal;
  let s = `ARIMA(${p},${d},${q})`;
  if (m > 1 && P! + D! + Q! > 0) s += `(${P},${D},${Q})[${m}]`;
  if (e.constant) s += d! + D! === 0 ? " with non-zero mean" : " with drift";
  else if (d! + D! === 0) s += " with zero mean";
  return s;
}

describe("auto.arima (forecast)", () => {
  for (const [name, c] of Object.entries(fx as Record<string, any>)) {
    it(name, () => {
      const m = num(c.frequency); const x = arr(c.x); const args = (Array.isArray(c.args) ? {} : c.args) as Record<string, unknown>;
      const opts: AutoArimaOptions = { frequency: m };
      if (args.stepwise !== undefined) opts.stepwise = args.stepwise as boolean;
      if (args.approximation !== undefined) opts.approximation = args.approximation as boolean;
      if (args.ic !== undefined) opts.ic = args.ic as "bic";
      const fit = autoArima(x, opts);
      const approx = opts.approximation ?? (x.length > 150 || m > 12);
      const r = parseTrace(c.trace as string[]);
      const ours = fit.trace.map((e) => ({ model: modelName(e, m), value: e.ic }));
      if (name === "lakehuron") {
        // R continues from ARIMA(0,1,0) with the earlier best's drift flag and stops (log 81, not imitated): the five
        // initial models agree, and the search here goes on to a lower AICc than R's choice
        expect(ours.slice(0, 5)).toEqual(r.slice(0, 5).map((e, i) => ({ ...e, value: ours[i]!.value })));
        for (let i = 0; i < 5; i++) if (r[i]!.value !== Infinity) expect(Math.abs(ours[i]!.value - r[i]!.value)).toBeLessThan(6e-3);
        expect(fit.aicc).toBeLessThan(num(c.aicc));
        return;
      }
      expect(ours.map((e) => e.model)).toEqual(r.map((e) => e.model));
      for (let i = 0; i < r.length; i++) {
        // lh ARIMA(3,0,2) with zero mean: R's optimiser stops at an interior local maximum (AICc 84.63); ours reaches the
        // higher likelihood at the MA unit-root boundary (81.69, root 1.0000), which the 1.01 rule rejects. Neither is
        // near the chosen model's 65.30.
        if (name === "lh_full" && r[i]!.model === "ARIMA(3,0,2) with zero mean") continue;
        // USAccDeaths, full search: R's CSS-ML fit fails ("non-finite finite-difference value" in optim) and prints Inf;
        // R's ML fit of (1,1,1)(2,1,0) reaches the AICc found here, 862.9468 (log 83)
        if (name === "usacc_full" && ["ARIMA(1,1,1)(2,1,0)[12]", "ARIMA(3,1,0)(2,1,0)[12]"].includes(r[i]!.model)) continue;
        // USAccDeaths, full search: R stops at a worse local optimum of ARIMA(3,1,1)(0,1,0)[12] (AICc 871.667 against
        // 870.771 here)
        if (name === "usacc_full" && r[i]!.model === "ARIMA(3,1,1)(0,1,0)[12]") { expect(ours[i]!.value).toBeLessThan(r[i]!.value); continue; }
        if (r[i]!.value === Infinity || approx) expect(ours[i]!.value === Infinity).toBe(r[i]!.value === Infinity);
        // R prints 7 significant digits... at most; its fits stop about 1e-6 short of the optimum
        else expect(Math.abs(ours[i]!.value - r[i]!.value)).toBeLessThan(Math.max(1e-3, 1e-6 * Math.abs(r[i]!.value)) + 5e-3);
      }
      // arimaorder: p, d, q (and P, D, Q, frequency for a seasonal model)
      const [p, q, P, Q, s, d, D] = fit.arma;
      expect([p, d, q, P, D, Q, s].slice(0, arr(c.order).length)).toEqual(arr(c.order));
      expect(fit.coefNames).toEqual(Array.isArray(c.names) ? c.names : c.names === null ? [] : [c.names]);
      expect(Math.abs(fit.aicc - num(c.aicc))).toBeLessThan(1e-5 * Math.max(1, Math.abs(num(c.aicc))));
    }, 300_000); // the full search of usacc takes about 2 minutes alone, more under a full run
  }
});
